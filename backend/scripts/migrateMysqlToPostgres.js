/**
 * Safe MySQL (XAMPP) -> PostgreSQL Data Migration Script (Phase 3)
 *
 * Source:      MySQL (`campus_assistant_db_v2`, strictly READ-ONLY session)
 * Destination: PostgreSQL (`campus_assistant_pg`, single atomic transaction)
 *
 * Guarantees:
 *   1. Sets MySQL session to READ ONLY (`SET SESSION TRANSACTION READ ONLY`) so
 *      the source XAMPP database can never be modified.
 *   2. Verifies all 14 target PostgreSQL tables exist and are completely empty
 *      before writing a single row (never silently overwrites or skips records).
 *   3. Copies all 14 tables in strict parent-before-child foreign-key order.
 *   4. Preserves exact primary key IDs, bcrypt hashes, NULL values, dates, times,
 *      timestamps (using MySQL `dateStrings: true`), decimals, and relationships.
 *   5. Strictly converts MySQL 0/1 values into PostgreSQL BOOLEAN for all 7
 *      `is_demo` columns.
 *   6. Executes the entire migration inside one PostgreSQL transaction
 *      (`BEGIN` ... `COMMIT`), rolling back completely on ANY error or count mismatch.
 *   7. Synchronizes all 14 PostgreSQL identity sequences via `setval()`.
 *   8. Reports exact before/after row counts across all 14 tables, role totals,
 *      and sequence states.
 *
 * Offline Plan & Schema Parity Check (no DB connection, no `pg` required):
 *   node backend/scripts/migrateMysqlToPostgres.js --plan
 *
 * Live Migration (only after installing `pg` and explicit approval):
 *   PG_HOST=localhost PG_PORT=5432 PG_USER=postgres PG_PASSWORD=... PG_DATABASE=campus_assistant_pg \
 *   node backend/scripts/migrateMysqlToPostgres.js
 */

const fs = require('fs');
const path = require('path');

/**
 * All 14 tables in strict parent-before-child foreign-key order.
 * Every column list matches database/schema.postgres.sql 1-to-1.
 */
