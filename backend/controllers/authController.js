const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_SALT_ROUNDS = 12;

function sanitizeUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    student_id: row.student_id,
    employee_id: row.employee_id || null,
    faculty_id: row.faculty_id || null,
    department: row.department,
    semester: row.semester,
    section: row.section || (row.role === 'student' ? 'A' : null),
    status: row.status,
    created_at: row.created_at,
  };
}

function generateToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET_MISSING');
  }

  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    }
  );
}

/**
 * POST /api/auth/register
 * Public Student Registration ONLY.
 * Always assigns role = 'student' and rejects attempts to register as teacher or admin.
 */
async function registerStudent(req, res) {
  try {
    const {
      name,
      email,
      password,
      student_id,
      department,
      semester,
      section,
      role,
    } = req.body || {};

    // Never allow public registration to request a teacher or admin role
    if (role !== undefined && String(role).toLowerCase() !== 'student') {
      return res.status(403).json({
        message:
          'Public registration is restricted to student accounts only. Teacher and Admin accounts are created by administrators.',
      });
    }

    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanEmail =
      typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanStudentId =
      typeof student_id === 'string' ? student_id.trim() : '';
    const cleanDepartment =
      typeof department === 'string' ? department.trim() : '';
    const cleanSection =
      typeof section === 'string' && section.trim()
        ? section.trim().toUpperCase().slice(0, 20)
        : 'A';
    const parsedSemester = Number(semester);

    if (
      !cleanName ||
      !cleanEmail ||
      !password ||
      !cleanStudentId ||
      !cleanDepartment ||
      semester === undefined ||
      semester === null ||
      semester === ''
    ) {
      return res.status(400).json({
        message:
          'All fields are required: full name, email, password, student ID, department, and semester.',
      });
    }

    if (cleanName.length < 2 || cleanName.length > 100) {
      return res.status(400).json({
        message: 'Full name must be between 2 and 100 characters.',
      });
    }

    if (!EMAIL_REGEX.test(cleanEmail) || cleanEmail.length > 150) {
      return res.status(400).json({
        message: 'Please provide a valid email address.',
      });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters long.',
      });
    }

    if (cleanStudentId.length > 50) {
      return res.status(400).json({
        message: 'Student ID must be 50 characters or fewer.',
      });
    }

    if (
      !Number.isInteger(parsedSemester) ||
      parsedSemester < 1 ||
      parsedSemester > 12
    ) {
      return res.status(400).json({
        message: 'Semester must be a valid whole number between 1 and 12.',
      });
    }

    const [existingEmail] = await pool.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [cleanEmail]
    );
    if (existingEmail.length > 0) {
      return res.status(409).json({
        message: 'An account with this email address already exists.',
      });
    }

    const [existingStudentId] = await pool.query(
      'SELECT id FROM users WHERE student_id = ? LIMIT 1',
      [cleanStudentId]
    );
    if (existingStudentId.length > 0) {
      return res.status(409).json({
        message: 'This Student ID is already registered.',
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const [result] = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, student_id, department, semester, section, status)
       VALUES (?, ?, ?, 'student', ?, ?, ?, ?, 'active')`,
      [
        cleanName,
        cleanEmail,
        passwordHash,
        cleanStudentId,
        cleanDepartment,
        parsedSemester,
        cleanSection,
      ]
    );

    const [createdRows] = await pool.query(
      `SELECT id, name, email, role, student_id, employee_id, faculty_id, department, semester, section, status, created_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    const user = sanitizeUser(createdRows[0]);
    const token = generateToken(user);

    return res.status(201).json({
      message: 'Student account registered successfully.',
      token,
      user,
    });
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'An account with this email or Student ID already exists.',
      });
    }

    console.error(
      `Registration failed (${error && error.code ? error.code : 'UNKNOWN'})`
    );
    return res.status(500).json({
      message: 'Unable to register account right now. Please try again later.',
    });
  }
}

/**
 * POST /api/auth/login
 * Authenticates Student, Teacher, and Admin accounts using MySQL-verified role.
 */
async function loginUser(req, res) {
  try {
    const { email, password } = req.body || {};

    const cleanEmail =
      typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!cleanEmail || typeof password !== 'string' || !password) {
      return res.status(400).json({
        message: 'Email and password are required.',
      });
    }

    const [rows] = await pool.query(
      `SELECT id, name, email, password_hash, role, student_id, employee_id, faculty_id, department, semester, section, status, created_at
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [cleanEmail]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      });
    }

    const userRecord = rows[0];
    const isPasswordValid = await bcrypt.compare(
      password,
      userRecord.password_hash
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      });
    }

    if (userRecord.status !== 'active') {
      return res.status(403).json({
        message:
          'Your account is currently inactive or suspended. Please contact campus administration.',
      });
    }

    const safeUser = sanitizeUser(userRecord);
    const token = generateToken(safeUser);

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error(
      `Login failed (${error && error.code ? error.code : 'UNKNOWN'})`
    );
    return res.status(500).json({
      message: 'Unable to log in right now. Please try again later.',
    });
  }
}

async function getCurrentUser(req, res) {
  return res.status(200).json({
    user: sanitizeUser(req.user),
  });
}

async function logoutUser(req, res) {
  return res.status(200).json({
    message: 'Logged out successfully.',
  });
}

async function getStudentAreaStatus(req, res) {
  return res.status(200).json({
    message: 'Student access verified.',
    user: sanitizeUser(req.user),
  });
}

async function getTeacherAreaStatus(req, res) {
  return res.status(200).json({
    message: 'Teacher access verified.',
    user: sanitizeUser(req.user),
  });
}

async function getAdminAreaStatus(req, res) {
  return res.status(200).json({
    message: 'Admin access verified.',
    user: sanitizeUser(req.user),
  });
}

module.exports = {
  sanitizeUser,
  registerStudent,
  loginUser,
  getCurrentUser,
  logoutUser,
  getStudentAreaStatus,
  getTeacherAreaStatus,
  getAdminAreaStatus,
};
