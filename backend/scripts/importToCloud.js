/**
 * Safe Cloud MySQL Migration & Verification Script (Phase 3 Helper)
 *
 * Imports a verified local SQL dump into a hosted MySQL 8 database (e.g., Aiven)
 * over SSL while:
 *   - Parsing DELIMITER directives, trigger bodies, quoted strings, comments,
 *     and semicolons reliably without sending DELIMITER to MySQL.
 *   - Normalizing MariaDB 10.4 trigger wrappers and stripping DEFINER clauses
 *     and MariaDB-only executable comments for MySQL 8 compatibility.
 *   - Removing LOCK TABLES / UNLOCK TABLES statements.
 *   - Refusing local hosts (localhost, 127.0.0.1, ::1) to protect XAMPP.
 *   - Refusing to overwrite a non-empty target database unless ALLOW_OVERWRITE=true.
 *   - Executing statements sequentially on a single connection while preserving
 *     FOREIGN_KEY_CHECKS and restoring FOREIGN_KEY_CHECKS = 1 in a finally block.
 *   - Verifying all 14 tables, 20 foreign keys, 2 triggers, AUTO_INCREMENT values,
 *     and row counts after import.
 *
 * Offline Dry-Run Mode (no DB connection, no SQL executed):
 *   node backend/scripts/importToCloud.js --dry-run [optional_backup_path]
 *
 * Live Cloud Import Mode (only when explicitly invoked with cloud credentials):
 *   CLOUD_DB_HOST, CLOUD_DB_PORT, CLOUD_DB_USER, CLOUD_DB_PASSWORD, CLOUD_DB_NAME
 *   Optional: CLOUD_DB_SSL_CA, CLOUD_DB_SSL_REJECT_UNAUTHORIZED, BACKUP_SQL_PATH,
 *             ALLOW_OVERWRITE=true
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const EXPECTED_TABLES = [
  'chatbot_logs',
  'departments',
  'events',
  'exam_subjects',
  'exams',
  'facilities',
  'faculty',
  'marks',
  'notices',
  'results',
  'subjects',
  'teacher_assignments',
  'timetable',
  'users',
];

const EXPECTED_FOREIGN_KEYS = 20;
const EXPECTED_TRIGGERS = [
  'trg_timetable_no_overlap_insert',
  'trg_timetable_no_overlap_update',
];

const BLOCKED_LOCAL_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  '127.0.0.1',
  '::1',
  '[::1]',
  '0.0.0.0',
]);

/**
 * Hard guard that refuses local hostnames/IPs so local XAMPP can never be touched.
 */
function assertSafeCloudHost(host) {
  const normalized = String(host || '').trim().toLowerCase();
  if (!normalized) {
    throw new Error('CLOUD_DB_HOST is empty.');
  }
  if (
    BLOCKED_LOCAL_HOSTS.has(normalized) ||
    normalized.startsWith('127.') ||
    normalized.endsWith('.localhost')
  ) {
    throw new Error(
      `Refusing to run cloud import against local host "${host}". ` +
        'Local XAMPP databases are protected and must never be targeted by importToCloud.js.'
    );
  }
}

/**
 * Returns a short, credential-safe summary of a SQL statement for error reporting.
 * Never logs INSERT VALUES payloads (which may contain user emails or password hashes).
 */
function describeSqlStatement(sql) {
  const trimmed = sql.trim();
  const insertMatch = trimmed.match(/^INSERT\s+(?:IGNORE\s+)?INTO\s+`?([a-zA-Z0-9_]+)`?/i);
  if (insertMatch) {
    return `INSERT INTO \`${insertMatch[1]}\` (... ${Buffer.byteLength(trimmed, 'utf8')} bytes redacted)`;
  }

  const createTableMatch = trimmed.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([a-zA-Z0-9_]+)`?/i);
  if (createTableMatch) {
    return `CREATE TABLE \`${createTableMatch[1]}\``;
  }

  const dropTableMatch = trimmed.match(/^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?`?([a-zA-Z0-9_]+)`?/i);
  if (dropTableMatch) {
    return `DROP TABLE \`${dropTableMatch[1]}\``;
  }

  const createTriggerMatch = trimmed.match(/^CREATE\s+TRIGGER\s+`?([a-zA-Z0-9_]+)`?/i);
  if (createTriggerMatch) {
    return `CREATE TRIGGER \`${createTriggerMatch[1]}\``;
  }

  const compact = trimmed.replace(/\s+/g, ' ');
  return compact.length > 160 ? `${compact.slice(0, 160)}...` : compact;
}