const MIGRATION_TABLES = [
  {
    name: 'departments',
    columns: ['id', 'code', 'name', 'description', 'status', 'created_at', 'updated_at'],
    booleanColumns: [],
    dateLikeColumns: ['created_at', 'updated_at'],
  },
  {
    name: 'faculty',
    columns: [
      'id', 'name', 'department', 'designation', 'email', 'phone',
      'office_location', 'consultation_hours', 'is_demo', 'created_at', 'updated_at',
    ],
    booleanColumns: ['is_demo'],
    dateLikeColumns: ['created_at', 'updated_at'],
  },
  {
    name: 'facilities',
    columns: [
      'id', 'name', 'category', 'description', 'location', 'opening_hours',
      'contact_info', 'status', 'is_demo', 'created_at', 'updated_at',
    ],
    booleanColumns: ['is_demo'],
    dateLikeColumns: ['created_at', 'updated_at'],
  },
  {
    name: 'users',
    columns: [
      'id', 'name', 'email', 'password_hash', 'role', 'student_id', 'employee_id',
      'faculty_id', 'department', 'semester', 'section', 'status', 'created_at', 'updated_at',
    ],
    booleanColumns: [],
    dateLikeColumns: ['created_at', 'updated_at'],
  },
  {
    name: 'subjects',
    columns: [
      'id', 'code', 'name', 'department_id', 'department', 'semester',
      'credits', 'status', 'is_demo', 'created_at', 'updated_at',
    ],
    booleanColumns: ['is_demo'],
    dateLikeColumns: ['created_at', 'updated_at'],
  },
  {
    name: 'teacher_assignments',
    columns: [
      'id', 'teacher_id', 'subject_id', 'department', 'semester', 'section',
      'academic_year', 'assigned_by', 'status', 'created_at', 'updated_at',
    ],
    booleanColumns: [],
    dateLikeColumns: ['created_at', 'updated_at'],
  },
  {
    name: 'timetable',
    columns: [
      'id', 'department', 'semester', 'section', 'subject', 'faculty_id',
      'day_of_week', 'start_time', 'end_time', 'classroom', 'status',
      'is_demo', 'created_at', 'updated_at',
    ],
    booleanColumns: ['is_demo'],
    dateLikeColumns: ['start_time', 'end_time', 'created_at', 'updated_at'],
  },
  {
    name: 'notices',
    columns: [
      'id', 'title', 'description', 'category', 'target_department', 'priority',
      'status', 'is_demo', 'posted_by', 'published_date', 'created_at', 'updated_at',
    ],
    booleanColumns: ['is_demo'],
    dateLikeColumns: ['published_date', 'created_at', 'updated_at'],
  },
  {
    name: 'events',
    columns: [
      'id', 'title', 'description', 'category', 'target_department',
      'semester_eligibility', 'event_date', 'event_time', 'venue', 'organizer',
      'registration_details', 'image_url', 'registration_link', 'status',
      'is_demo', 'created_by', 'created_at', 'updated_at',
    ],
    booleanColumns: ['is_demo'],
    dateLikeColumns: ['event_date', 'event_time', 'created_at', 'updated_at'],
  },
  {
    name: 'exams',
    columns: [
      'id', 'title', 'exam_type', 'department', 'semester', 'section',
      'academic_year', 'instructions', 'status', 'is_demo', 'created_by',
      'created_at', 'updated_at',
    ],
    booleanColumns: ['is_demo'],
    dateLikeColumns: ['created_at', 'updated_at'],
  },
  {
    name: 'exam_subjects',
    columns: [
      'id', 'exam_id', 'subject_id', 'exam_date', 'start_time', 'end_time',
      'max_marks', 'passing_marks', 'room', 'instructions', 'status',
      'created_at', 'updated_at',
    ],
    booleanColumns: [],
    dateLikeColumns: ['exam_date', 'start_time', 'end_time', 'created_at', 'updated_at'],
  },
  {
    name: 'marks',
    columns: [
      'id', 'exam_subject_id', 'student_id', 'subject_id', 'entered_by',
      'obtained_marks', 'max_marks', 'remarks', 'submission_status',
      'submitted_at', 'reviewed_by', 'reviewed_at', 'review_notes',
      'created_at', 'updated_at',
    ],
    booleanColumns: [],
    dateLikeColumns: ['submitted_at', 'reviewed_at', 'created_at', 'updated_at'],
  },
  {
    name: 'results',
    columns: [
      'id', 'exam_id', 'student_id', 'total_obtained', 'total_max', 'percentage',
      'grade', 'pass_status', 'publish_status', 'published_by', 'published_at',
      'created_at', 'updated_at',
    ],
    booleanColumns: [],
    dateLikeColumns: ['published_at', 'created_at', 'updated_at'],
  },
  {
    name: 'chatbot_logs',
    columns: ['id', 'user_id', 'user_question', 'ai_response', 'created_at'],
    booleanColumns: [],
    dateLikeColumns: ['created_at'],
  },
];

const EXPECTED_MYSQL_DATABASE = 'campus_assistant_db_v2';
const EXPECTED_PG_DATABASE = 'campus_assistant_pg';
const FORBIDDEN_PG_DATABASES = new Set(['postgres', 'template0', 'template1']);
const EXPECTED_FOREIGN_KEYS = 20;
const EXPECTED_TRIGGERS = 15; // 13 updated_at triggers + 2 timetable overlap triggers

/**
 * Strictly validates source MySQL and destination PostgreSQL database names.
 * No override flag is allowed to bypass these checks.
 */
function assertSafeDatabaseNames(mysqlDatabase, pgDatabase) {
  const srcDb = String(mysqlDatabase || '').trim();
  const dstDb = String(pgDatabase || '').trim();

  if (srcDb !== EXPECTED_MYSQL_DATABASE) {
    throw new Error(
      `Refusing to run migration: source MySQL database must be exactly "${EXPECTED_MYSQL_DATABASE}" (got "${srcDb || '(empty)'}").`
    );
  }

  if (FORBIDDEN_PG_DATABASES.has(dstDb.toLowerCase())) {
    throw new Error(
      `Refusing to run migration: PostgreSQL system database "${dstDb}" is strictly forbidden as a destination.`
    );
  }

  if (dstDb !== EXPECTED_PG_DATABASE) {
    throw new Error(
      `Refusing to run migration: destination PostgreSQL database must be exactly "${EXPECTED_PG_DATABASE}" (got "${dstDb || '(empty)'}").`
    );
  }
}

