/**
 * Secure Local CLI Script: Create an Admin Account
 *
 * Usage (interactive prompt — recommended):
 *   cd backend
 *   npm run create-admin
 *
 * Usage (via local environment variables — never commit secrets):
 *   ADMIN_NAME="Campus Admin" ADMIN_EMAIL="admin@campus.edu" ADMIN_PASSWORD="YourStrongPassword" npm run create-admin
 */

const path = require('path');
const readline = require('readline');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { pool } = require('../config/db');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_SALT_ROUNDS = 12;

function askQuestion(rl, promptText) {
  return new Promise((resolve) => {
    rl.question(promptText, (answer) => resolve(answer.trim()));
  });
}

function askHiddenPassword(promptText) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    stdout.write(promptText);

    if (!stdin.isTTY) {
      const rl = readline.createInterface({ input: stdin, output: stdout });
      rl.question('', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
      return;
    }

    let password = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = (char) => {
      if (char === '\r' || char === '\n' || char === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        stdout.write('\n');
        resolve(password);
      } else if (char === '\u0003') {
        stdin.setRawMode(false);
        stdout.write('\nCancelled.\n');
        process.exit(1);
      } else if (char === '\u007f' || char === '\b') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          stdout.write('\b \b');
        }
      } else {
        password += char;
        stdout.write('*');
      }
    };

    stdin.on('data', onData);
  });
}

async function run() {
  let name = (process.env.ADMIN_NAME || '').trim();
  let email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  let password = process.env.ADMIN_PASSWORD || '';

  if (!name || !email || !password) {
    console.log('\n=== Smart Campus Assistant: Secure Admin Account Setup ===');
    console.log(
      'No credentials are hardcoded. Enter details below for your local PostgreSQL database.\n'
    );

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (!name) {
      name = await askQuestion(rl, 'Admin Full Name: ');
    }
    if (!email) {
      email = (await askQuestion(rl, 'Admin Email: ')).toLowerCase();
    }
    rl.close();

    if (!password) {
      password = await askHiddenPassword('Admin Password (min 8 chars): ');
    }
  }

  if (!name || name.length < 2) {
    console.error('Error: Admin full name must be at least 2 characters.');
    process.exit(1);
  }

  if (!EMAIL_REGEX.test(email)) {
    console.error('Error: Please provide a valid admin email address.');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Error: Admin password must be at least 8 characters long.');
    process.exit(1);
  }

  try {
    const { rows: existing } = await pool.query(
      'SELECT id, role FROM users WHERE email = $1 LIMIT 1',
      [email]
    );

    if (existing.length > 0) {
      console.error(
        `Error: An account with email "${email}" already exists (role: ${existing[0].role}).`
      );
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const { rows: insertedRows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, student_id, department, semester, status)
       VALUES ($1, $2, $3, 'admin', NULL, NULL, NULL, 'active')
       RETURNING id`,
      [name, email, passwordHash]
    );

    console.log('\nAdmin account created successfully!');
    console.log(`  ID:    ${insertedRows[0].id}`);
    console.log(`  Name:  ${name}`);
    console.log(`  Email: ${email}`);
    console.log('  Role:  admin\n');
  } catch (error) {
    if (error && error.code === '23505') {
      console.error(`Error: An account with email "${email}" already exists.`);
      process.exit(1);
    }
    console.error(
      `Failed to create admin account (${error && error.code ? error.code : 'UNKNOWN'})`
    );
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
