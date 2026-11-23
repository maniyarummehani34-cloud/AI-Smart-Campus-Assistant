const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

// Ensure backend/.env is loaded in local development (cloud hosts inject env vars directly)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME'];
const missingEnvVars = requiredEnvVars.filter((name) => !process.env[name]);

if (missingEnvVars.length > 0) {
  console.warn(
    `MySQL configuration warning: missing environment variable(s): ${missingEnvVars.join(', ')}`
  );
}

/**
 * Builds optional SSL/TLS configuration for managed cloud MySQL hosts (e.g., Aiven).
 * Disabled by default for local XAMPP development when DB_SSL is not "true".
 */
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

// Create a reusable MySQL connection pool using environment variables only
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME,
  ssl: buildSslConfig(),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

/**
 * Verifies database connectivity using a lightweight SELECT 1 query.
 * @returns {Promise<boolean>}
 */
async function checkDatabaseHealth() {
  const [rows] = await pool.query('SELECT 1 AS connected');
  return rows.length > 0 && rows[0].connected === 1;
}

module.exports = {
  pool,
  checkDatabaseHealth,
  buildSslConfig,
};