/**
 * Extracts the database name from a PostgreSQL connection string without exposing credentials.
 */
function extractPgDatabaseFromConnectionString(connStr) {
  let parsed;
  try {
    parsed = new URL(connStr);
  } catch {
    throw new Error('Invalid PG_CONNECTION_STRING format.');
  }
  return decodeURIComponent((parsed.pathname || '').replace(/^\/+/, ''));
}

/**
 * Strictly converts a MySQL TINYINT(1) boolean value (0/1) to JS boolean.
 * Throws on invalid/unexpected values rather than silently coercing.
 */
function convertMysqlTinyintToBoolean(value, tableName, columnName, rowId) {
  if (value === 1 || value === '1' || value === true) return true;
  if (value === 0 || value === '0' || value === false) return false;
  if (Buffer.isBuffer(value) && value.length === 1) {
    if (value[0] === 1) return true;
    if (value[0] === 0) return false;
  }
  throw new Error(
    `Invalid boolean value for ${tableName}.${columnName} (row id=${rowId}): ${JSON.stringify(value)}`
  );
}

/**
 * Validates verbatim MySQL date/timestamp strings and rejects MySQL zero-dates
 * (e.g., '0000-00-00') that PostgreSQL cannot represent.
 */
function normalizeDateLikeValue(value, tableName, columnName, rowId) {
  if (value === null || value === undefined) return null;
  const str = String(value);
  if (str.startsWith('0000-00-00')) {
    throw new Error(
      `Unsupported MySQL zero-date "${str}" in ${tableName}.${columnName} (row id=${rowId}).`
    );
  }
  return str;
}

/**
 * Transforms a single MySQL row object into an ordered parameter array matching `tableSpec.columns`.
 */
function transformRowForPostgres(row, tableSpec) {
  const boolSet = new Set(tableSpec.booleanColumns);
  const dateSet = new Set(tableSpec.dateLikeColumns);

  return tableSpec.columns.map((col) => {
    const val = row[col];
    if (val === undefined || val === null) {
      return null;
    }
    if (boolSet.has(col)) {
      return convertMysqlTinyintToBoolean(val, tableSpec.name, col, row.id);
    }
    if (dateSet.has(col)) {
      return normalizeDateLikeValue(val, tableSpec.name, col, row.id);
    }
    return val;
  });
}

/**
 * Computes a safe PostgreSQL batch size well under the 65,535 bind-parameter wire limit.
 */
function getSafeBatchSize(columnCount) {
  return Math.max(1, Math.min(500, Math.floor(60000 / columnCount)));
}

/**
 * Inserts transformed rows into PostgreSQL in parameterized batches.
 * Fails immediately on any constraint, type, or trigger violation.
 */
async function batchInsertPostgres(pgClient, tableSpec, mysqlRows) {
  if (mysqlRows.length === 0) {
    return 0;
  }

  const colCount = tableSpec.columns.length;
  const batchSize = getSafeBatchSize(colCount);
  const columnListSql = tableSpec.columns.map((c) => `"${c}"`).join(', ');
  let totalInserted = 0;

  for (let start = 0; start < mysqlRows.length; start += batchSize) {
    const slice = mysqlRows.slice(start, start + batchSize);
    const params = [];
    const valueTuples = [];

    for (let r = 0; r < slice.length; r += 1) {
      const values = transformRowForPostgres(slice[r], tableSpec);
      const placeholders = [];
      for (let c = 0; c < colCount; c += 1) {
        params.push(values[c]);
        placeholders.push(`$${params.length}`);
      }
      valueTuples.push(`(${placeholders.join(', ')})`);
    }

    const sql = `INSERT INTO public."${tableSpec.name}" (${columnListSql}) VALUES ${valueTuples.join(', ')}`;
    try {
      const res = await pgClient.query(sql, params);
      if (res.rowCount !== slice.length) {
        throw new Error(
          `Row count mismatch during insert into ${tableSpec.name}: expected ${slice.length}, inserted ${res.rowCount}.`
        );
      }
      totalInserted += res.rowCount;
    } catch (err) {
      const firstId = slice[0] ? slice[0].id : 'unknown';
      const lastId = slice[slice.length - 1] ? slice[slice.length - 1].id : 'unknown';
      const wrapped = new Error(
        `PostgreSQL insert failed for table "${tableSpec.name}" ` +
          `(batch rows ${start + 1}-${start + slice.length}, id range ${firstId}..${lastId}): ` +
          `${err.code || 'PG_ERROR'} - ${err.message}`
      );
      wrapped.code = err.code;
      throw wrapped;
    }
  }

  return totalInserted;
}