/**
 * Normalizes a single parsed SQL statement for MySQL 8 compatibility.
 * Returns { sql: string | null, flags: object } where sql === null means skip statement.
 */
function normalizeStatementForMySQL8(rawStmt) {
  let stmt = rawStmt.trim();
  const flags = {
    skippedLock: false,
    strippedDefiner: false,
    normalizedTrigger: false,
    strippedMariaDbComment: false,
    normalizedCharset: false,
    normalizedSqlMode: false,
  };

  if (!stmt) {
    return { sql: null, flags };
  }

  // Never mutate row payload data inside INSERT statements
  if (/^INSERT\s+(?:IGNORE\s+)?INTO\b/i.test(stmt)) {
    return { sql: stmt, flags };
  }

  // Strip MariaDB-only executable comments: /*M! ... */
  const withoutMariaDb = stmt.replace(/\/\*M![\s\S]*?\*\//g, '').trim();
  if (withoutMariaDb !== stmt) {
    flags.strippedMariaDbComment = true;
    stmt = withoutMariaDb;
  }
  if (!stmt) {
    return { sql: null, flags };
  }

  // Remove LOCK TABLES / UNLOCK TABLES (often restricted on managed cloud MySQL)
  if (/^(?:LOCK\s+TABLES|UNLOCK\s+TABLES)\b/i.test(stmt)) {
    flags.skippedLock = true;
    return { sql: null, flags };
  }

  // Remove conditional DEFINER wrappers (e.g., /*!50017 DEFINER=`root`@`localhost`*/ or /*!50013 DEFINER=...*/)
  const withoutConditionalDefiner = stmt.replace(
    /\/\*!\d+\s+DEFINER\s*=\s*(?:`[^`]+`|'[^']+'|[^\s*]+)\s*@\s*(?:`[^`]+`|'[^']+'|[^\s*]+)\s*\*\//gi,
    ''
  );
  if (withoutConditionalDefiner !== stmt) {
    flags.strippedDefiner = true;
    stmt = withoutConditionalDefiner.trim();
  }

  // Remove bare DEFINER=`user`@`host` clauses on DDL statements
  const withoutBareDefiner = stmt.replace(
    /\bDEFINER\s*=\s*(?:`[^`]+`|'[^']+'|[^\s]+)\s*@\s*(?:`[^`]+`|'[^']+'|[^\s]+)\s*/gi,
    ''
  );
  if (withoutBareDefiner !== stmt) {
    flags.strippedDefiner = true;
    stmt = withoutBareDefiner.trim();
  }

  // Unwrap MariaDB/mysqldump trigger conditional wrappers into clean MySQL 8 CREATE TRIGGER DDL:
  // Pattern 1: /*!50003 CREATE*/ /*!50003 TRIGGER ... END */
  const splitTriggerMatch = stmt.match(
    /^\/\*!\d+\s+CREATE\s*\*\/\s*\/\*!\d+\s+(TRIGGER\b[\s\S]*)\*\/$/i
  );
  if (splitTriggerMatch) {
    stmt = `CREATE ${splitTriggerMatch[1].trim()}`;
    flags.normalizedTrigger = true;
  } else {
    // Pattern 2: /*!50003 CREATE TRIGGER ... END */
    const singleTriggerMatch = stmt.match(
      /^\/\*!\d+\s+(CREATE\s+TRIGGER\b[\s\S]*)\*\/$/i
    );
    if (singleTriggerMatch) {
      stmt = singleTriggerMatch[1].trim();
      flags.normalizedTrigger = true;
    }
  }

  // Normalize legacy `SET character_set_client = utf8` to utf8mb4 (avoids MySQL 8 utf8mb3 warning)
  if (/^\/\*!\d+\s+SET\s+character_set_client\s*=\s*utf8\s*\*\/$/i.test(stmt)) {
    stmt = stmt.replace(/=\s*utf8\b/i, '= utf8mb4');
    flags.normalizedCharset = true;
  }

  // Strip NO_AUTO_CREATE_USER if ever present in SQL_MODE (removed in MySQL 8)
  if (/\bSQL_MODE\b/i.test(stmt) && /\bNO_AUTO_CREATE_USER\b/i.test(stmt)) {
    stmt = stmt
      .replace(/,?\s*NO_AUTO_CREATE_USER\s*,?/gi, (m) =>
        m.startsWith(',') && m.endsWith(',') ? ',' : ''
      );
    flags.normalizedSqlMode = true;
  }

  // Keep consistent utf8mb4_unicode_ci collation across MariaDB/MySQL 8
  stmt = stmt.replace(/utf8mb4_0900_ai_ci/g, 'utf8mb4_unicode_ci');

  return { sql: stmt.trim() || null, flags };
}

/**
 * Character-by-character SQL dump parser supporting:
 *   - DELIMITER directives (e.g., DELIMITER ;; ... DELIMITER ;)
 *   - Single-quoted, double-quoted, and backtick-quoted strings with escapes
 *   - Single-line comments (-- and #) and multi-line comments
 *   - MySQL versioned conditional comments (/*!50003 ... *\/) preserving quotes inside
 *   - Trigger BEGIN ... END blocks containing internal semicolons
 */
function parseAndNormalizeSqlDump(rawSql) {
  // Strip UTF-8 BOM if present and normalize line endings
  const text = rawSql.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const statements = [];
  const errors = [];
  const stats = {
    delimiterDirectives: 0,
    rawStatements: 0,
    executableStatements: 0,
    skippedLockStatements: 0,
    strippedDefiners: 0,
    normalizedTriggers: 0,
    strippedMariaDbComments: 0,
    normalizedCharsets: 0,
    maxStatementBytes: 0,
  };

  let delimiter = ';';
  let buffer = '';
  let stmtStartLine = null;
  let line = 1;
  let atLineStart = true;

  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inPlainBlockComment = false;
  let inConditionalComment = false;

  const flushStatement = (endLine) => {
    const raw = buffer.trim();
    const startLine = stmtStartLine || endLine;
    buffer = '';
    stmtStartLine = null;

    if (!raw) return;

    stats.rawStatements += 1;
    const { sql, flags } = normalizeStatementForMySQL8(raw);

    if (flags.skippedLock) stats.skippedLockStatements += 1;
    if (flags.strippedDefiner) stats.strippedDefiners += 1;
    if (flags.normalizedTrigger) stats.normalizedTriggers += 1;
    if (flags.strippedMariaDbComment) stats.strippedMariaDbComments += 1;
    if (flags.normalizedCharset) stats.normalizedCharsets += 1;

    if (!sql) return;

    const bytes = Buffer.byteLength(sql, 'utf8');
    if (bytes > stats.maxStatementBytes) {
      stats.maxStatementBytes = bytes;
    }

    stats.executableStatements += 1;
    statements.push({
      index: statements.length + 1,
      startLine,
      endLine,
      bytes,
      sql,
    });
  };

  const len = text.length;
  let i = 0;

  while (i < len) {
    const ch = text[i];
    const next = i + 1 < len ? text[i + 1] : '';

    // 1. Inside plain /* ... */ block comment (not conditional /*! ... */)
    if (inPlainBlockComment) {
      if (ch === '*' && next === '/') {
        inPlainBlockComment = false;
        i += 2;
        continue;
      }
      if (ch === '\n') {
        line += 1;
        atLineStart = true;
      }
      i += 1;
      continue;
    }

    // 2. Inside single-quoted string
    if (inSingleQuote) {
      buffer += ch;
      if (ch === '\\' && i + 1 < len) {
        buffer += next;
        if (next === '\n') line += 1;
        i += 2;
        continue;
      }
      if (ch === "'" && next === "'") {
        buffer += next;
        i += 2;
        continue;
      }
      if (ch === "'") {
        inSingleQuote = false;
      }
      if (ch === '\n') line += 1;
      i += 1;
      continue;
    }

    // 3. Inside double-quoted string
    if (inDoubleQuote) {
      buffer += ch;
      if (ch === '\\' && i + 1 < len) {
        buffer += next;
        if (next === '\n') line += 1;
        i += 2;
        continue;
      }
      if (ch === '"' && next === '"') {
        buffer += next;
        i += 2;
        continue;
      }
      if (ch === '"') {
        inDoubleQuote = false;
      }
      if (ch === '\n') line += 1;
      i += 1;
      continue;
    }

    // 4. Inside backtick identifier
    if (inBacktick) {
      buffer += ch;
      if (ch === '`' && next === '`') {
        buffer += next;
        i += 2;
        continue;
      }
      if (ch === '`') {
        inBacktick = false;
      }
      if (ch === '\n') line += 1;
      i += 1;
      continue;
    }

    // 5. Handle DELIMITER directive at the start of a line (outside quotes/comments)
    if (atLineStart && !inConditionalComment) {
      const lineEndIdx = text.indexOf('\n', i);
      const rawLine = lineEndIdx === -1 ? text.slice(i) : text.slice(i, lineEndIdx);
      const delimMatch = rawLine.match(/^[ \t]*DELIMITER[ \t]+(\S+)[ \t]*$/i);
      if (delimMatch) {
        if (buffer.trim().length > 0) {
          errors.push(
            `Line ${line}: Unterminated SQL statement before DELIMITER directive.`
          );
          flushStatement(line);
        }
        delimiter = delimMatch[1];
        stats.delimiterDirectives += 1;
        if (lineEndIdx === -1) {
          i = len;
        } else {
          i = lineEndIdx + 1;
          line += 1;
        }
        atLineStart = true;
        continue;
      }
    }

    // 6. Close conditional comment /*! ... */
    if (inConditionalComment && ch === '*' && next === '/') {
      buffer += '*/';
      inConditionalComment = false;
      atLineStart = false;
      i += 2;
      continue;
    }

    // 7. Single-line comments (-- <ws|eol> or #) outside conditional comments
    if (!inConditionalComment) {
      const isDashComment =
        ch === '-' &&
        next === '-' &&
        (i + 2 >= len || text[i + 2] === ' ' || text[i + 2] === '\t' || text[i + 2] === '\n');
      if (isDashComment || ch === '#') {
        const lineEndIdx = text.indexOf('\n', i);
        if (lineEndIdx === -1) {
          i = len;
        } else {
          if (buffer.length > 0) buffer += '\n';
          i = lineEndIdx + 1;
          line += 1;
          atLineStart = true;
        }
        continue;
      }
    }

    // 8. Block comments: /* ... */ vs conditional /*! ... */ and /*M! ... */
    if (ch === '/' && next === '*') {
      const third = i + 2 < len ? text[i + 2] : '';
      const fourth = i + 3 < len ? text[i + 3] : '';
      const isMySqlConditional = third === '!';
      const isMariaDbConditional = third === 'M' && fourth === '!';

      if (isMySqlConditional || isMariaDbConditional) {
        if (stmtStartLine === null) stmtStartLine = line;
        inConditionalComment = true;
        buffer += '/*';
        atLineStart = false;
        i += 2;
        continue;
      } else {
        inPlainBlockComment = true;
        atLineStart = false;
        i += 2;
        continue;
      }
    }

    // 9. Enter quoted strings / backtick identifiers
    if (ch === "'") {
      if (stmtStartLine === null) stmtStartLine = line;
      inSingleQuote = true;
      buffer += ch;
      atLineStart = false;
      i += 1;
      continue;
    }
    if (ch === '"') {
      if (stmtStartLine === null) stmtStartLine = line;
      inDoubleQuote = true;
      buffer += ch;
      atLineStart = false;
      i += 1;
      continue;
    }
    if (ch === '`') {
      if (stmtStartLine === null) stmtStartLine = line;
      inBacktick = true;
      buffer += ch;
      atLineStart = false;
      i += 1;
      continue;
    }

    // 10. Statement delimiter match (only outside quotes and comments)
    if (!inConditionalComment && text.startsWith(delimiter, i)) {
      flushStatement(line);
      i += delimiter.length;
      atLineStart = false;
      continue;
    }

    // 11. Normal character
    if (ch === '\n') {
      if (buffer.length > 0) buffer += '\n';
      line += 1;
      atLineStart = true;
    } else {
      if (!/[ \t]/.test(ch)) {
        if (stmtStartLine === null) stmtStartLine = line;
        atLineStart = false;
      }
      if (buffer.length > 0 || !/[ \t]/.test(ch)) {
        buffer += ch;
      }
    }
    i += 1;
  }

  // Final state validation
  if (inSingleQuote) errors.push('Unexpected EOF: unclosed single-quoted string.');
  if (inDoubleQuote) errors.push('Unexpected EOF: unclosed double-quoted string.');
  if (inBacktick) errors.push('Unexpected EOF: unclosed backtick identifier.');
  if (inPlainBlockComment) errors.push('Unexpected EOF: unclosed block comment.');
  if (inConditionalComment) errors.push('Unexpected EOF: unclosed conditional comment.');
  if (delimiter !== ';') {
    errors.push(`Unexpected EOF: DELIMITER was not reset to ";" (ended as "${delimiter}").`);
  }
  if (buffer.trim().length > 0) {
    flushStatement(line);
  }

  return { statements, stats, errors };
}

/**
 * Inspects parsed statements offline to verify schema integrity and MySQL 8 readiness.
 */
function analyzeParsedDump(parsed) {
  const { statements, stats, errors } = parsed;

  const tables = [];
  const foreignKeys = [];
  const triggers = [];
  const insertCountsByTable = {};
  const warnings = [];

  let fkChecksDisabled = false;
  let fkChecksRestored = false;

  for (const st of statements) {
    const sql = st.sql;

    if (/FOREIGN_KEY_CHECKS\s*=\s*0\b/i.test(sql)) {
      fkChecksDisabled = true;
    }
    if (/FOREIGN_KEY_CHECKS\s*=\s*@OLD_FOREIGN_KEY_CHECKS\b/i.test(sql) || /FOREIGN_KEY_CHECKS\s*=\s*1\b/i.test(sql)) {
      fkChecksRestored = true;
    }

    // Detect leftover incompatible directives/clauses in executable statements
    if (!/^INSERT\s+(?:IGNORE\s+)?INTO\b/i.test(sql)) {
      if (/^\s*DELIMITER\b/im.test(sql)) {
        errors.push(`Statement #${st.index} (line ${st.startLine}): Residual DELIMITER directive found.`);
      }
      if (/\bDEFINER\s*=/i.test(sql)) {
        errors.push(`Statement #${st.index} (line ${st.startLine}): Residual DEFINER clause found.`);
      }
      if (/\/\*M!/i.test(sql)) {
        errors.push(`Statement #${st.index} (line ${st.startLine}): Residual MariaDB /*M! comment found.`);
      }
      if (/^(?:LOCK\s+TABLES|UNLOCK\s+TABLES)\b/i.test(sql)) {
        errors.push(`Statement #${st.index} (line ${st.startLine}): Residual LOCK/UNLOCK TABLES found.`);
      }
    }

    // CREATE TABLE inspection
    const createTableMatch = sql.match(
      /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([a-zA-Z0-9_]+)`?/i
    );
    if (createTableMatch) {
      const tableName = createTableMatch[1];
      const autoIncMatch = sql.match(/\bAUTO_INCREMENT\s*=\s*(\d+)/i);
      const fkMatches = [...sql.matchAll(/CONSTRAINT\s+`?([a-zA-Z0-9_]+)`?\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+`?([a-zA-Z0-9_]+)`?/gi)];
      const pkPresent = /\bPRIMARY\s+KEY\b/i.test(sql);
      const uniqueCount = (sql.match(/\bUNIQUE\s+KEY\b/gi) || []).length;
      const checkCount = (sql.match(/\bCHECK\s*\(/gi) || []).length;

      tables.push({
        name: tableName,
        startLine: st.startLine,
        hasPrimaryKey: pkPresent,
        uniqueKeyCount: uniqueCount,
        checkConstraintCount: checkCount,
        foreignKeyCount: fkMatches.length,
        autoIncrement: autoIncMatch ? Number(autoIncMatch[1]) : null,
      });

      for (const fk of fkMatches) {
        foreignKeys.push({
          table: tableName,
          name: fk[1],
          columns: fk[2].trim(),
          referencesTable: fk[3],
        });
      }
      continue;
    }

    // CREATE TRIGGER inspection
    const createTriggerMatch = sql.match(
      /^CREATE\s+TRIGGER\s+`?([a-zA-Z0-9_]+)`?\s+(BEFORE|AFTER)\s+(INSERT|UPDATE|DELETE)\s+ON\s+`?([a-zA-Z0-9_]+)`?/i
    );
    if (createTriggerMatch) {
      const endsWithEnd = /\bEND\s*$/i.test(sql);
      if (!endsWithEnd) {
        errors.push(
          `Statement #${st.index} (line ${st.startLine}): Trigger "${createTriggerMatch[1]}" does not end cleanly with END.`
        );
      }
      triggers.push({
        name: createTriggerMatch[1],
        timing: createTriggerMatch[2].toUpperCase(),
        event: createTriggerMatch[3].toUpperCase(),
        table: createTriggerMatch[4],
        startLine: st.startLine,
        endsCleanly: endsWithEnd,
      });
      continue;
    }

    // INSERT INTO tracking
    const insertMatch = sql.match(/^INSERT\s+(?:IGNORE\s+)?INTO\s+`?([a-zA-Z0-9_]+)`?/i);
    if (insertMatch) {
      const tableName = insertMatch[1];
      insertCountsByTable[tableName] = (insertCountsByTable[tableName] || 0) + 1;
    }
  }

  // Validate expected schema objects
  const foundTableNames = tables.map((t) => t.name);
  const missingTables = EXPECTED_TABLES.filter((t) => !foundTableNames.includes(t));
  if (missingTables.length > 0) {
    errors.push(`Missing expected CREATE TABLE statement(s): ${missingTables.join(', ')}`);
  }
  if (tables.length !== EXPECTED_TABLES.length) {
    warnings.push(`Detected ${tables.length} CREATE TABLE statements (expected ${EXPECTED_TABLES.length}).`);
  }

  if (foreignKeys.length !== EXPECTED_FOREIGN_KEYS) {
    errors.push(
      `Detected ${foreignKeys.length} FOREIGN KEY definitions (expected ${EXPECTED_FOREIGN_KEYS}).`
    );
  }

  const foundTriggerNames = triggers.map((t) => t.name);
  const missingTriggers = EXPECTED_TRIGGERS.filter((t) => !foundTriggerNames.includes(t));
  if (missingTriggers.length > 0) {
    errors.push(`Missing expected CREATE TRIGGER statement(s): ${missingTriggers.join(', ')}`);
  }

  if (!fkChecksDisabled || !fkChecksRestored) {
    warnings.push(
      `FOREIGN_KEY_CHECKS wrapper incomplete (disabled=${fkChecksDisabled}, restored=${fkChecksRestored}).`
    );
  }

  // Warn if any single INSERT statement is very large (> 4 MB) relative to typical cloud max_allowed_packet
  if (stats.maxStatementBytes > 4 * 1024 * 1024) {
    warnings.push(
      `Largest single SQL statement is ${(stats.maxStatementBytes / (1024 * 1024)).toFixed(2)} MB; verify target cloud MySQL max_allowed_packet is larger.`
    );
  }

  return {
    stats,
    tables,
    foreignKeys,
    triggers,
    insertCountsByTable,
    fkChecksDisabled,
    fkChecksRestored,
    warnings,
    errors,
  };
}

