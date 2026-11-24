const { pool } = require('../config/db');
const { getGradingRules } = require('../config/gradingRules');

const VALID_NOTICE_CATEGORIES = [
  'academic',
  'exam',
  'event',
  'placement',
  'holiday',
  'general',
];

const VALID_EVENT_FILTERS = ['upcoming', 'past', 'all'];

const VALID_EVENT_CATEGORIES = [
  'technical_workshop',
  'hackathon',
  'coding_competition',
  'cultural',
  'sports',
  'seminar',
  'guest_lecture',
  'entrepreneurship',
  'placement',
  'career_guidance',
  'club',
  'general',
];

const VALID_EXAM_TYPES = [
  'internal_1',
  'internal_2',
  'mid_semester',
  'end_semester',
  'practical',
  'assignment',
];

const VALID_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const VALID_FACILITY_CATEGORIES = [
  'academic',
  'library',
  'lab',
  'sports',
  'hostel',
  'dining',
  'medical',
  'other',
];

const VALID_FACILITY_STATUSES = ['open', 'closed', 'maintenance'];

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function sanitizeProfile(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    student_id: user.student_id,
    employee_id: user.employee_id || null,
    department: user.department,
    semester: user.semester,
    section: user.section || (user.role === 'student' ? 'A' : null),
    status: user.status,
    created_at: user.created_at,
  };
}

/**
 * GET /api/public/highlights
 * Safe public Landing Page data — returns ONLY published notices & published
 * upcoming events (never exposes drafts, users, or private student data).
 */
async function getPublicHighlights(req, res) {
  try {
    const [
      { rows: notices },
      { rows: events },
      { rows: deptCount },
      { rows: facCount },
      { rows: facilCount },
    ] = await Promise.all([
      pool.query(
        `SELECT id, title, description, category, target_department, priority, published_date, is_demo
         FROM notices
         WHERE status = 'published'
         ORDER BY
           CASE priority
             WHEN 'urgent' THEN 1
             WHEN 'important' THEN 2
             WHEN 'normal' THEN 3
             ELSE 4
           END,
           published_date DESC
         LIMIT 4`
      ),
      pool.query(
        `SELECT id, title, description, category, target_department, semester_eligibility,
                event_date, event_time, venue, organizer, registration_details, image_url,
                registration_link, is_demo
         FROM events
         WHERE status = 'published' AND event_date >= CURRENT_DATE
         ORDER BY event_date ASC, event_time ASC
         LIMIT 6`
      ),
      pool.query(
        "SELECT COUNT(*)::int AS total FROM departments WHERE status = 'active'"
      ),
      pool.query('SELECT COUNT(*)::int AS total FROM faculty'),
      pool.query(
        "SELECT COUNT(*)::int AS total FROM facilities WHERE status = 'open'"
      ),
    ]);

    return res.status(200).json({
      notices,
      events,
      stats: {
        departments: Number(deptCount[0]?.total || 0),
        faculty: Number(facCount[0]?.total || 0),
        openFacilities: Number(facilCount[0]?.total || 0),
        upcomingEvents: events.length,
      },
    });
  } catch (error) {
    console.error(`GET /api/public/highlights failed (${error.code || 'UNKNOWN'})`);
    return res.status(500).json({ message: 'Unable to load campus highlights.' });
  }
}

/**
 * GET /api/notices
 * Returns published notices only (drafts are NEVER exposed to students/teachers).
 */