/**
 * Synchronizes a table's IDENTITY sequence to match its migrated MAX(id).
 * Runs ONLY AFTER PostgreSQL COMMIT because sequence operations are non-transactional.
 */
async function syncIdentitySequence(pgClient, tableName) {
  const qualifiedTable = `public.${tableName}`;
  const seqNameRes = await pgClient.query(
    `SELECT pg_get_serial_sequence($1, 'id') AS seq_name`,
    [qualifiedTable]
  );
  const sequenceName = seqNameRes.rows[0] ? seqNameRes.rows[0].seq_name : null;

  if (!sequenceName) {
    throw new Error(
      `pg_get_serial_sequence('${qualifiedTable}', 'id') returned NULL. Identity sequence was not found.`
    );
  }

  const { rows } = await pgClient.query(
    `SELECT COUNT(*)::int AS cnt, MAX(id)::int AS max_id FROM public."${tableName}"`
  );
  const count = rows[0].cnt;
  const maxId = rows[0].max_id;

  if (count > 0 && maxId !== null) {
    const seqRes = await pgClient.query(
      `SELECT setval($1::regclass, $2, true) AS last_val`,
      [sequenceName, maxId]
    );
    return {
      table: tableName,
      sequenceName,
      maxId,
      sequenceLastValue: Number(seqRes.rows[0].last_val),
      nextId: Number(seqRes.rows[0].last_val) + 1,
    };
  }

  const seqRes = await pgClient.query(
    `SELECT setval($1::regclass, 1, false) AS last_val`,
    [sequenceName]
  );
  return {
    table: tableName,
    sequenceName,
    maxId: null,
    sequenceLastValue: Number(seqRes.rows[0].last_val),
    nextId: 1,
  };
}

/**
 * Offline validation mode: verifies MIGRATION_TABLES against database/schema.postgres.sql
 * with ZERO database connections and ZERO external dependencies required.
 */
