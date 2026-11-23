const express = require('express');
const {
  getPublicHighlights,
  getNotices,
  getEvents,
  getTimetable,
  getFaculty,
  getFacilities,
  getStudentExams,
  getStudentResults,
  getStudentDashboard,
} = require('../controllers/campusController');
const {
  authenticateToken,
  authorizeRoles,
} = require('../middleware/authMiddleware');

const router = express.Router();

// Safe public landing-page highlights (published content only)
router.get('/public/highlights', getPublicHighlights);

// Student-specific protected endpoints
router.get(
  '/dashboard',
  authenticateToken,
  authorizeRoles('student'),
  getStudentDashboard
);
router.get(
  '/student/exams',
  authenticateToken,
  authorizeRoles('student'),
  getStudentExams
);
router.get(
  '/student/results',
  authenticateToken,
  authorizeRoles('student'),
  getStudentResults
);

// Protected read-only campus endpoints (authenticated students, teachers, admins)
router.get('/notices', authenticateToken, getNotices);
router.get('/events', authenticateToken, getEvents);
router.get('/timetable', authenticateToken, getTimetable);
router.get('/faculty', authenticateToken, getFaculty);
router.get('/facilities', authenticateToken, getFacilities);

module.exports = router;