async function getNotices(req, res) {
  try {
    const rawCategory =
      typeof req.query.category === 'string'
        ? req.query.category.trim().toLowerCase()
        : '';

    if (
      rawCategory &&
      rawCategory !== 'all' &&
      !VALID_NOTICE_CATEGORIES.includes(rawCategory)
    ) {
      return res.status(400).json({
        message: 'Invalid notice category filter.',
      });
    }

    const conditions = ["n.status = 'published'"];
    const params = [];
    const addParam = (val) => {
      params.push(val);
      return `$${params.length}`;
    };

    if (req.user.role === 'student') {
      if (req.user.department) {
        const deptParam = addParam(req.user.department);
        conditions.push(
          `(LOWER(n.target_department) = 'all' OR LOWER(n.target_department) = LOWER(${deptParam}))`
        );
      } else {
        conditions.push("LOWER(n.target_department) = 'all'");
      }
    }

    if (rawCategory && rawCategory !== 'all') {
      conditions.push(`n.category = ${addParam(rawCategory)}`);
    }

    const sql = `
      SELECT
        n.id, n.title, n.description, n.category, n.target_department,
        n.priority, n.status, n.is_demo, n.published_date, n.created_at,
        u.name AS posted_by_name
      FROM notices n
      LEFT JOIN users u ON n.posted_by = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE n.priority
          WHEN 'urgent' THEN 1
          WHEN 'important' THEN 2
          WHEN 'normal' THEN 3
          ELSE 4
        END,
        n.published_date DESC,
        n.id DESC
    `;

    const { rows } = await pool.query(sql, params);
    return res.status(200).json({ notices: rows, count: rows.length });
  } catch (error) {
    console.error(`GET /api/notices failed (${error.code || 'UNKNOWN'})`);
    return res.status(500).json({
      message: 'Unable to load notices right now. Please try again later.',
    });
  }
}

/**
 * GET /api/events
 * Returns PUBLISHED college events only.
 * Supports ?filter=upcoming|past|all, ?category=, ?department=, ?search=
 */
async function getEvents(req, res) {
  try {
    const rawFilter =
      typeof req.query.filter === 'string' && req.query.filter.trim()
        ? req.query.filter.trim().toLowerCase()
        : 'all';
    const rawCategory =
      typeof req.query.category === 'string'
        ? req.query.category.trim().toLowerCase()
        : '';
    const rawDept =
      typeof req.query.department === 'string'
        ? req.query.department.trim()
        : '';
    const rawSearch =
      typeof req.query.search === 'string' ? req.query.search.trim() : '';

    if (!VALID_EVENT_FILTERS.includes(rawFilter)) {
      return res.status(400).json({
        message: 'Invalid event filter. Use upcoming, past, or all.',
      });
    }

    if (
      rawCategory &&
      rawCategory !== 'all' &&
      !VALID_EVENT_CATEGORIES.includes(rawCategory)
    ) {
      return res.status(400).json({
        message: 'Invalid event category filter.',
      });
    }

    const conditions = ["e.status = 'published'"];
    const params = [];
    const addParam = (val) => {
      params.push(val);
      return `$${params.length}`;
    };

    if (rawFilter === 'upcoming') {
      conditions.push('e.event_date >= CURRENT_DATE');
    } else if (rawFilter === 'past') {
      conditions.push('e.event_date < CURRENT_DATE');
    }

    if (rawCategory && rawCategory !== 'all') {
      conditions.push(`e.category = ${addParam(rawCategory)}`);
    }

    if (rawDept && rawDept.toLowerCase() !== 'all') {
      const deptParam = addParam(rawDept);
      conditions.push(
        `(LOWER(e.target_department) = 'all' OR LOWER(e.target_department) = LOWER(${deptParam}))`
      );
    }

    if (rawSearch) {
      const likeParam = addParam(`%${rawSearch}%`);
      conditions.push(
        `(e.title ILIKE ${likeParam} OR e.description ILIKE ${likeParam} OR e.venue ILIKE ${likeParam} OR e.organizer ILIKE ${likeParam})`
      );
    }

    const orderClause =
      rawFilter === 'past'
        ? 'ORDER BY e.event_date DESC, e.event_time DESC, e.id DESC'
        : 'ORDER BY e.event_date ASC, e.event_time ASC, e.id ASC';

    const sql = `
      SELECT
        e.id, e.title, e.description, e.category, e.target_department,
        e.semester_eligibility, e.event_date, e.event_time, e.venue,
        e.organizer, e.registration_details, e.image_url, e.registration_link,
        e.status, e.is_demo, e.created_at,
        u.name AS created_by_name
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE ${conditions.join(' AND ')}
      ${orderClause}
    `;

    const { rows } = await pool.query(sql, params);

    return res.status(200).json({
      events: rows,
      count: rows.length,
      filter: rawFilter,
    });
  } catch (error) {
    console.error(`GET /api/events failed (${error.code || 'UNKNOWN'})`);
    return res.status(500).json({
      message: 'Unable to load campus events right now. Please try again later.',
    });
  }
}

