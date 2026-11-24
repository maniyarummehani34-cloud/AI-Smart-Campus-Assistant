const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { calculateExamResult, getGradingRules } = require('../config/gradingRules');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_SALT_ROUNDS = 12;

const VALID_STATUSES = ['draft', 'published', 'archived'];
const VALID_EXAM_TYPES = [
  'internal_1',
  'internal_2',
  'mid_semester',
  'end_semester',
  'practical',
  'assignment',
];

// ============================================================================
// 1. ADMIN DASHBOARD OVERVIEW & ANALYTICS
// ============================================================================
async function getAdminDashboard(req, res) {
  try {
    const [
      { rows: userStats },
      { rows: deptCount },
      { rows: noticeStats },
      { rows: eventStats },
      { rows: examStats },
      { rows: marksStats },
      { rows: deptDistribution },
      { rows: eventCategories },
    ] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN role = 'student' THEN 1 ELSE 0 END), 0)::int AS total_students,
          COALESCE(SUM(CASE WHEN role = 'teacher' THEN 1 ELSE 0 END), 0)::int AS total_teachers,
          COALESCE(SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END), 0)::int AS total_admins
        FROM users
      `),
      pool.query(
        "SELECT COUNT(*)::int AS total FROM departments WHERE status = 'active'"
      ),
      pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COALESCE(SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END), 0)::int AS published_count,
          COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0)::int AS draft_count
        FROM notices
      `),
      pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COALESCE(SUM(CASE WHEN status = 'published' AND event_date >= CURRENT_DATE THEN 1 ELSE 0 END), 0)::int AS upcoming_published,
          COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0)::int AS draft_count
        FROM events
      `),
      pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COALESCE(SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END), 0)::int AS published_count,
          COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0)::int AS draft_count
        FROM exams
      `),
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN submission_status = 'submitted' THEN 1 ELSE 0 END), 0)::int AS pending_approvals,
          COALESCE(SUM(CASE WHEN submission_status = 'approved' THEN 1 ELSE 0 END), 0)::int AS approved_count,
          COALESCE(SUM(CASE WHEN submission_status = 'draft' THEN 1 ELSE 0 END), 0)::int AS draft_count,
          COALESCE(SUM(CASE WHEN submission_status = 'rejected' THEN 1 ELSE 0 END), 0)::int AS rejected_count
        FROM marks
      `),
      pool.query(`
        SELECT
          COALESCE(department, 'Unassigned') AS department,
          COUNT(*)::int AS student_count
        FROM users
        WHERE role = 'student'
        GROUP BY department
        ORDER BY student_count DESC
      `),
      pool.query(`
        SELECT category, COUNT(*)::int AS count
        FROM events
        GROUP BY category
        ORDER BY count DESC
        LIMIT 8
      `),
    ]);

    const u = userStats[0] || {};
    const n = noticeStats[0] || {};
    const e = eventStats[0] || {};
    const ex = examStats[0] || {};
    const m = marksStats[0] || {};

    return res.status(200).json({
      stats: {
        totalStudents: Number(u.total_students || 0),
        totalTeachers: Number(u.total_teachers || 0),
        totalAdmins: Number(u.total_admins || 0),
        totalDepartments: Number(deptCount[0]?.total || 0),
        publishedNotices: Number(n.published_count || 0),
        draftNotices: Number(n.draft_count || 0),
        upcomingEvents: Number(e.upcoming_published || 0),
        draftEvents: Number(e.draft_count || 0),
        upcomingExams: Number(ex.published_count || 0),
        draftExams: Number(ex.draft_count || 0),
        pendingMarksApprovals: Number(m.pending_approvals || 0),
        approvedMarks: Number(m.approved_count || 0),
      },
      charts: {
        studentsByDepartment: deptDistribution,
        eventsByCategory: eventCategories,
        marksWorkflow: {
          draft: Number(m.draft_count || 0),
          submitted: Number(m.pending_approvals || 0),
          approved: Number(m.approved_count || 0),
          rejected: Number(m.rejected_count || 0),
        },
      },
      gradingRules: getGradingRules(),
    });
  } catch (error) {
    console.error(
      `GET /api/admin/dashboard failed (${error && error.code ? error.code : 'UNKNOWN'})`
    );
    return res.status(500).json({ message: 'Unable to load admin dashboard.' });
  }
}

// ============================================================================
// 2. USERS MANAGEMENT (STUDENTS & TEACHERS — PAGINATED & FILTERABLE)
// ============================================================================
async function listUsers(req, res) {
  try {
    const roleFilter =
      typeof req.query.role === 'string' ? req.query.role.trim().toLowerCase() : '';
    const deptFilter =
      typeof req.query.department === 'string' ? req.query.department.trim() : '';
    const semFilter = req.query.semester ? Number(req.query.semester) : null;
    const search =
      typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    const addParam = (val) => {
      params.push(val);
      return `$${params.length}`;
    };

    if (roleFilter && ['student', 'teacher', 'admin'].includes(roleFilter)) {
      conditions.push(`role = ${addParam(roleFilter)}`);
    }
    if (deptFilter && deptFilter.toLowerCase() !== 'all') {
      conditions.push(`LOWER(department) = LOWER(${addParam(deptFilter)})`);
    }
    if (Number.isInteger(semFilter) && semFilter >= 1 && semFilter <= 12) {
      conditions.push(`semester = ${addParam(semFilter)}`);
    }
    if (search) {
      const likeParam = addParam(`%${search}%`);
      conditions.push(
        `(name ILIKE ${likeParam} OR email ILIKE ${likeParam} OR student_id ILIKE ${likeParam} OR employee_id ILIKE ${likeParam})`
      );
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM users ${where}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const limitParam = `$${params.length + 1}`;
    const offsetParam = `$${params.length + 2}`;
    const { rows } = await pool.query(
      `SELECT id, name, email, role, student_id, employee_id, faculty_id, department, semester, section, status, created_at
       FROM users
       ${where}
       ORDER BY
         CASE role
           WHEN 'admin' THEN 1
           WHEN 'teacher' THEN 2
           WHEN 'student' THEN 3
           ELSE 4
         END,
         id ASC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      [...params, limit, offset]
    );

    return res.status(200).json({
      users: rows,
      count: rows.length,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error(`GET /api/admin/users failed (${error.code || 'UNKNOWN'})`);
    return res.status(500).json({ message: 'Unable to load users.' });
  }
}

