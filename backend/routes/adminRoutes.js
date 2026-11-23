const express = require('express');
const admin = require('../controllers/adminController');
const {
  authenticateToken,
  authorizeRoles,
} = require('../middleware/authMiddleware');

const router = express.Router();

// Every Admin API requires a valid JWT AND database-verified role = 'admin'
router.use(authenticateToken, authorizeRoles('admin'));

// Dashboard & analytics
router.get('/dashboard', admin.getAdminDashboard);

// Users (Students & Teachers)
router.get('/users', admin.listUsers);
router.post('/users', admin.createUserAccount);
router.patch('/users/:id/status', admin.updateUserStatus);

// Departments & Subjects
router.get('/departments', admin.listDepartments);
router.post('/departments', admin.createDepartment);
router.get('/subjects', admin.listSubjects);
router.post('/subjects', admin.createSubject);
router.patch('/subjects/:id/status', admin.updateSubjectStatus);

// Teacher Assignments
router.get('/assignments', admin.listTeacherAssignments);
router.post('/assignments', admin.createTeacherAssignment);
router.delete('/assignments/:id', admin.deleteTeacherAssignment);

// Notices
router.get('/notices', admin.listAdminNotices);
router.post('/notices', admin.createNotice);
router.patch('/notices/:id/status', admin.updateNoticeStatus);
router.delete('/notices/:id', admin.deleteNotice);

// Events
router.get('/events', admin.listAdminEvents);
router.post('/events', admin.createEvent);
router.patch('/events/:id/status', admin.updateEventStatus);
router.delete('/events/:id', admin.deleteEvent);

// Faculty, Timetable, Facilities
router.get('/faculty', admin.listAdminFaculty);
router.post('/faculty', admin.createFaculty);
router.delete('/faculty/:id', admin.deleteFaculty);

router.get('/timetable', admin.listAdminTimetable);
router.post('/timetable', admin.createTimetableSlot);
router.patch('/timetable/:id/status', admin.updateTimetableStatus);
router.delete('/timetable/:id', admin.deleteTimetableSlot);

router.get('/facilities', admin.listAdminFacilities);
router.post('/facilities', admin.createFacility);
router.patch('/facilities/:id/status', admin.updateFacilityStatus);
router.delete('/facilities/:id', admin.deleteFacility);

// Examinations & Schedules
router.get('/exams', admin.listAdminExams);
router.post('/exams', admin.createExam);
router.post('/exams/:examId/subjects', admin.addExamSubject);
router.patch('/exams/:id/status', admin.updateExamStatus);
router.delete('/exams/:id', admin.deleteExam);

// Marks Approvals & Results Publication
router.get('/marks/submissions', admin.listMarksSubmissions);
router.patch('/marks/:id/review', admin.reviewMarkSubmission);
router.post('/exams/:examId/approve-all', admin.approveAllExamMarks);
router.post('/exams/:examId/publish-results', admin.publishExamResults);
router.get('/results', admin.listAdminResults);

// Bulk publish verified DEMO/DRAFT records
router.post('/content/publish-verified', admin.publishVerifiedDemoContent);

module.exports = router;