/**
 * GET /api/timetable
 * Returns PUBLISHED timetable records scoped strictly to student's DB department,
 * semester, and section.
 */
async function getTimetable(req, res) {
  try {
    const rawDay =
      typeof req.query.day === 'string' ? req.query.day.trim() : '';

    let matchedDay = null;
    if (rawDay && rawDay.toLowerCase() !== 'all') {
      matchedDay =
        VALID_DAYS.find((d) => d.toLowerCase() === rawDay.toLowerCase()) ||
        null;
      if (!matchedDay) {
        return res.status(400).json({
          message: 'Invalid day filter. Use Monday through Saturday or All.',
        });
      }
    }

    const conditions = ["t.status = 'published'"];
    const params = [];
    const addParam = (val) => {
      params.push(val);
      return `$${params.length}`;
    };

    if (req.user.role === 'student') {
      if (!req.user.department || !req.user.semester) {
        return res.status(200).json({
          timetable: [],
          count: 0,
          scope: {
            department: req.user.department || null,
            semester: req.user.semester || null,
            section: req.user.section || 'A',
          },
        });
      }

      conditions.push(`LOWER(t.department) = LOWER(${addParam(req.user.department)})`);
      conditions.push(`t.semester = ${addParam(req.user.semester)}`);
      conditions.push(`UPPER(t.section) = UPPER(${addParam(req.user.section || 'A')})`);
    }

    if (matchedDay) {
      conditions.push(`t.day_of_week = ${addParam(matchedDay)}`);
    }

    const sql = `
      SELECT
        t.id, t.department, t.semester, t.section, t.subject, t.faculty_id,
        t.day_of_week, t.start_time, t.end_time, t.classroom, t.is_demo,
        f.name AS faculty_name, f.designation AS faculty_designation,
        f.email AS faculty_email, f.office_location AS faculty_office
      FROM timetable t
      LEFT JOIN faculty f ON t.faculty_id = f.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE t.day_of_week
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
          ELSE 7
        END,
        t.start_time ASC,
        t.section ASC
    `;

    const { rows } = await pool.query(sql, params);

    return res.status(200).json({
      timetable: rows,
      count: rows.length,
      scope: {
        department: req.user.department || null,
        semester: req.user.semester || null,
        section: req.user.section || 'A',
      },
    });
  } catch (error) {
    console.error(`GET /api/timetable failed (${error.code || 'UNKNOWN'})`);
    return res.status(500).json({
      message: 'Unable to load timetable right now. Please try again later.',
    });
  }
}

/**
 * GET /api/faculty
 */
async function getFaculty(req, res) {
  try {
    const rawDepartment =
      typeof req.query.department === 'string'
        ? req.query.department.trim()
        : '';
    const rawSearch =
      typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const conditions = [];
    const params = [];
    const addParam = (val) => {
      params.push(val);
      return `$${params.length}`;
    };

    if (rawDepartment && rawDepartment.toLowerCase() !== 'all') {
      conditions.push(`LOWER(department) = LOWER(${addParam(rawDepartment)})`);
    }

    if (rawSearch) {
      const likeParam = addParam(`%${rawSearch}%`);
      conditions.push(
        `(name ILIKE ${likeParam} OR department ILIKE ${likeParam} OR designation ILIKE ${likeParam} OR office_location ILIKE ${likeParam})`
      );
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT id, name, department, designation, email, phone, office_location, consultation_hours, is_demo
       FROM faculty
       ${whereClause}
       ORDER BY department ASC, name ASC`,
      params
    );

    return res.status(200).json({ faculty: rows, count: rows.length });
  } catch (error) {
    console.error(`GET /api/faculty failed (${error.code || 'UNKNOWN'})`);
    return res.status(500).json({
      message: 'Unable to load the faculty directory right now.',
    });
  }
}

/**
 * GET /api/facilities
 */
async function getFacilities(req, res) {
  try {
    const rawCategory =
      typeof req.query.category === 'string'
        ? req.query.category.trim().toLowerCase()
        : '';
    const rawStatus =
      typeof req.query.status === 'string'
        ? req.query.status.trim().toLowerCase()
        : '';

    if (
      rawCategory &&
      rawCategory !== 'all' &&
      !VALID_FACILITY_CATEGORIES.includes(rawCategory)
    ) {
      return res.status(400).json({ message: 'Invalid facility category filter.' });
    }

    if (
      rawStatus &&
      rawStatus !== 'all' &&
      !VALID_FACILITY_STATUSES.includes(rawStatus)
    ) {
      return res.status(400).json({ message: 'Invalid facility status filter.' });
    }

    const conditions = [];
    const params = [];
    const addParam = (val) => {
      params.push(val);
      return `$${params.length}`;
    };

    if (rawCategory && rawCategory !== 'all') {
      conditions.push(`category = ${addParam(rawCategory)}`);
    }
    if (rawStatus && rawStatus !== 'all') {
      conditions.push(`status = ${addParam(rawStatus)}`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT id, name, category, description, location, opening_hours, contact_info, status, is_demo
       FROM facilities
       ${whereClause}
       ORDER BY
         CASE status
           WHEN 'open' THEN 1
           WHEN 'maintenance' THEN 2
           WHEN 'closed' THEN 3
           ELSE 4
         END,
         name ASC`,
      params
    );

    return res.status(200).json({ facilities: rows, count: rows.length });
  } catch (error) {
    console.error(`GET /api/facilities failed (${error.code || 'UNKNOWN'})`);
    return res.status(500).json({
      message: 'Unable to load campus facilities right now.',
    });
  }
}

