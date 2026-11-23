const express = require('express');
const {
  registerStudent,
  loginUser,
  getCurrentUser,
  logoutUser,
  getStudentAreaStatus,
  getTeacherAreaStatus,
  getAdminAreaStatus,
} = require('../controllers/authController');
const {
  authenticateToken,
  authorizeRoles,
} = require('../middleware/authMiddleware');

const router = express.Router();

// Public authentication endpoints (Student registration ONLY)
router.post('/register', registerStudent);
router.post('/login', loginUser);

// Authenticated session endpoints
router.get('/me', authenticateToken, getCurrentUser);
router.post('/logout', authenticateToken, logoutUser);

// Role-protected verification endpoints
router.get(
  '/student-area',
  authenticateToken,
  authorizeRoles('student'),
  getStudentAreaStatus
);
router.get(
  '/teacher-area',
  authenticateToken,
  authorizeRoles('teacher'),
  getTeacherAreaStatus
);
router.get(
  '/admin-area',
  authenticateToken,
  authorizeRoles('admin'),
  getAdminAreaStatus
);

module.exports = router;
