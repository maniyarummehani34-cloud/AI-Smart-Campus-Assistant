/**
 * Safe Cloud MySQL Migration & Verification Script (Phase 3 Helper)
 *
 * Imports a verified local SQL dump into a hosted MySQL database (e.g., Aiven)
 * over SSL while stripping incompatible local DEFINER clauses so triggers,
 * foreign keys, indexes, and all 14 tables transfer cleanly.
 *
 * Does NOT run automatically and never stores cloud credentials in code.
 * Supply target credentials via temporary local environment variables when ready:
 *   CLOUD_DB_HOST, CLOUD_DB_PORT, CLOUD_DB_USER, CLOUD_DB_PASSWORD,
 *   CLOUD_DB_NAME, CLOUD_DB_SSL_CA (optional PEM path or inline PEM),
 *   BACKUP_SQL_PATH (defaults to database/backups/campus_assistant_db_v2_deploy_backup.sql)
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function sanitizeDumpForCloudMySQL(rawSql) {
  return rawSql
    // Strip MariaDB-only executable comments and local DEFINER clauses
    .replace(/DEFINER=`[^`]+`@`[^`]+`\s*/g, '')
    .replace(/\/\*!50013 DEFINER=[^*]+\*\//g, '')
    .replace(/\/\*M![^*]*\*\//g, '')
    // Ensure UTF8MB4 collation compatible across MariaDB and MySQL 8
    .replace(/utf8mb4_0900_ai_ci/g, 'utf8mb4_unicode_ci');
}

async function runImport() {
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

  const backupPath =
    process.env.BACKUP_SQL_PATH ||
    path.join(
      __dirname,
      '..',
      '..',
      'database',
      'backups',
      'campus_assistant_db_v2_deploy_backup.sql'
    );

  if (!fs.existsSync(backupPath)) {
    console.error(`Backup SQL file not found at: ${backupPath}`);
    process.exit(1);
  }

  const rawSql = fs.readFileSync(backupPath, 'utf8');
  const cloudSql = sanitizeDumpForCloudMySQL(rawSql);

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

  const conn = await mysql.createConnection({
    host: process.env.CLOUD_DB_HOST,
    port: Number(process.env.CLOUD_DB_PORT),
    user: process.env.CLOUD_DB_USER,
    password: process.env.CLOUD_DB_PASSWORD,
    database: process.env.CLOUD_DB_NAME,
    ssl,
    multipleStatements: true,
  });

  try {
    console.log('Connected to hosted MySQL over SSL. Importing schema, data, FKs, and triggers...');
    await conn.query(cloudSql);

    const [tables] = await conn.query('SHOW TABLES');
    const [triggers] = await conn.query('SHOW TRIGGERS');
    const [fks] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.TABLE_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_TYPE = 'FOREIGN KEY'`
    );
    const [counts] = await conn.query(
      `SELECT
         (SELECT COUNT(*) FROM users) AS users,
         (SELECT COUNT(*) FROM departments) AS departments,
         (SELECT COUNT(*) FROM subjects) AS subjects,
         (SELECT COUNT(*) FROM exams) AS exams,
         (SELECT COUNT(*) FROM marks) AS marks,
         (SELECT COUNT(*) FROM results) AS results,
         (SELECT COUNT(*) FROM notices) AS notices,
         (SELECT COUNT(*) FROM events) AS events`
    );

    console.log('Cloud MySQL import verified successfully!');
    console.log('Tables:', tables.length);
    console.log('Foreign keys:', Number(fks[0].cnt));
    console.log('Triggers:', triggers.length, triggers.map((t) => t.Trigger));
    console.log('Row counts:', JSON.stringify(counts[0], null, 2));
  } finally {
    await conn.end();
  }
}

runImport().catch((err) => {
  console.error('Cloud MySQL import failed:', err.code || err.message);
  process.exit(1);
});