/**
 * GET /api/student/exams
 * Returns PUBLISHED examination schedules strictly matching the authenticated
 * student's department, semester, and section. Supports ?exam_type= filter.
 */
async function getStudentExams(req, res) {
  try {
    const rawType =
      typeof req.query.exam_type === 'string'
        ? req.query.exam_type.trim().toLowerCase()
        : '';

    if (rawType && rawType !== 'all' && !VALID_EXAM_TYPES.includes(rawType)) {
      return res.status(400).json({ message: 'Invalid examination type filter.' });
    }

    if (!req.user.department || !req.user.semester) {
      return res.status(200).json({ exams: [], count: 0 });
    }

    const conditions = [
      "e.status = 'published'",
      "es.status = 'published'",
      'LOWER(e.department) = LOWER($1)',
      'e.semester = $2',
      'UPPER(e.section) = UPPER($3)',
    ];
    const params = [
      req.user.department,
      req.user.semester,
      req.user.section || 'A',
    ];

    if (rawType && rawType !== 'all') {
      params.push(rawType);
      conditions.push(`e.exam_type = $${params.length}`);
    }

    const { rows } = await pool.query(
      `SELECT
         es.id AS exam_subject_id,
         e.id AS exam_id,
         e.title AS exam_title,
         e.exam_type,
         e.department,
         e.semester,
         e.section,
         e.instructions AS exam_instructions,
         e.is_demo,
         s.code AS subject_code,
         s.name AS subject_name,
         es.exam_date,
         es.start_time,
         es.end_time,
         es.max_marks,
         es.passing_marks,
         es.room,
         es.instructions AS paper_instructions
       FROM exam_subjects es
       INNER JOIN exams e ON es.exam_id = e.id
       INNER JOIN subjects s ON es.subject_id = s.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY es.exam_date ASC, es.start_time ASC`,
      params
    );

    return res.status(200).json({
      exams: rows,
      count: rows.length,
      scope: {
        department: req.user.department,
        semester: req.user.semester,
        section: req.user.section || 'A',
      },
    });
  } catch (error) {
    console.error(`GET /api/student/exams failed (${error.code || 'UNKNOWN'})`);
    return res.status(500).json({ message: 'Unable to load examination schedules.' });
  }
}

/**
 * GET /api/student/results
 * Strictly private: returns ONLY the logged-in student's OWN published results
 * and subject-wise approved marks. Unapproved or unpublished results are NEVER returned.
 */
