const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

/**
 * Verifies the Bearer JWT from the Authorization header and loads the
 * current user record from MySQL (never trusting role claims from the client).
 */
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Authentication required. Please log in to continue.',
      });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({
        message: 'Authentication token is missing.',
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error('Authentication error: JWT_SECRET is not configured.');
      return res.status(500).json({
        message: 'Server authentication configuration error.',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      const expired = err && err.name === 'TokenExpiredError';
      return res.status(401).json({
        message: expired
          ? 'Your session has expired. Please log in again.'
          : 'Invalid authentication token.',
      });
    }

    // Fetch fresh user profile from PostgreSQL without password_hash
    const { rows } = await pool.query(
      `SELECT
         id, name, email, role, student_id, employee_id, faculty_id,
         department, semester, section, status, created_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        message: 'User account no longer exists. Please log in again.',
      });
    }

    const user = rows[0];
    if (user.status !== 'active') {
      return res.status(403).json({
        message:
          'Your account is inactive or suspended. Please contact administration.',
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    console.error(
      `Auth middleware error (${error && error.code ? error.code : 'UNKNOWN'})`
    );
    return res.status(500).json({
      message: 'An error occurred while verifying your session.',
    });
  }
}

/**
 * Restricts route access to users whose database-verified role is listed
 * in allowedRoles. Must run after authenticateToken.
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message:
          'Access denied. You do not have permission to access this resource.',
      });
    }

    return next();
  };
}

module.exports = {
  authenticateToken,
  authorizeRoles,
};