async function createUserAccount(req, res) {
  try {
    const {
      name,
      email,
      password,
      role,
      student_id,
      employee_id,
      faculty_id,
      department,
      semester,
      section,
    } = req.body || {};

    const cleanRole = typeof role === 'string' ? role.trim().toLowerCase() : '';
    if (!['student', 'teacher'].includes(cleanRole)) {
      return res.status(400).json({
        message: 'Role must be either "student" or "teacher".',
      });
    }

    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanEmail =
      typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanDept = typeof department === 'string' ? department.trim() : '';

    if (!cleanName || !cleanEmail || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        message: 'Name, valid email, and password (min 8 characters) are required.',
      });
    }
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    let cleanStudentId = null;
    let cleanEmployeeId = null;
    let parsedSemester = null;
    let cleanSection = null;
    let parsedFacultyId = faculty_id ? Number(faculty_id) : null;

    if (cleanRole === 'student') {
      cleanStudentId = typeof student_id === 'string' ? student_id.trim() : '';
      parsedSemester = Number(semester);
      cleanSection =
        typeof section === 'string' && section.trim()
          ? section.trim().toUpperCase().slice(0, 20)
          : 'A';
      if (!cleanStudentId || !cleanDept || !Number.isInteger(parsedSemester) || parsedSemester < 1 || parsedSemester > 12) {
        return res.status(400).json({
          message: 'Student accounts require student_id, department, and semester (1-12).',
        });
      }
    } else {
      cleanEmployeeId =
        typeof employee_id === 'string' && employee_id.trim()
          ? employee_id.trim()
          : null;
      if (!cleanDept) {
        return res.status(400).json({
          message: 'Teacher accounts require a department.',
        });
      }
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const { rows: insertedRows } = await pool.query(
      `INSERT INTO users
         (name, email, password_hash, role, student_id, employee_id, faculty_id, department, semester, section, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
       RETURNING id`,
      [
        cleanName,
        cleanEmail,
        passwordHash,
        cleanRole,
        cleanStudentId,
        cleanEmployeeId,
        parsedFacultyId,
        cleanDept || null,
        parsedSemester,
        cleanSection,
      ]
    );

    const { rows: created } = await pool.query(
      `SELECT id, name, email, role, student_id, employee_id, faculty_id, department, semester, section, status, created_at
       FROM users WHERE id = $1 LIMIT 1`,
      [insertedRows[0].id]
    );

    return res.status(201).json({
      message: `${cleanRole === 'teacher' ? 'Teacher' : 'Student'} account created successfully.`,
      user: created[0],
    });
  } catch (error) {
    if (error && error.code === '23505') {
      return res.status(409).json({
        message: 'Email, Student ID, or Employee ID is already in use.',
      });
    }
    console.error(`POST /api/admin/users failed (${error.code || 'UNKNOWN'})`);
    return res.status(500).json({ message: 'Unable to create account.' });
  }
}

async function updateUserStatus(req, res) {
  try {
    const id = Number(req.params.id);
    const { status } = req.body || {};

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid user ID.' });
    }
    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value.' });
    }
    if (id === req.user.id && status !== 'active') {
      return res.status(400).json({
        message: 'You cannot deactivate or suspend your own admin account.',
      });
    }

    const result = await pool.query('UPDATE users SET status = $1 WHERE id = $2', [
      status,
      id,
    ]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json({ message: 'User status updated.' });
  } catch (error) {
    console.error(`PATCH /api/admin/users/:id/status failed (${error.code || 'UNKNOWN'})`);
    return res.status(500).json({ message: 'Unable to update user status.' });
  }
}

// ============================================================================
// 3. DEPARTMENTS & SUBJECTS
// ============================================================================
async function listDepartments(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT id, code, name, description, status, created_at FROM departments ORDER BY name ASC'
    );
    return res.status(200).json({ departments: rows, count: rows.length });
  } catch (error) {
    console.error(`GET /api/admin/departments failed (${error.code || 'UNKNOWN'})`);
    return res.status(500).json({ message: 'Unable to load departments.' });
  }
}

async function createDepartment(req, res) {
  try {
    const { code, name, description } = req.body || {};
    const cleanCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanCode || !cleanName) {
      return res.status(400).json({ message: 'Department code and name are required.' });
    }
    const { rows } = await pool.query(
      `INSERT INTO departments (code, name, description, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING id`,
      [cleanCode, cleanName, description || null]
    );
    return res.status(201).json({
      message: 'Department created successfully.',
      id: rows[0].id,
    });
  } catch (error) {
    if (error && error.code === '23505') {
      return res.status(409).json({ message: 'Department code or name already exists.' });
    }
    return res.status(500).json({ message: 'Unable to create department.' });
  }
}