function buildCloudSslConfig() {
  const ssl = {
    rejectUnauthorized:
      String(process.env.CLOUD_DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !==
      'false',
  };
  if (process.env.CLOUD_DB_SSL_CA) {
    const rawCa = process.env.CLOUD_DB_SSL_CA.trim();
    ssl.ca = rawCa.includes('BEGIN CERTIFICATE')
      ? rawCa.replace(/\\n/g, '\n')
      : fs.readFileSync(rawCa, 'utf8');
  }
  return ssl;
}

function resolveBackupPath(cliArgPath) {
  return (
    cliArgPath ||
    process.env.BACKUP_SQL_PATH ||
    path.join(
      __dirname,
      '..',
      '..',
      'database',
      'backups',
      'campus_assistant_db_v2_deploy_backup.sql'
    )
  );
}

function runDryRun(backupPath) {
  if (!fs.existsSync(backupPath)) {
    console.error(`Backup SQL file not found at: ${backupPath}`);
    process.exit(1);
  }

  const fileSizeBytes = fs.statSync(backupPath).size;
  const rawSql = fs.readFileSync(backupPath, 'utf8');
  const parsed = parseAndNormalizeSqlDump(rawSql);
  const report = analyzeParsedDump(parsed);

  console.log('=== Offline SQL Parser Dry-Run Report ===');
  console.log(`Backup file: ${backupPath}`);
  console.log(`File size: ${fileSizeBytes.toLocaleString()} bytes`);
  console.log(`Raw statements parsed: ${report.stats.rawStatements}`);
  console.log(`Executable statements for MySQL 8: ${report.stats.executableStatements}`);
  console.log(`DELIMITER directives handled: ${report.stats.delimiterDirectives}`);
  console.log(`LOCK/UNLOCK TABLES removed: ${report.stats.skippedLockStatements}`);
  console.log(`DEFINER clauses stripped: ${report.stats.strippedDefiners}`);
  console.log(`Trigger wrappers normalized: ${report.stats.normalizedTriggers}`);
  console.log(`MariaDB /*M! comments stripped: ${report.stats.strippedMariaDbComments}`);
  console.log(`Legacy utf8 charset directives normalized: ${report.stats.normalizedCharsets}`);
  console.log(
    `Largest single executable statement: ${(report.stats.maxStatementBytes / 1024).toFixed(1)} KB`
  );
  console.log(
    `FOREIGN_KEY_CHECKS handling: disabled=${report.fkChecksDisabled}, restored=${report.fkChecksRestored}`
  );
  console.log('');
  console.log(`CREATE TABLE statements detected (${report.tables.length}/${EXPECTED_TABLES.length}):`);
  for (const t of report.tables) {
    console.log(
      `  - ${t.name} (line ${t.startLine}, PK=${t.hasPrimaryKey}, FKs=${t.foreignKeyCount}, UQs=${t.uniqueKeyCount}, CHECKs=${t.checkConstraintCount}, AUTO_INCREMENT=${t.autoIncrement ?? 'default'})`
    );
  }
  console.log('');
  console.log(
    `FOREIGN KEY definitions retained (${report.foreignKeys.length}/${EXPECTED_FOREIGN_KEYS}):`
  );
  for (const fk of report.foreignKeys) {
    console.log(`  - ${fk.table}.${fk.name} (${fk.columns}) -> ${fk.referencesTable}`);
  }
  console.log('');
  console.log(
    `CREATE TRIGGER statements normalized (${report.triggers.length}/${EXPECTED_TRIGGERS.length}):`
  );
  for (const tr of report.triggers) {
    console.log(
      `  - ${tr.name} (${tr.timing} ${tr.event} ON ${tr.table}, line ${tr.startLine}, endsCleanly=${tr.endsCleanly})`
    );
  }
  console.log('');
  console.log('INSERT statements by table:');
  for (const [tbl, cnt] of Object.entries(report.insertCountsByTable)) {
    console.log(`  - ${tbl}: ${cnt} INSERT statement(s)`);
  }
  console.log('');
  console.log(`Warnings (${report.warnings.length}):`);
  if (report.warnings.length === 0) {
    console.log('  None');
  } else {
    for (const w of report.warnings) console.log(`  - [WARNING] ${w}`);
  }
  console.log(`Parsing errors (${report.errors.length}):`);
  if (report.errors.length === 0) {
    console.log('  None');
  } else {
    for (const e of report.errors) console.error(`  - [ERROR] ${e}`);
  }

  if (report.errors.length > 0) {
    process.exit(1);
  }
  console.log('\nDRY-RUN PASSED: Zero parsing errors. No database connection was made.');
}

async function runImport(backupPath) {
  const required = [
    'CLOUD_DB_HOST',
    'CLOUD_DB_PORT',
    'CLOUD_DB_USER',
    'CLOUD_DB_PASSWORD',
    'CLOUD_DB_NAME',
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`Missing required environment variable(s): ${missing.join(', ')}`);
    process.exit(1);
  }

  // Hard guard: refuse localhost / 127.0.0.1 / ::1
  assertSafeCloudHost(process.env.CLOUD_DB_HOST);

  if (!fs.existsSync(backupPath)) {
    console.error(`Backup SQL file not found at: ${backupPath}`);
    process.exit(1);
  }

  // Parse and validate the backup completely offline before opening any connection
  const rawSql = fs.readFileSync(backupPath, 'utf8');
  const parsed = parseAndNormalizeSqlDump(rawSql);
  const analysis = analyzeParsedDump(parsed);

  if (analysis.errors.length > 0) {
    console.error('Aborting import before connecting due to SQL parsing errors:');
    for (const err of analysis.errors) console.error(`  - ${err}`);
    process.exit(1);
  }

  const ssl = buildCloudSslConfig();
  const conn = await mysql.createConnection({
    host: process.env.CLOUD_DB_HOST,
    port: Number(process.env.CLOUD_DB_PORT),
    user: process.env.CLOUD_DB_USER,
    password: process.env.CLOUD_DB_PASSWORD,
    database: process.env.CLOUD_DB_NAME,
    ssl,
    multipleStatements: false,
  });

  try {
    // Safety guard: never overwrite a non-empty cloud database without explicit opt-in
    const [existingTables] = await conn.query('SHOW TABLES');
    const allowOverwrite =
      String(process.env.ALLOW_OVERWRITE || '').toLowerCase() === 'true';

    if (existingTables.length > 0 && !allowOverwrite) {
      throw new Error(
        `Target cloud database "${process.env.CLOUD_DB_NAME}" is NOT empty (${existingTables.length} existing table(s)). ` +
          'Aborting to prevent accidental data loss. Set ALLOW_OVERWRITE=true explicitly if you intend to replace it.'
      );
    }

    console.log(
      `Connected to hosted MySQL over SSL. Executing ${parsed.statements.length} normalized SQL statements sequentially...`
    );

    for (const st of parsed.statements) {
      try {
        await conn.query(st.sql);
      } catch (err) {
        const desc = describeSqlStatement(st.sql);
        const detail = new Error(
          `Failed at statement #${st.index}/${parsed.statements.length} ` +
            `(source line ${st.startLine}, ${desc}): ${err.code || 'SQL_ERROR'} - ${err.sqlMessage || err.message}`
        );
        detail.code = err.code;
        throw detail;
      }
    }

    // Ensure FOREIGN_KEY_CHECKS is restored before post-import verification
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // Comprehensive post-import verification across all 14 tables, 20 FKs, 2 triggers, AUTO_INCREMENT, and row counts
    const [tables] = await conn.query('SHOW TABLES');
    const actualTableNames = tables.map((row) => Object.values(row)[0]).sort();
    const [triggers] = await conn.query('SHOW TRIGGERS');
    const actualTriggerNames = triggers.map((t) => t.Trigger).sort();

    const [fks] = await conn.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.TABLE_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE()
         AND CONSTRAINT_TYPE = 'FOREIGN KEY'`
    );
    const fkCount = Number(fks[0].cnt);

    const [autoIncRows] = await conn.query(
      `SELECT TABLE_NAME, AUTO_INCREMENT
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
       ORDER BY TABLE_NAME`
    );
    const autoIncrementMap = {};
    for (const row of autoIncRows) {
      autoIncrementMap[row.TABLE_NAME] = row.AUTO_INCREMENT;
    }

    const rowCounts = {};
    for (const tableName of actualTableNames) {
      const [cntRows] = await conn.query(`SELECT COUNT(*) AS cnt FROM \`${tableName}\``);
      rowCounts[tableName] = Number(cntRows[0].cnt);
    }

    const missingTables = EXPECTED_TABLES.filter((t) => !actualTableNames.includes(t));
    const missingTriggers = EXPECTED_TRIGGERS.filter((t) => !actualTriggerNames.includes(t));

    console.log('=== Cloud MySQL Post-Import Verification ===');
    console.log(`Tables (${actualTableNames.length}/${EXPECTED_TABLES.length}): ${actualTableNames.join(', ')}`);
    console.log(`Foreign keys: ${fkCount}/${EXPECTED_FOREIGN_KEYS}`);
    console.log(`Triggers (${actualTriggerNames.length}/${EXPECTED_TRIGGERS.length}): ${actualTriggerNames.join(', ')}`);
    console.log('AUTO_INCREMENT values:', JSON.stringify(autoIncrementMap, null, 2));
    console.log('Row counts (all tables):', JSON.stringify(rowCounts, null, 2));

    const verificationFailures = [];
    if (missingTables.length > 0 || actualTableNames.length !== EXPECTED_TABLES.length) {
      verificationFailures.push(
        `Table mismatch: found ${actualTableNames.length}, missing [${missingTables.join(', ')}]`
      );
    }
    if (fkCount !== EXPECTED_FOREIGN_KEYS) {
      verificationFailures.push(`Foreign key count mismatch: found ${fkCount}, expected ${EXPECTED_FOREIGN_KEYS}`);
    }
    if (missingTriggers.length > 0 || actualTriggerNames.length !== EXPECTED_TRIGGERS.length) {
      verificationFailures.push(
        `Trigger mismatch: found ${actualTriggerNames.length}, missing [${missingTriggers.join(', ')}]`
      );
    }

    if (verificationFailures.length > 0) {
      throw new Error(`Post-import verification failed: ${verificationFailures.join('; ')}`);
    }

    console.log('Cloud MySQL import and verification completed successfully!');
  } finally {
    try {
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (_) {
      // Ignore cleanup error if connection already closed
    }
    await conn.end();
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const isDryRun =
    args.includes('--dry-run') ||
    String(process.env.DRY_RUN || '').toLowerCase() === 'true';
  const pathArg = args.find((a) => !a.startsWith('--'));
  const backupPath = resolveBackupPath(pathArg);

  if (isDryRun) {
    runDryRun(backupPath);
  } else {
    runImport(backupPath).catch((err) => {
      console.error('Cloud MySQL import failed:', err.message || err.code);
      process.exit(1);
    });
  }
}

module.exports = {
  EXPECTED_TABLES,
  EXPECTED_FOREIGN_KEYS,
  EXPECTED_TRIGGERS,
  assertSafeCloudHost,
  describeSqlStatement,
  normalizeStatementForMySQL8,
  parseAndNormalizeSqlDump,
  analyzeParsedDump,
};
