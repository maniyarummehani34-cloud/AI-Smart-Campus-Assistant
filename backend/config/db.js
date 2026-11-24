const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Pool, types } = require('pg');

// Load backend/.env safely using an absolute path relative to this file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Preserve PostgreSQL DATE (OID 1082) as verbatim 'YYYY-MM-DD' strings
// to avoid JavaScript Date UTC/local timezone shifts.
types.setTypeParser(1082, (val) => val);

if (!process.env.DATABASE_URL) {
  const requiredPgVars = ['PG_USER', 'PG_DATABASE'];
  const missingPgVars = requiredPgVars.filter((name) => !process.env[name]);
  if (missingPgVars.length > 0) {
    console.warn(
      `PostgreSQL configuration warning: missing environment variable(s): ${missingPgVars.join(', ')}`
    );
  }
}

/**
 * Builds optional SSL/TLS configuration for managed/cloud PostgreSQL hosts.
 * Disabled by default for local PostgreSQL when PG_SSL is not "true".
 */
function buildSslConfig() {
  if (String(process.env.PG_SSL || '').toLowerCase() !== 'true') {
    return undefined;
  }

  const rejectUnauthorized =
    String(process.env.PG_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !==
    'false';

  const sslConfig = { rejectUnauthorized };

  if (process.env.PG_SSL_CA) {
    const rawCa = process.env.PG_SSL_CA.trim();
    if (rawCa.includes('BEGIN CERTIFICATE')) {
      sslConfig.ca = rawCa.replace(/\\n/g, '\n');
    } else if (fs.existsSync(rawCa)) {
      sslConfig.ca = fs.readFileSync(rawCa, 'utf8');
    }
  }

  return sslConfig;
}

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: buildSslConfig(),
      max: Number(process.env.PG_POOL_MAX || process.env.DB_CONNECTION_LIMIT) || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host: process.env.PG_HOST || 'localhost',
      port: process.env.PG_PORT ? Number(process.env.PG_PORT) : 5432,
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD ?? '',
      database: process.env.PG_DATABASE,
      ssl: buildSslConfig(),
      max: Number(process.env.PG_POOL_MAX || process.env.DB_CONNECTION_LIMIT) || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

// Create a reusable PostgreSQL connection pool using environment variables only
const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error(
    `PostgreSQL pool client error (${err && err.code ? err.code : 'PG_POOL_ERROR'})`
  );
});

/**
 * Verifies PostgreSQL connectivity using a lightweight SELECT 1 query.
 * @returns {Promise<boolean>}
 */
async function checkDatabaseHealth() {
  const { rows } = await pool.query('SELECT 1 AS connected');
  return rows.length > 0 && Number(rows[0].connected) === 1;
}

module.exports = {
  pool,
  checkDatabaseHealth,
  buildSslConfig,
};