async function listSubjects(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, code, name, department_id, department, semester, credits, status, is_demo
       FROM subjects
       ORDER BY department ASC, semester ASC, code ASC`
    );
    return res.status(200).json({ subjects: rows, count: rows.length });
  } catch {
    return res.status(500).json({ message: 'Unable to load subjects.' });
  }
}

async function createSubject(req, res) {
  try {
    const { code, name, department_id, semester, credits, status } = req.body || {};
    const deptId = Number(department_id);
    const sem = Number(semester);
    if (!code || !name || !Number.isInteger(deptId) || !Number.isInteger(sem) || sem < 1 || sem > 12) {
      return res.status(400).json({
        message: 'Valid code, name, department_id, and semester (1-12) are required.',
      });
    }
    const { rows: depts } = await pool.query(
      'SELECT id, name FROM departments WHERE id = $1 LIMIT 1',
      [deptId]
    );
    if (depts.length === 0) {
      return res.status(404).json({ message: 'Selected department not found.' });
    }
    const cleanStatus = VALID_STATUSES.includes(status) ? status : 'published';
    const { rows } = await pool.query(
      `INSERT INTO subjects (code, name, department_id, department, semester, credits, status, is_demo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
       RETURNING id`,
      [
        String(code).trim().toUpperCase(),
        String(name).trim(),
        deptId,
        depts[0].name,
        sem,
        Number(credits) || 3,
        cleanStatus,
      ]
    );
    return res.status(201).json({
      message: 'Subject created successfully.',
      id: rows[0].id,
    });
  } catch (error) {
    if (error && error.code === '23505') {
      return res.status(409).json({ message: 'Subject code already exists.' });
    }
    return res.status(500).json({ message: 'Unable to create subject.' });
  }
}

async function updateSubjectStatus(req, res) {
  try {
    const id = Number(req.params.id);
    const { status } = req.body || {};
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }
    const result = await pool.query('UPDATE subjects SET status = $1 WHERE id = $2', [
      status,
      id,
    ]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Subject not found.' });
    return res.status(200).json({ message: 'Subject status updated.' });
  } catch {
    return res.status(500).json({ message: 'Unable to update subject status.' });
  }
}

// ============================================================================
// 4. TEACHER ASSIGNMENTS
// ============================================================================
async function listTeacherAssignments(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT
         ta.id, ta.teacher_id, ta.subject_id, ta.department, ta.semester, ta.section, ta.academic_year, ta.status,
         u.name AS teacher_name, u.email AS teacher_email, u.employee_id,
         s.code AS subject_code, s.name AS subject_name
       FROM teacher_assignments ta
       INNER JOIN users u ON ta.teacher_id = u.id
       INNER JOIN subjects s ON ta.subject_id = s.id
       ORDER BY ta.department ASC, ta.semester ASC, ta.section ASC, s.code ASC`
    );
    return res.status(200).json({ assignments: rows, count: rows.length });
  } catch {
    return res.status(500).json({ message: 'Unable to load teacher assignments.' });
  }
}

