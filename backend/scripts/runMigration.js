/**
 * Safe SQL Migration Runner for campus_assistant_db_v2
 * Reads and executes database/migrations/001_upgrade_roles_exams_events.sql
 * without overwriting database/schema.sql or deleting existing records.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

function buildSslConfig() {
  if (String(process.env.DB_SSL || '').toLowerCase() !== 'true') {
    return undefined;
  }

  const rejectUnauthorized =
    String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !==
    'false';

  const sslConfig = { rejectUnauthorized };

  if (process.env.DB_SSL_CA) {
    const rawCa = process.env.DB_SSL_CA.trim();
    if (rawCa.includes('BEGIN CERTIFICATE')) {
      sslConfig.ca = rawCa.replace(/\\n/g, '\n');
    } else if (fs.existsSync(rawCa)) {
      sslConfig.ca = fs.readFileSync(rawCa, 'utf8');
    }
  }

  return sslConfig;
}

async function runMigration() {
  const migrationPath = path.join(
    __dirname,
    '..',
    '..',
    'database',
    'migrations',
    '001_upgrade_roles_exams_events.sql'
  );

  const sql = fs.readFileSync(migrationPath, 'utf8');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME,
    ssl: buildSslConfig(),
    multipleStatements: true,
  });

  try {
    await conn.query(sql);
    const [tables] = await conn.query('SHOW TABLES');
    const [users] = await conn.query(
      'SELECT id, name, role, department, semester, section, status FROM users'
    );
    console.log('Migration 001 applied successfully!');
    console.log('Tables now in database:', tables.length);
    console.log(
      'Table list:',
      tables.map((t) => Object.values(t)[0]).join(', ')
    );
    console.log('Preserved users count:', users.length);
  } finally {
    await conn.end();
  }
}

runMigration().catch((err) => {
  console.error('Migration failed:', err.code || err.message);
  process.exit(1);
});