function runOfflinePlanCheck() {
  const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.postgres.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error(`PostgreSQL schema file not found at: ${schemaPath}`);
    process.exit(1);
  }

  const pgSql = fs.readFileSync(schemaPath, 'utf8');
  const schemaTables = {};
  const schemaOrder = [];
  const tableRegex = /CREATE TABLE IF NOT EXISTS ([a-z_]+)\s*\(([\s\S]*?)\n\);/g;
  let match;

  while ((match = tableRegex.exec(pgSql)) !== null) {
    const tbl = match[1];
    schemaOrder.push(tbl);
    const cols = [];
    for (const line of match[2].split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || /^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK|\)|--)/i.test(trimmed)) continue;
      const colMatch = trimmed.match(
        /^([a-z_]+)\s+(INTEGER|SMALLINT|VARCHAR|TEXT|BOOLEAN|TIMESTAMP|DATE|TIME|NUMERIC)\b/i
      );
      if (colMatch) {
        cols.push({ name: colMatch[1], type: colMatch[2].toUpperCase() });
      }
    }
    schemaTables[tbl] = cols;
  }

  const errors = [];
  if (MIGRATION_TABLES.length !== schemaOrder.length) {
    errors.push(
      `Table count mismatch: script has ${MIGRATION_TABLES.length}, schema.postgres.sql has ${schemaOrder.length}.`
    );
  }

  for (let idx = 0; idx < MIGRATION_TABLES.length; idx += 1) {
    const spec = MIGRATION_TABLES[idx];
    if (schemaOrder[idx] !== spec.name) {
      errors.push(
        `Table order mismatch at #${idx + 1}: script="${spec.name}", schema="${schemaOrder[idx]}".`
      );
    }

    const schemaCols = schemaTables[spec.name];
    if (!schemaCols) {
      errors.push(`Table "${spec.name}" missing from schema.postgres.sql.`);
      continue;
    }

    const schemaColNames = schemaCols.map((c) => c.name);
    if (JSON.stringify(spec.columns) !== JSON.stringify(schemaColNames)) {
      errors.push(
        `Column mismatch for "${spec.name}": script=[${spec.columns.join(', ')}] vs schema=[${schemaColNames.join(', ')}]`
      );
    }

    const schemaBoolCols = schemaCols.filter((c) => c.type === 'BOOLEAN').map((c) => c.name);
    if (JSON.stringify(spec.booleanColumns) !== JSON.stringify(schemaBoolCols)) {
      errors.push(
        `BOOLEAN column mismatch for "${spec.name}": script=[${spec.booleanColumns.join(', ')}] vs schema=[${schemaBoolCols.join(', ')}]`
      );
    }
  }

  console.log('=== Offline MySQL -> PostgreSQL Migration Plan Check ===');
  console.log(`Schema reference: ${schemaPath}`);
  console.log(`Tables in parent-before-child order (${MIGRATION_TABLES.length}/14):`);
  for (let i = 0; i < MIGRATION_TABLES.length; i += 1) {
    const t = MIGRATION_TABLES[i];
    const batch = getSafeBatchSize(t.columns.length);
    console.log(
      `  ${String(i + 1).padStart(2, ' ')}. ${t.name} (${t.columns.length} cols, batch=${batch}, booleans=[${t.booleanColumns.join(', ') || 'none'}])`
    );
  }
  console.log(`Errors: ${errors.length}`);
  if (errors.length > 0) {
    for (const e of errors) console.error(`  - [ERROR] ${e}`);
    process.exit(1);
  }
  console.log('OFFLINE PLAN CHECK PASSED: 100% table, column, order, and BOOLEAN alignment. No DB connection was made.');
}