async function createTeacherAssignment(req, res) {
  try {
    const { teacher_id, subject_id, department, semester, section, academic_year } =
      req.body || {};
    const tId = Number(teacher_id);
    const sId = Number(subject_id);
    const sem = Number(semester);
    const cleanSec =
      typeof section === 'string' && section.trim()
        ? section.trim().toUpperCase().slice(0, 20)
        : 'A';

    if (!Number.isInteger(tId) || !Number.isInteger(sId) || !department || !Number.isInteger(sem)) {
      return res.status(400).json({
        message: 'teacher_id, subject_id, department, and semester are required.',
      });
    }

    const { rows: tRows } = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND role = 'teacher' LIMIT 1",
      [tId]
    );
    if (tRows.length === 0) {
      return res.status(400).json({
        message: 'Selected user is not a valid teacher account.',
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO teacher_assignments
         (teacher_id, subject_id, department, semester, section, academic_year, assigned_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
       RETURNING id`,
      [tId, sId, String(department).trim(), sem, cleanSec, academic_year || '2026-27', req.user.id]
    );

    return res.status(201).json({
      message: 'Teacher assigned successfully.',
      id: rows[0].id,
    });
  } catch (error) {
    if (error && error.code === '23505') {
      return res.status(409).json({
        message: 'This teacher is already assigned to that subject and class.',
      });
    }
    return res.status(500).json({ message: 'Unable to assign teacher.' });
  }
}

async function deleteTeacherAssignment(req, res) {
  try {
    const id = Number(req.params.id);
    const result = await pool.query('DELETE FROM teacher_assignments WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Assignment not found.' });
    }
    return res.status(200).json({ message: 'Assignment removed.' });
  } catch {
    return res.status(500).json({ message: 'Unable to remove assignment.' });
  }
}

// ============================================================================
// 5. NOTICES CRUD & WORKFLOW (DRAFT / PUBLISHED / ARCHIVED)
// ============================================================================
async function listAdminNotices(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT n.id, n.title, n.description, n.category, n.target_department, n.priority, n.status, n.is_demo, n.published_date, u.name AS posted_by_name
       FROM notices n
       LEFT JOIN users u ON n.posted_by = u.id
       ORDER BY
         CASE n.status
           WHEN 'draft' THEN 1
           WHEN 'published' THEN 2
           WHEN 'archived' THEN 3
           ELSE 4
         END,
         n.published_date DESC,
         n.id DESC`
    );
    return res.status(200).json({ notices: rows, count: rows.length });
  } catch {
    return res.status(500).json({ message: 'Unable to load notices.' });
  }
}

async function createNotice(req, res) {
  try {
    const { title, description, category, target_department, priority, status } = req.body || {};
    if (!title || !description) {
      return res.status(400).json({ message: 'Notice title and description are required.' });
    }
    const cleanStatus = VALID_STATUSES.includes(status) ? status : 'published';
    const { rows } = await pool.query(
      `INSERT INTO notices (title, description, category, target_department, priority, status, is_demo, posted_by, published_date)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7, NOW())
       RETURNING id`,
      [
        String(title).trim(),
        String(description).trim(),
        category || 'general',
        target_department || 'All',
        priority || 'normal',
        cleanStatus,
        req.user.id,
      ]
    );
    return res.status(201).json({ message: 'Notice created.', id: rows[0].id });
  } catch {
    return res.status(500).json({ message: 'Unable to create notice.' });
  }
}

async function updateNoticeStatus(req, res) {
  try {
    const id = Number(req.params.id);
    const { status } = req.body || {};
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid notice status.' });
    }
    const result = await pool.query(
      `UPDATE notices
       SET status = $1,
           published_date = CASE WHEN $1 = 'published' THEN NOW() ELSE published_date END
       WHERE id = $2`,
      [status, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Notice not found.' });
    return res.status(200).json({ message: `Notice marked as ${status}.` });
  } catch {
    return res.status(500).json({ message: 'Unable to update notice status.' });
  }
}

async function deleteNotice(req, res) {
  try {
    const id = Number(req.params.id);
    const result = await pool.query('DELETE FROM notices WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Notice not found.' });
    return res.status(200).json({ message: 'Notice deleted.' });
  } catch {
    return res.status(500).json({ message: 'Unable to delete notice.' });
  }
}

// ============================================================================
// 6. EVENTS CRUD & WORKFLOW
// ============================================================================
async function listAdminEvents(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, description, category, target_department, semester_eligibility,
              event_date, event_time, venue, organizer, registration_details, image_url,
              registration_link, status, is_demo
       FROM events
       ORDER BY
         CASE status
           WHEN 'draft' THEN 1
           WHEN 'published' THEN 2
           WHEN 'archived' THEN 3
           ELSE 4
         END,
         event_date ASC`
    );
    return res.status(200).json({ events: rows, count: rows.length });
  } catch {
    return res.status(500).json({ message: 'Unable to load events.' });
  }
}

async function createEvent(req, res) {
  try {
    const {
      title,
      description,
      category,
      target_department,
      semester_eligibility,
      event_date,
      event_time,
      venue,
      organizer,
      registration_details,
      image_url,
      registration_link,
      status,
    } = req.body || {};

    if (!title || !description || !event_date || !event_time || !venue || !organizer) {
      return res.status(400).json({
        message: 'Title, description, date, time, venue, and organizer are required.',
      });
    }

    const cleanStatus = VALID_STATUSES.includes(status) ? status : 'published';
    const { rows } = await pool.query(
      `INSERT INTO events
         (title, description, category, target_department, semester_eligibility, event_date, event_time,
          venue, organizer, registration_details, image_url, registration_link, status, is_demo, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, FALSE, $14)
       RETURNING id`,
      [
        String(title).trim(),
        String(description).trim(),
        category || 'general',
        target_department || 'All',
        semester_eligibility || 'All Semesters',
        event_date,
        event_time,
        String(venue).trim(),
        String(organizer).trim(),
        registration_details || null,
        image_url || '/images/event-seminar.svg',
        registration_link || null,
        cleanStatus,
        req.user.id,
      ]
    );

    return res.status(201).json({ message: 'Event created.', id: rows[0].id });
  } catch {
    return res.status(500).json({ message: 'Unable to create event.' });
  }
}

async function updateEventStatus(req, res) {
  try {
    const id = Number(req.params.id);
    const { status } = req.body || {};
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid event status.' });
    }
    const result = await pool.query('UPDATE events SET status = $1 WHERE id = $2', [
      status,
      id,
    ]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Event not found.' });
    return res.status(200).json({ message: `Event marked as ${status}.` });
  } catch {
    return res.status(500).json({ message: 'Unable to update event status.' });
  }
}

async function deleteEvent(req, res) {
  try {
    const id = Number(req.params.id);
    const result = await pool.query('DELETE FROM events WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Event not found.' });
    return res.status(200).json({ message: 'Event deleted.' });
  } catch {
    return res.status(500).json({ message: 'Unable to delete event.' });
  }
}

// ============================================================================
// 7. FACULTY, TIMETABLE, FACILITIES MANAGEMENT
// ============================================================================
async function listAdminFaculty(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, department, designation, email, phone, office_location, consultation_hours, is_demo FROM faculty ORDER BY department ASC, name ASC'
    );
    return res.status(200).json({ faculty: rows, count: rows.length });
  } catch {
    return res.status(500).json({ message: 'Unable to load faculty.' });
  }
}

async function createFaculty(req, res) {
  try {
    const { name, department, designation, email, phone, office_location, consultation_hours } = req.body || {};
    if (!name || !department || !designation || !email || !office_location) {
      return res.status(400).json({
        message: 'Name, department, designation, email, and office_location are required.',
      });
    }
    const { rows } = await pool.query(
      `INSERT INTO faculty (name, department, designation, email, phone, office_location, consultation_hours, is_demo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
       RETURNING id`,
      [name.trim(), department.trim(), designation.trim(), email.trim().toLowerCase(), phone || null, office_location.trim(), consultation_hours || null]
    );
    return res.status(201).json({ message: 'Faculty profile created.', id: rows[0].id });
  } catch (error) {
    if (error && error.code === '23505') return res.status(409).json({ message: 'Faculty email already exists.' });
    return res.status(500).json({ message: 'Unable to create faculty profile.' });
  }
}

async function deleteFaculty(req, res) {
  try {
    const result = await pool.query('DELETE FROM faculty WHERE id = $1', [
      Number(req.params.id),
    ]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Faculty not found.' });
    return res.status(200).json({ message: 'Faculty removed.' });
  } catch {
    return res.status(500).json({ message: 'Unable to delete faculty.' });
  }
}

async function listAdminTimetable(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.department, t.semester, t.section, t.subject, t.faculty_id,
              t.day_of_week, t.start_time, t.end_time, t.classroom, t.status, t.is_demo,
              f.name AS faculty_name
       FROM timetable t
       LEFT JOIN faculty f ON t.faculty_id = f.id
       ORDER BY
         t.department ASC,
         t.semester ASC,
         CASE t.day_of_week
           WHEN 'Monday' THEN 1
           WHEN 'Tuesday' THEN 2
           WHEN 'Wednesday' THEN 3
           WHEN 'Thursday' THEN 4
           WHEN 'Friday' THEN 5
           WHEN 'Saturday' THEN 6
           ELSE 7
         END,
         t.start_time ASC`
    );
    return res.status(200).json({ timetable: rows, count: rows.length });
  } catch {
    return res.status(500).json({ message: 'Unable to load timetable.' });
  }
}

async function createTimetableSlot(req, res) {
  try {
    const { department, semester, section, subject, faculty_id, day_of_week, start_time, end_time, classroom, status } = req.body || {};
    if (!department || !semester || !subject || !day_of_week || !start_time || !end_time || !classroom) {
      return res.status(400).json({ message: 'All timetable slot fields are required.' });
    }
    const cleanStatus = VALID_STATUSES.includes(status) ? status : 'published';
    const { rows } = await pool.query(
      `INSERT INTO timetable (department, semester, section, subject, faculty_id, day_of_week, start_time, end_time, classroom, status, is_demo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE)
       RETURNING id`,
      [department.trim(), Number(semester), (section || 'A').trim().toUpperCase(), subject.trim(), faculty_id ? Number(faculty_id) : null, day_of_week, start_time, end_time, classroom.trim(), cleanStatus]
    );
    return res.status(201).json({ message: 'Timetable slot added.', id: rows[0].id });
  } catch (error) {
    if (error && error.code === 'P0001') {
      return res.status(409).json({
        message: error.message || 'Timetable conflict detected.',
      });
    }
    if (error && error.code === '23505') {
      return res.status(409).json({
        message: 'Timetable conflict: duplicate classroom, faculty, or section time slot.',
      });
    }
    return res.status(500).json({ message: 'Unable to create timetable slot.' });
  }
}

async function updateTimetableStatus(req, res) {
  try {
    const { status } = req.body || {};
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid status.' });
    const result = await pool.query('UPDATE timetable SET status = $1 WHERE id = $2', [
      status,
      Number(req.params.id),
    ]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Slot not found.' });
    return res.status(200).json({ message: `Timetable slot marked as ${status}.` });
  } catch {
    return res.status(500).json({ message: 'Unable to update timetable status.' });
  }
}

async function deleteTimetableSlot(req, res) {
  try {
    const result = await pool.query('DELETE FROM timetable WHERE id = $1', [
      Number(req.params.id),
    ]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Slot not found.' });
    return res.status(200).json({ message: 'Timetable slot deleted.' });
  } catch {
    return res.status(500).json({ message: 'Unable to delete timetable slot.' });
  }
}

async function listAdminFacilities(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, category, description, location, opening_hours, contact_info, status, is_demo FROM facilities ORDER BY name ASC'
    );
    return res.status(200).json({ facilities: rows, count: rows.length });
  } catch {
    return res.status(500).json({ message: 'Unable to load facilities.' });
  }
}

async function createFacility(req, res) {
  try {
    const { name, category, description, location, opening_hours, contact_info, status } = req.body || {};
    if (!name || !description || !location || !opening_hours) {
      return res.status(400).json({ message: 'Name, description, location, and opening hours are required.' });
    }
    const { rows } = await pool.query(
      `INSERT INTO facilities (name, category, description, location, opening_hours, contact_info, status, is_demo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
       RETURNING id`,
      [name.trim(), category || 'other', description.trim(), location.trim(), opening_hours.trim(), contact_info || null, status || 'open']
    );
    return res.status(201).json({ message: 'Facility added.', id: rows[0].id });
  } catch (error) {
    if (error && error.code === '23505') return res.status(409).json({ message: 'Facility name already exists.' });
    return res.status(500).json({ message: 'Unable to create facility.' });
  }
}

async function updateFacilityStatus(req, res) {
  try {
    const { status } = req.body || {};
    if (!['open', 'closed', 'maintenance'].includes(status)) {
      return res.status(400).json({ message: 'Invalid facility status.' });
    }
    const result = await pool.query('UPDATE facilities SET status = $1 WHERE id = $2', [
      status,
      Number(req.params.id),
    ]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Facility not found.' });
    return res.status(200).json({ message: `Facility marked as ${status}.` });
  } catch {
    return res.status(500).json({ message: 'Unable to update facility status.' });
  }
}

async function deleteFacility(req, res) {
  try {
    const result = await pool.query('DELETE FROM facilities WHERE id = $1', [
      Number(req.params.id),
    ]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Facility not found.' });
    return res.status(200).json({ message: 'Facility deleted.' });
  } catch {
    return res.status(500).json({ message: 'Unable to delete facility.' });
  }
}

// ============================================================================
// 8. EXAMINATIONS & SCHEDULE MANAGEMENT
// ============================================================================
async function listAdminExams(req, res) {
  try {
    const { rows: exams } = await pool.query(
      `SELECT e.id, e.title, e.exam_type, e.department, e.semester, e.section,
              e.academic_year, e.instructions, e.status, e.is_demo, e.created_at
       FROM exams e
       ORDER BY
         CASE e.status
           WHEN 'draft' THEN 1
           WHEN 'published' THEN 2
           WHEN 'archived' THEN 3
           ELSE 4
         END,
         e.created_at DESC`
    );

    const { rows: examSubjects } = await pool.query(
      `SELECT es.id, es.exam_id, es.subject_id, es.exam_date, es.start_time, es.end_time,
              es.max_marks, es.passing_marks, es.room, es.instructions, es.status,
              s.code AS subject_code, s.name AS subject_name
       FROM exam_subjects es
       INNER JOIN subjects s ON es.subject_id = s.id
       ORDER BY es.exam_date ASC, es.start_time ASC`
    );

    const byExam = new Map();
    for (const es of examSubjects) {
      if (!byExam.has(es.exam_id)) byExam.set(es.exam_id, []);
      byExam.get(es.exam_id).push(es);
    }

    const enriched = exams.map((exam) => ({
      ...exam,
      subjects: byExam.get(exam.id) || [],
    }));

    return res.status(200).json({ exams: enriched, count: enriched.length });
  } catch {
    return res.status(500).json({ message: 'Unable to load examinations.' });
  }
}

async function createExam(req, res) {
  const {
    title,
    exam_type,
    department,
    semester,
    section,
    academic_year,
    instructions,
    status,
    subjects,
  } = req.body || {};

  if (!title || !VALID_EXAM_TYPES.includes(exam_type) || !department || !semester) {
    return res.status(400).json({
      message: 'Title, valid exam_type, department, and semester are required.',
    });
  }

  const cleanStatus = VALID_STATUSES.includes(status) ? status : 'draft';
  const cleanSection =
    typeof section === 'string' && section.trim()
      ? section.trim().toUpperCase().slice(0, 20)
      : 'A';

  let client = null;
  let inTransaction = false;

  try {
    client = await pool.connect();
    await client.query('BEGIN');
    inTransaction = true;

    const { rows: examRows } = await client.query(
      `INSERT INTO exams
         (title, exam_type, department, semester, section, academic_year, instructions, status, is_demo, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, $9)
       RETURNING id`,
      [
        String(title).trim(),
        exam_type,
        String(department).trim(),
        Number(semester),
        cleanSection,
        academic_year || '2026-27',
        instructions || null,
        cleanStatus,
        req.user.id,
      ]
    );

    const examId = examRows[0].id;
    const createdExamSubjectIds = [];

    if (Array.isArray(subjects)) {
      for (const item of subjects) {
        const maxM = Number(item.max_marks);
        const passM =
          item.passing_marks !== undefined && item.passing_marks !== ''
            ? Number(item.passing_marks)
            : Number((maxM * 0.4).toFixed(2));
        if (!item.subject_id || !item.exam_date || !item.start_time || !item.end_time || !(maxM > 0)) {
          throw new Error('INVALID_EXAM_SUBJECT');
        }
        if (item.end_time <= item.start_time) {
          throw new Error('INVALID_EXAM_TIME');
        }
        const { rows: esRows } = await client.query(
          `INSERT INTO exam_subjects
             (exam_id, subject_id, exam_date, start_time, end_time, max_marks, passing_marks, room, instructions, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id`,
          [
            examId,
            Number(item.subject_id),
            item.exam_date,
            item.start_time,
            item.end_time,
            maxM,
            passM,
            item.room || null,
            item.instructions || null,
            cleanStatus,
          ]
        );
        createdExamSubjectIds.push(esRows[0].id);
      }
    }

    await client.query('COMMIT');
    inTransaction = false;

    return res.status(201).json({
      message: 'Examination schedule created successfully.',
      examId,
      examSubjectIds: createdExamSubjectIds,
    });
  } catch (error) {
    if (inTransaction && client) {
      await client.query('ROLLBACK').catch(() => {});
      inTransaction = false;
    }
    if (error.message === 'INVALID_EXAM_SUBJECT') {
      return res.status(400).json({ message: 'Each exam subject requires subject_id, exam_date, start_time, end_time, and max_marks.' });
    }
    if (error.message === 'INVALID_EXAM_TIME') {
      return res.status(400).json({ message: 'Exam end_time must be later than start_time.' });
    }
    return res.status(500).json({ message: 'Unable to create examination.' });
  } finally {
    if (client) client.release();
  }
}

async function addExamSubject(req, res) {
  try {
    const examId = Number(req.params.examId);
    const { subject_id, exam_date, start_time, end_time, max_marks, passing_marks, room, instructions } = req.body || {};
    const maxM = Number(max_marks);
    const passM =
      passing_marks !== undefined && passing_marks !== ''
        ? Number(passing_marks)
        : Number((maxM * 0.4).toFixed(2));

    if (!Number.isInteger(examId) || !subject_id || !exam_date || !start_time || !end_time || !(maxM > 0)) {
      return res.status(400).json({ message: 'Valid subject, date, times, and max_marks are required.' });
    }
    if (end_time <= start_time) {
      return res.status(400).json({ message: 'end_time must be later than start_time.' });
    }

    const { rows: exams } = await pool.query(
      'SELECT status FROM exams WHERE id = $1 LIMIT 1',
      [examId]
    );
    if (exams.length === 0) return res.status(404).json({ message: 'Exam not found.' });

    const { rows } = await pool.query(
      `INSERT INTO exam_subjects
         (exam_id, subject_id, exam_date, start_time, end_time, max_marks, passing_marks, room, instructions, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [examId, Number(subject_id), exam_date, start_time, end_time, maxM, passM, room || null, instructions || null, exams[0].status]
    );

    return res.status(201).json({ message: 'Exam subject added.', id: rows[0].id });
  } catch (error) {
    if (error && error.code === '23505') {
      return res.status(409).json({ message: 'This subject is already scheduled in this exam.' });
    }
    return res.status(500).json({ message: 'Unable to add subject to exam.' });
  }
}

async function updateExamStatus(req, res) {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }

  let client = null;
  let inTransaction = false;

  try {
    client = await pool.connect();
    await client.query('BEGIN');
    inTransaction = true;

    const resExam = await client.query('UPDATE exams SET status = $1 WHERE id = $2', [
      status,
      id,
    ]);
    if (resExam.rowCount === 0) {
      await client.query('ROLLBACK');
      inTransaction = false;
      return res.status(404).json({ message: 'Exam not found.' });
    }

    await client.query('UPDATE exam_subjects SET status = $1 WHERE exam_id = $2', [
      status,
      id,
    ]);

    await client.query('COMMIT');
    inTransaction = false;
    return res.status(200).json({ message: `Exam schedule marked as ${status}.` });
  } catch {
    if (inTransaction && client) {
      await client.query('ROLLBACK').catch(() => {});
      inTransaction = false;
    }
    return res.status(500).json({ message: 'Unable to update exam status.' });
  } finally {
    if (client) client.release();
  }
}

async function deleteExam(req, res) {
  try {
    const result = await pool.query('DELETE FROM exams WHERE id = $1', [
      Number(req.params.id),
    ]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Exam not found.' });
    return res.status(200).json({ message: 'Exam deleted.' });
  } catch {
    return res.status(500).json({ message: 'Unable to delete exam.' });
  }
}

// ============================================================================
// 9. MARKS APPROVAL & RESULT PUBLICATION (ADMIN ONLY)
// ============================================================================
async function listMarksSubmissions(req, res) {
  try {
    const statusFilter =
      typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : '';
    const search =
      typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    const addParam = (val) => {
      params.push(val);
      return `$${params.length}`;
    };

    if (statusFilter && ['draft', 'submitted', 'approved', 'rejected'].includes(statusFilter)) {
      conditions.push(`m.submission_status = ${addParam(statusFilter)}`);
    }
    if (search) {
      const likeParam = addParam(`%${search}%`);
      conditions.push(
        `(u.name ILIKE ${likeParam} OR u.student_id ILIKE ${likeParam} OR e.title ILIKE ${likeParam} OR s.code ILIKE ${likeParam})`
      );
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM marks m
       INNER JOIN users u ON m.student_id = u.id
       INNER JOIN exam_subjects es ON m.exam_subject_id = es.id
       INNER JOIN exams e ON es.exam_id = e.id
       INNER JOIN subjects s ON m.subject_id = s.id
       ${where}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const limitParam = `$${params.length + 1}`;
    const offsetParam = `$${params.length + 2}`;
    const { rows } = await pool.query(
      `SELECT
         m.id, m.exam_subject_id, m.student_id, m.subject_id, m.obtained_marks, m.max_marks,
         m.remarks, m.submission_status, m.submitted_at, m.reviewed_at, m.review_notes,
         u.name AS student_name, u.student_id AS roll_number, u.department, u.semester, COALESCE(u.section,'A') AS section,
         t.name AS teacher_name,
         s.code AS subject_code, s.name AS subject_name,
         e.id AS exam_id, e.title AS exam_title, e.exam_type, e.is_demo,
         r.publish_status
       FROM marks m
       INNER JOIN users u ON m.student_id = u.id
       INNER JOIN exam_subjects es ON m.exam_subject_id = es.id
       INNER JOIN exams e ON es.exam_id = e.id
       INNER JOIN subjects s ON m.subject_id = s.id
       LEFT JOIN users t ON m.entered_by = t.id
       LEFT JOIN results r ON r.exam_id = e.id AND r.student_id = m.student_id
       ${where}
       ORDER BY
         CASE m.submission_status
           WHEN 'submitted' THEN 1
           WHEN 'draft' THEN 2
           WHEN 'rejected' THEN 3
           WHEN 'approved' THEN 4
           ELSE 5
         END,
         m.id DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      [...params, limit, offset]
    );

    return res.status(200).json({
      submissions: rows,
      count: rows.length,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch {
    return res.status(500).json({ message: 'Unable to load marks submissions.' });
  }
}

async function reviewMarkSubmission(req, res) {
  try {
    const markId = Number(req.params.id);
    const { action, review_notes } = req.body || {};

    if (!Number.isInteger(markId) || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        message: 'Valid mark ID and action ("approve" or "reject") are required.',
      });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const result = await pool.query(
      `UPDATE marks
       SET submission_status = $1,
           reviewed_by = $2,
           reviewed_at = NOW(),
           review_notes = $3
       WHERE id = $4 AND submission_status IN ('submitted', 'rejected', 'draft')`,
      [newStatus, req.user.id, review_notes ? String(review_notes).slice(0, 255) : null, markId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: 'Mark record not found or already approved.',
      });
    }

    return res.status(200).json({
      message: `Mark record ${newStatus}.`,
      submission_status: newStatus,
    });
  } catch {
    return res.status(500).json({ message: 'Unable to review mark submission.' });
  }
}

async function approveAllExamMarks(req, res) {
  try {
    const examId = Number(req.params.examId);
    const result = await pool.query(
      `UPDATE marks m
       SET submission_status = 'approved',
           reviewed_by = $1,
           reviewed_at = NOW()
       FROM exam_subjects es
       WHERE m.exam_subject_id = es.id
         AND es.exam_id = $2
         AND m.submission_status = 'submitted'`,
      [req.user.id, examId]
    );

    return res.status(200).json({
      message: `Approved ${result.rowCount} submitted mark record(s).`,
      approvedCount: result.rowCount,
    });
  } catch {
    return res.status(500).json({ message: 'Unable to approve exam marks.' });
  }
}

async function publishExamResults(req, res) {
  const examId = Number(req.params.examId);
  if (!Number.isInteger(examId) || examId <= 0) {
    return res.status(400).json({ message: 'Invalid exam ID.' });
  }

  let client = null;
  let inTransaction = false;

  try {
    client = await pool.connect();

    const { rows: exams } = await client.query(
      'SELECT id, title FROM exams WHERE id = $1 LIMIT 1',
      [examId]
    );
    if (exams.length === 0) {
      return res.status(404).json({ message: 'Exam not found.' });
    }

    // Ensure there are no unapproved marks remaining before publication
    const { rows: pendingRows } = await client.query(
      `SELECT COUNT(*)::int AS cnt
       FROM marks m
       INNER JOIN exam_subjects es ON m.exam_subject_id = es.id
       WHERE es.exam_id = $1 AND m.submission_status <> 'approved'`,
      [examId]
    );

    if (Number(pendingRows[0]?.cnt || 0) > 0) {
      return res.status(400).json({
        message:
          'All entered marks for this exam must be approved by an Admin before publishing results.',
      });
    }

    const { rows: approvedMarks } = await client.query(
      `SELECT m.student_id, m.obtained_marks, m.max_marks, es.passing_marks
       FROM marks m
       INNER JOIN exam_subjects es ON m.exam_subject_id = es.id
       WHERE es.exam_id = $1 AND m.submission_status = 'approved'`,
      [examId]
    );

    if (approvedMarks.length === 0) {
      return res.status(400).json({
        message: 'No approved marks found to publish for this examination.',
      });
    }

    // Group approved subject marks by student_id
    const byStudent = new Map();
    for (const row of approvedMarks) {
      if (!byStudent.has(row.student_id)) byStudent.set(row.student_id, []);
      byStudent.get(row.student_id).push(row);
    }

    await client.query('BEGIN');
    inTransaction = true;

    let publishedCount = 0;
    for (const [studentId, subjectMarks] of byStudent.entries()) {
      const calc = calculateExamResult(subjectMarks);
      await client.query(
        `INSERT INTO results
           (exam_id, student_id, total_obtained, total_max, percentage, grade, pass_status, publish_status, published_by, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'published', $8, NOW())
         ON CONFLICT (exam_id, student_id) DO UPDATE SET
           total_obtained = EXCLUDED.total_obtained,
           total_max = EXCLUDED.total_max,
           percentage = EXCLUDED.percentage,
           grade = EXCLUDED.grade,
           pass_status = EXCLUDED.pass_status,
           publish_status = 'published',
           published_by = EXCLUDED.published_by,
           published_at = NOW()`,
        [
          examId,
          studentId,
          calc.totalObtained,
          calc.totalMax,
          calc.percentage,
          calc.grade,
          calc.passStatus,
          req.user.id,
        ]
      );
      publishedCount += 1;
    }

    await client.query('COMMIT');
    inTransaction = false;

    return res.status(200).json({
      message: `Published verified results for ${publishedCount} student(s).`,
      publishedCount,
    });
  } catch (error) {
    if (inTransaction && client) {
      await client.query('ROLLBACK').catch(() => {});
      inTransaction = false;
    }
    console.error(`POST /api/admin/exams/:id/publish-results failed (${error.code || 'UNKNOWN'})`);
    return res.status(500).json({ message: 'Unable to publish exam results.' });
  } finally {
    if (client) client.release();
  }
}

async function listAdminResults(req, res) {
  try {
    const search =
      typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const passFilter =
      typeof req.query.pass_status === 'string' ? req.query.pass_status.trim().toLowerCase() : '';
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    const addParam = (val) => {
      params.push(val);
      return `$${params.length}`;
    };

    if (passFilter && ['pass', 'fail'].includes(passFilter)) {
      conditions.push(`r.pass_status = ${addParam(passFilter)}`);
    }
    if (search) {
      const likeParam = addParam(`%${search}%`);
      conditions.push(
        `(u.name ILIKE ${likeParam} OR u.student_id ILIKE ${likeParam} OR e.title ILIKE ${likeParam})`
      );
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM results r
       INNER JOIN exams e ON r.exam_id = e.id
       INNER JOIN users u ON r.student_id = u.id
       ${where}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const limitParam = `$${params.length + 1}`;
    const offsetParam = `$${params.length + 2}`;
    const { rows } = await pool.query(
      `SELECT r.id, r.exam_id, r.student_id, r.total_obtained, r.total_max, r.percentage,
              r.grade, r.pass_status, r.publish_status, r.published_at,
              e.title AS exam_title, e.exam_type, e.department, e.semester, e.section, e.is_demo,
              u.name AS student_name, u.student_id AS roll_number
       FROM results r
       INNER JOIN exams e ON r.exam_id = e.id
       INNER JOIN users u ON r.student_id = u.id
       ${where}
       ORDER BY r.published_at DESC, r.id DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      [...params, limit, offset]
    );

    return res.status(200).json({
      results: rows,
      count: rows.length,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch {
    return res.status(500).json({ message: 'Unable to load results.' });
  }
}

// ============================================================================
// 10. VERIFY & PUBLISH SEEDED DEMO/DRAFT CONTENT (ADMIN CONTROLLED)
// ============================================================================
async function publishVerifiedDemoContent(req, res) {
  const scope = (req.body && req.body.scope) || 'all';
  const validScopes = ['all', 'notices', 'events', 'timetable', 'exams', 'subjects'];
  if (!validScopes.includes(scope)) {
    return res.status(400).json({ message: 'Invalid scope for bulk publish.' });
  }

  let client = null;
  let inTransaction = false;

  try {
    client = await pool.connect();
    await client.query('BEGIN');
    inTransaction = true;
    const updated = {};

    if (scope === 'all' || scope === 'subjects') {
      const r = await client.query(
        "UPDATE subjects SET status = 'published' WHERE status = 'draft'"
      );
      updated.subjects = r.rowCount;
    }
    if (scope === 'all' || scope === 'notices') {
      const r = await client.query(
        "UPDATE notices SET status = 'published', published_date = NOW() WHERE status = 'draft'"
      );
      updated.notices = r.rowCount;
    }
    if (scope === 'all' || scope === 'events') {
      const r = await client.query(
        "UPDATE events SET status = 'published' WHERE status = 'draft'"
      );
      updated.events = r.rowCount;
    }
    if (scope === 'all' || scope === 'timetable') {
      const r = await client.query(
        "UPDATE timetable SET status = 'published' WHERE status = 'draft'"
      );
      updated.timetable = r.rowCount;
    }
    if (scope === 'all' || scope === 'exams') {
      const r1 = await client.query(
        "UPDATE exams SET status = 'published' WHERE status = 'draft'"
      );
      const r2 = await client.query(
        "UPDATE exam_subjects SET status = 'published' WHERE status = 'draft'"
      );
      updated.exams = r1.rowCount;
      updated.exam_subjects = r2.rowCount;
    }

    await client.query('COMMIT');
    inTransaction = false;
    return res.status(200).json({
      message: 'Verified draft records published successfully.',
      updated,
    });
  } catch {
    if (inTransaction && client) {
      await client.query('ROLLBACK').catch(() => {});
      inTransaction = false;
    }
    return res.status(500).json({ message: 'Unable to publish draft records.' });
  } finally {
    if (client) client.release();
  }
}

module.exports = {
  getAdminDashboard,
  listUsers,
  createUserAccount,
  updateUserStatus,
  listDepartments,
  createDepartment,
  listSubjects,
  createSubject,
  updateSubjectStatus,
  listTeacherAssignments,
  createTeacherAssignment,
  deleteTeacherAssignment,
  listAdminNotices,
  createNotice,
  updateNoticeStatus,
  deleteNotice,
  listAdminEvents,
  createEvent,
  updateEventStatus,
  deleteEvent,
  listAdminFaculty,
  createFaculty,
  deleteFaculty,
  listAdminTimetable,
  createTimetableSlot,
  updateTimetableStatus,
  deleteTimetableSlot,
  listAdminFacilities,
  createFacility,
  updateFacilityStatus,
  deleteFacility,
  listAdminExams,
  createExam,
  addExamSubject,
  updateExamStatus,
  deleteExam,
  listMarksSubmissions,
  reviewMarkSubmission,
  approveAllExamMarks,
  publishExamResults,
  listAdminResults,
  publishVerifiedDemoContent,
};
