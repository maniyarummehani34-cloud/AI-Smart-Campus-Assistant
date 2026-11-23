const express = require('express');
const {
  getTeacherDashboard,
  getTeacherAssignments,
  getAssignedStudents,
  getTeacherExamSubjects,
  getExamSubjectMarks,
  upsertStudentMark,
  submitMarksForApproval,
  getTeacherPerformance,
  getTeacherTimetable,
} = require('../controllers/teacherController');
const {
  authenticateToken,
  authorizeRoles,
} = require('../middleware/authMiddleware');

const router = express.Router();

// Every Teacher API requires a valid JWT AND database-verified role = 'teacher'
router.use(authenticateToken, authorizeRoles('teacher'));

router.get('/dashboard', getTeacherDashboard);
router.get('/assignments', getTeacherAssignments);
router.get('/assignments/:assignmentId/students', getAssignedStudents);
router.get('/exams', getTeacherExamSubjects);
router.get('/exam-subjects/:examSubjectId/marks', getExamSubjectMarks);
router.post('/marks', upsertStudentMark);
router.post('/exam-subjects/:examSubjectId/submit', submitMarksForApproval);
router.get('/performance', getTeacherPerformance);
router.get('/timetable', getTeacherTimetable);

module.exports = router;