function buildPgSslConfig() {
  if (String(process.env.PG_SSL || '').toLowerCase() !== 'true') {
    return undefined;
  }
  const rejectUnauthorized =
    String(process.env.PG_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false';
  const ssl = { rejectUnauthorized };
  if (process.env.PG_SSL_CA) {
    const rawCa = process.env.PG_SSL_CA.trim();
    ssl.ca = rawCa.includes('BEGIN CERTIFICATE')
      ? rawCa.replace(/\\n/g, '\n')
      : fs.readFileSync(rawCa, 'utf8');
  }
  return ssl;
}

async function runMigration() {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.join(__dirname, '..', '.env') });

  let mysql;
  let Client;
  try {
    mysql = require('mysql2/promise');
  } catch {
    throw new Error('Missing package "mysql2". Run "npm --prefix backend install" first.');
  }
  try {
    ({ Client } = require('pg'));
  } catch {
    throw new Error(
      'Missing PostgreSQL driver "pg". Install it with "npm --prefix backend install pg" before executing this migration.'
    );
  }

  const mysqlConfig = {
    host: process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306),
    user: process.env.MYSQL_USER || process.env.DB_USER || 'root',
    password:
      process.env.MYSQL_PASSWORD !== undefined
        ? process.env.MYSQL_PASSWORD
        : process.env.DB_PASSWORD ?? '',
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'campus_assistant_db_v2',
    dateStrings: true, // Preserve exact DATE, TIME, DATETIME, TIMESTAMP strings without JS Date timezone shifts
    decimalNumbers: false, // Preserve exact DECIMAL strings without float rounding
  };

  const pgRequired = ['PG_USER', 'PG_PASSWORD', 'PG_DATABASE'];
  const pgMissing = pgRequired.filter((k) => process.env[k] === undefined || process.env[k] === '');
  if (pgMissing.length > 0 && !process.env.PG_CONNECTION_STRING) {
    throw new Error(
      `Missing required PostgreSQL environment variable(s): ${pgMissing.join(', ')} (or set PG_CONNECTION_STRING).`
    );
  }

  const pgTargetDatabase = process.env.PG_CONNECTION_STRING
    ? extractPgDatabaseFromConnectionString(process.env.PG_CONNECTION_STRING)
    : process.env.PG_DATABASE;

  // Enforce strict source & destination database names before opening any connection (no override)
  assertSafeDatabaseNames(mysqlConfig.database, pgTargetDatabase);

  const pgConfig = process.env.PG_CONNECTION_STRING
    ? {
        connectionString: process.env.PG_CONNECTION_STRING,
        ssl: buildPgSslConfig(),
      }
    : {
        host: process.env.PG_HOST || 'localhost',
        port: Number(process.env.PG_PORT || 5432),
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: pgTargetDatabase,
        ssl: buildPgSslConfig(),
      };

  let mysqlConn = null;
  let pgClient = null;
  let inMysqlReadTx = false;
  let inPgTransaction = false;
  let pgDataCommitted = false;

  try {
    // Open MySQL connection inside try and immediately enforce engine-level READ ONLY + consistent snapshot
    mysqlConn = await mysql.createConnection(mysqlConfig);
    await mysqlConn.query('SET SESSION TRANSACTION READ ONLY');
    await mysqlConn.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    inMysqlReadTx = true;

    // Open PostgreSQL connection inside try so finally always closes mysqlConn if pgClient.connect() fails
    pgClient = new Client(pgConfig);
    await pgClient.connect();

    // Double-check active server-reported database names before reading or writing any table
    const [activeMysqlRows] = await mysqlConn.query('SELECT DATABASE() AS db');
    const { rows: activePgRows } = await pgClient.query('SELECT current_database() AS db');
    assertSafeDatabaseNames(activeMysqlRows[0]?.db, activePgRows[0]?.db);

    console.log(
      `Connected read-only (consistent snapshot) to MySQL (${mysqlConfig.host}:${mysqlConfig.port}/${activeMysqlRows[0].db}).`
    );
    console.log(
      `Connected to PostgreSQL (${pgConfig.host || 'connectionString'}:${pgConfig.port || 5432}/${activePgRows[0].db}).`
    );

    // 1. Verify all 14 target PostgreSQL tables exist
    const { rows: pgTableRows } = await pgClient.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );
    const pgTableSet = new Set(pgTableRows.map((r) => r.table_name));
    const missingTables = MIGRATION_TABLES.map((t) => t.name).filter((t) => !pgTableSet.has(t));
    if (missingTables.length > 0) {
      throw new Error(
        `Destination PostgreSQL database is missing required table(s): ${missingTables.join(', ')}. Apply database/schema.postgres.sql first.`
      );
    }

    // 2. Capture row counts BEFORE migration (within the consistent read-only MySQL snapshot)
    const mysqlCounts = {};
    const pgCountsBefore = {};
    const nonEmptyPgTables = [];

    for (const tableSpec of MIGRATION_TABLES) {
      const [mRows] = await mysqlConn.query(
        `SELECT COUNT(*) AS cnt FROM \`${tableSpec.name}\``
      );
      mysqlCounts[tableSpec.name] = Number(mRows[0].cnt);

      const { rows: pRows } = await pgClient.query(
        `SELECT COUNT(*)::int AS cnt FROM public."${tableSpec.name}"`
      );
      pgCountsBefore[tableSpec.name] = pRows[0].cnt;
      if (pRows[0].cnt > 0) {
        nonEmptyPgTables.push(`${tableSpec.name} (${pRows[0].cnt} rows)`);
      }
    }

    console.log('\n=== Row Counts BEFORE Migration ===');
    for (const tableSpec of MIGRATION_TABLES) {
      console.log(
        `  ${tableSpec.name.padEnd(22)} MySQL=${String(mysqlCounts[tableSpec.name]).padStart(6)} | PostgreSQL(before)=${pgCountsBefore[tableSpec.name]}`
      );
    }

    if (nonEmptyPgTables.length > 0) {
      throw new Error(
        `Aborting migration: destination PostgreSQL tables are NOT empty: ${nonEmptyPgTables.join(', ')}. ` +
          'This script refuses to overwrite or duplicate existing data.'
      );
    }

    // 3. Begin single atomic PostgreSQL transaction for all 14 table inserts & pre-COMMIT checks
    await pgClient.query('BEGIN');
    inPgTransaction = true;

    const insertedCounts = {};
    for (const tableSpec of MIGRATION_TABLES) {
      const selectCols = tableSpec.columns.map((c) => `\`${c}\``).join(', ');
      const [sourceRows] = await mysqlConn.query(
        `SELECT ${selectCols} FROM \`${tableSpec.name}\` ORDER BY id ASC`
      );

      if (sourceRows.length !== mysqlCounts[tableSpec.name]) {
        throw new Error(
          `Source count changed during read for "${tableSpec.name}" (expected ${mysqlCounts[tableSpec.name]}, read ${sourceRows.length}). Aborting for consistency.`
        );
      }

      const inserted = await batchInsertPostgres(pgClient, tableSpec, sourceRows);
      insertedCounts[tableSpec.name] = inserted;
      console.log(`  Migrated ${tableSpec.name.padEnd(22)} -> ${inserted} row(s)`);
    }

    // 4. Verify exact row-count parity, role totals, FKs, and triggers BEFORE COMMIT
    const pgCountsAfter = {};
    const mismatches = [];
    for (const tableSpec of MIGRATION_TABLES) {
      const { rows: pRows } = await pgClient.query(
        `SELECT COUNT(*)::int AS cnt FROM public."${tableSpec.name}"`
      );
      pgCountsAfter[tableSpec.name] = pRows[0].cnt;
      if (pgCountsAfter[tableSpec.name] !== mysqlCounts[tableSpec.name]) {
        mismatches.push(
          `${tableSpec.name}: MySQL=${mysqlCounts[tableSpec.name]} vs PostgreSQL=${pgCountsAfter[tableSpec.name]}`
        );
      }
    }

    if (mismatches.length > 0) {
      throw new Error(`Row count parity check failed: ${mismatches.join('; ')}`);
    }

    // Verify users role distribution matches identically (still inside consistent MySQL snapshot)
    const [mysqlRoles] = await mysqlConn.query(
      'SELECT role, COUNT(*) AS cnt FROM users GROUP BY role ORDER BY role'
    );
    const { rows: pgRoles } = await pgClient.query(
      'SELECT role, COUNT(*)::int AS cnt FROM public.users GROUP BY role ORDER BY role'
    );
    const formatRoleCounts = (rows) =>
      [...rows]
        .map((r) => ({
          role: String(r.role),
          cnt: Number(r.cnt),
        }))
        .sort((a, b) =>
          a.role < b.role ? -1 : a.role > b.role ? 1 : 0
        )
        .map((r) => `${r.role}:${r.cnt}`)
        .join(', ');

    const normMysqlRoles = formatRoleCounts(mysqlRoles);
    const normPgRoles = formatRoleCounts(pgRoles);
    if (normMysqlRoles !== normPgRoles) {
      throw new Error(
        `Users role breakdown mismatch: MySQL=[${normMysqlRoles}] vs PostgreSQL=[${normPgRoles}]`
      );
    }

    // All MySQL source reads are complete — commit the read-only MySQL snapshot transaction
    await mysqlConn.query('COMMIT');
    inMysqlReadTx = false;

    // Verify PostgreSQL schema constraints & triggers are intact
    const { rows: fkRows } = await pgClient.query(
      `SELECT COUNT(*)::int AS cnt
       FROM information_schema.table_constraints
       WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY'`
    );
    const { rows: trigRows } = await pgClient.query(
      `SELECT COUNT(*)::int AS cnt
       FROM information_schema.triggers
       WHERE trigger_schema = 'public'`
    );

    if (fkRows[0].cnt !== EXPECTED_FOREIGN_KEYS) {
      throw new Error(
        `Expected ${EXPECTED_FOREIGN_KEYS} PostgreSQL foreign keys, found ${fkRows[0].cnt}.`
      );
    }
    if (trigRows[0].cnt < EXPECTED_TRIGGERS) {
      throw new Error(
        `Expected at least ${EXPECTED_TRIGGERS} PostgreSQL triggers, found ${trigRows[0].cnt}.`
      );
    }

    // 5. Commit all migrated rows in PostgreSQL
    await pgClient.query('COMMIT');
    inPgTransaction = false;
    pgDataCommitted = true;

    // 6. Synchronize all 14 PostgreSQL identity sequences IMMEDIATELY AFTER COMMIT
    // (Sequence setval() is non-transactional in PostgreSQL, so it runs only once data is committed.)
    const sequenceSummary = [];
    try {
      for (const tableSpec of MIGRATION_TABLES) {
        const seqInfo = await syncIdentitySequence(pgClient, tableSpec.name);
        sequenceSummary.push(seqInfo);
      }
    } catch (seqErr) {
      const postCommitError = new Error(
        `CRITICAL POST-COMMIT NOTICE: All 14 tables HAVE ALREADY BEEN COMMITTED to "${EXPECTED_PG_DATABASE}" ` +
          '(data was NOT rolled back). Do NOT re-run the full data import automatically. ' +
          `Identity sequence synchronization failed after COMMIT: ${seqErr.message}`
      );
      postCommitError.postCommitSequenceError = true;
      throw postCommitError;
    }

    console.log('\n=== Row Counts AFTER Migration (COMMITTED) ===');
    for (const tableSpec of MIGRATION_TABLES) {
      console.log(
        `  ${tableSpec.name.padEnd(22)} MySQL=${String(mysqlCounts[tableSpec.name]).padStart(6)} | PG(before)=${String(pgCountsBefore[tableSpec.name]).padStart(2)} | PG(after)=${String(pgCountsAfter[tableSpec.name]).padStart(6)} | MATCH`
      );
    }
    console.log(`\nUsers by role: ${normPgRoles}`);
    console.log(`PostgreSQL Foreign Keys verified: ${fkRows[0].cnt}/${EXPECTED_FOREIGN_KEYS}`);
    console.log(`PostgreSQL Triggers verified: ${trigRows[0].cnt}`);
    console.log('\n=== Identity Sequences Synchronized (Post-COMMIT) ===');
    for (const s of sequenceSummary) {
      console.log(
        `  ${s.table.padEnd(22)} (${s.sequenceName}) max_id=${String(s.maxId ?? 'empty').padStart(6)} -> next_id=${s.nextId}`
      );
    }
    console.log('\nMIGRATION SUCCEEDED: All 14 tables migrated, committed, and sequences synchronized cleanly.');
  } catch (err) {
    if (inMysqlReadTx && mysqlConn) {
      try {
        await mysqlConn.query('ROLLBACK');
        inMysqlReadTx = false;
      } catch (myRbErr) {
        console.error('MySQL read-only transaction rollback error:', myRbErr.message);
      }
    }

    if (inPgTransaction && pgClient && !pgDataCommitted) {
      try {
        await pgClient.query('ROLLBACK');
        inPgTransaction = false;
        console.error('PostgreSQL transaction ROLLED BACK cleanly. Destination database remains empty.');
      } catch (rbErr) {
        console.error('PostgreSQL rollback error:', rbErr.message);
      }
    } else if (pgDataCommitted) {
      console.error(
        `NOTE: Data in "${EXPECTED_PG_DATABASE}" was ALREADY COMMITTED before this error occurred and was NOT rolled back. Do not re-run the import automatically.`
      );
    }

    throw err;
  } finally {
    if (mysqlConn) {
      await mysqlConn.end().catch(() => {});
    }
    if (pgClient) {
      await pgClient.end().catch(() => {});
    }
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--plan') || args.includes('--check')) {
    runOfflinePlanCheck();
  } else {
    runMigration().catch((err) => {
      console.error('Migration failed:', err.message || err.code);
      process.exit(1);
    });
  }
}

module.exports = {
  EXPECTED_MYSQL_DATABASE,
  EXPECTED_PG_DATABASE,
  FORBIDDEN_PG_DATABASES,
  MIGRATION_TABLES,
  assertSafeDatabaseNames,
  extractPgDatabaseFromConnectionString,
  convertMysqlTinyintToBoolean,
  normalizeDateLikeValue,
  transformRowForPostgres,
  getSafeBatchSize,
  syncIdentitySequence,
};