async function getStudentResults(req, res) {
  try {
    const studentUserId = req.user.id;

    const { rows: resultsRows } = await pool.query(
      `SELECT
         r.id AS result_id,
         r.exam_id,
         r.total_obtained,
         r.total_max,
         r.percentage,
         r.grade,
         r.pass_status,
         r.published_at,
         e.title AS exam_title,
         e.exam_type,
         e.department,
         e.semester,
         e.section,
         e.academic_year
       FROM results r
       INNER JOIN exams e ON r.exam_id = e.id
       WHERE r.student_id = $1 AND r.publish_status = 'published'
       ORDER BY r.published_at DESC, r.id DESC`,
      [studentUserId]
    );

    if (resultsRows.length === 0) {
      return res.status(200).json({
        results: [],
        count: 0,
        gradingRules: getGradingRules(),
      });
    }

    const examIds = resultsRows
      .map((r) => Number(r.exam_id))
      .filter((id) => Number.isInteger(id));

    let markRows = [];
    if (examIds.length > 0) {
      const marksResult = await pool.query(
        `SELECT
           es.exam_id,
           s.code AS subject_code,
           s.name AS subject_name,
           m.obtained_marks,
           m.max_marks,
           es.passing_marks,
           m.remarks
         FROM marks m
         INNER JOIN exam_subjects es ON m.exam_subject_id = es.id
         INNER JOIN subjects s ON m.subject_id = s.id
         WHERE m.student_id = $1
           AND m.submission_status = 'approved'
           AND es.exam_id = ANY($2::int[])
         ORDER BY s.code ASC`,
        [studentUserId, examIds]
      );
      markRows = marksResult.rows;
    }

    const marksByExam = new Map();
    for (const row of markRows) {
      if (!marksByExam.has(row.exam_id)) marksByExam.set(row.exam_id, []);
      marksByExam.get(row.exam_id).push({
        ...row,
        subject_status:
          Number(row.obtained_marks) >= Number(row.passing_marks)
            ? 'pass'
            : 'fail',
      });
    }

    const enrichedResults = resultsRows.map((r) => ({
      ...r,
      subjects: marksByExam.get(r.exam_id) || [],
    }));

    return res.status(200).json({
      results: enrichedResults,
      count: enrichedResults.length,
      gradingRules: getGradingRules(),
    });
  } catch (error) {
    console.error(`GET /api/student/results failed (${error.code || 'UNKNOWN'})`);
    return res.status(500).json({ message: 'Unable to load examination results.' });
  }
}

/**
 * GET /api/dashboard
 * Student-specific dashboard summary derived strictly from req.user.
 */
async function getStudentDashboard(req, res) {
  try {
    const student = sanitizeProfile(req.user);
    const todayName = WEEKDAY_NAMES[new Date().getDay()];
    const studentSection = student.section || 'A';

    const noticeWhere = student.department
      ? "n.status = 'published' AND (LOWER(n.target_department) = 'all' OR LOWER(n.target_department) = LOWER($1))"
      : "n.status = 'published' AND LOWER(n.target_department) = 'all'";
    const noticeParams = student.department ? [student.department] : [];

    const hasAcademicScope = Boolean(student.department && student.semester);

    const [
      { rows: noticeCountRows },
      { rows: latestNotices },
      { rows: eventCountRows },
      { rows: upcomingEvents },
      { rows: timetableRows },
      { rows: facilitySummaryRows },
      { rows: facultyCountRows },
      { rows: upcomingExams },
      { rows: recentResults },
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total FROM notices n WHERE ${noticeWhere}`,
        noticeParams
      ),
      pool.query(
        `SELECT
           n.id, n.title, n.description, n.category, n.target_department,
           n.priority, n.status, n.is_demo, n.published_date, u.name AS posted_by_name
         FROM notices n
         LEFT JOIN users u ON n.posted_by = u.id
         WHERE ${noticeWhere}
         ORDER BY
           CASE n.priority
             WHEN 'urgent' THEN 1
             WHEN 'important' THEN 2
             WHEN 'normal' THEN 3
             ELSE 4
           END,
           n.published_date DESC,
           n.id DESC
         LIMIT 5`,
        noticeParams
      ),
      pool.query(
        "SELECT COUNT(*)::int AS total FROM events WHERE status = 'published' AND event_date >= CURRENT_DATE"
      ),
      pool.query(
        `SELECT
           id, title, description, category, target_department, semester_eligibility,
           event_date, event_time, venue, organizer, registration_details, image_url,
           registration_link, is_demo
         FROM events
         WHERE status = 'published' AND event_date >= CURRENT_DATE
         ORDER BY event_date ASC, event_time ASC, id ASC
         LIMIT 5`
      ),
      hasAcademicScope
        ? pool.query(
            `SELECT
               t.id, t.department, t.semester, t.section, t.subject,
               t.day_of_week, t.start_time, t.end_time, t.classroom,
               f.name AS faculty_name
             FROM timetable t
             LEFT JOIN faculty f ON t.faculty_id = f.id
             WHERE t.status = 'published'
               AND LOWER(t.department) = LOWER($1)
               AND t.semester = $2
               AND UPPER(t.section) = UPPER($3)
             ORDER BY
               CASE t.day_of_week
                 WHEN 'Monday' THEN 1
                 WHEN 'Tuesday' THEN 2
                 WHEN 'Wednesday' THEN 3
                 WHEN 'Thursday' THEN 4
                 WHEN 'Friday' THEN 5
                 WHEN 'Saturday' THEN 6
                 ELSE 7
               END,
               t.start_time ASC`,
            [student.department, student.semester, studentSection]
          )
        : Promise.resolve({ rows: [] }),
      pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COALESCE(SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END), 0)::int AS open_count
         FROM facilities`
      ),
      pool.query('SELECT COUNT(*)::int AS total FROM faculty'),
      hasAcademicScope
        ? pool.query(
            `SELECT
               es.id AS exam_subject_id, e.id AS exam_id, e.title AS exam_title,
               e.exam_type, s.code AS subject_code, s.name AS subject_name,
               es.exam_date, es.start_time, es.end_time, es.max_marks, es.room
             FROM exam_subjects es
             INNER JOIN exams e ON es.exam_id = e.id
             INNER JOIN subjects s ON es.subject_id = s.id
             WHERE e.status = 'published'
               AND es.status = 'published'
               AND LOWER(e.department) = LOWER($1)
               AND e.semester = $2
               AND UPPER(e.section) = UPPER($3)
             ORDER BY es.exam_date ASC, es.start_time ASC
             LIMIT 6`,
            [student.department, student.semester, studentSection]
          )
        : Promise.resolve({ rows: [] }),
      pool.query(
        `SELECT
           r.id AS result_id, r.exam_id, r.total_obtained, r.total_max,
           r.percentage, r.grade, r.pass_status, r.published_at,
           e.title AS exam_title, e.exam_type
         FROM results r
         INNER JOIN exams e ON r.exam_id = e.id
         WHERE r.student_id = $1 AND r.publish_status = 'published'
         ORDER BY r.published_at DESC
         LIMIT 5`,
        [student.id]
      ),
    ]);

    const todayClasses = timetableRows.filter(
      (slot) => slot.day_of_week === todayName
    );
    const timetablePreview =
      todayClasses.length > 0 ? todayClasses : timetableRows.slice(0, 5);

    const totalFacilities = Number(facilitySummaryRows[0]?.total || 0);
    const openFacilities = Number(facilitySummaryRows[0]?.open_count || 0);

    return res.status(200).json({
      student,
      todayDay: todayName,
      stats: {
        publishedNotices: Number(noticeCountRows[0]?.total || 0),
        upcomingEvents: Number(eventCountRows[0]?.total || 0),
        weeklyClasses: timetableRows.length,
        todayClasses: todayClasses.length,
        openFacilities,
        totalFacilities,
        facultyCount: Number(facultyCountRows[0]?.total || 0),
        upcomingExams: upcomingExams.length,
        publishedResults: recentResults.length,
      },
      latestNotices,
      upcomingEvents,
      timetablePreview,
      upcomingExams,
      recentResults,
    });
  } catch (error) {
    console.error(`GET /api/dashboard failed (${error.code || 'UNKNOWN'})`);
    return res.status(500).json({
      message: 'Unable to load your student dashboard right now.',
    });
  }
}

module.exports = {
  getPublicHighlights,
  getNotices,
  getEvents,
  getTimetable,
  getFaculty,
  getFacilities,
  getStudentExams,
  getStudentResults,
  getStudentDashboard,
};
