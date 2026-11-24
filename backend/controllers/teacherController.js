const { pool } = require('../config/db');

/**
 * Helper: verifies that the logged-in teacher is actively assigned to a
 * specific (department, semester, section, subject_id) combination.
 */
async function verifyTeacherAssignmentForExamSubject(teacherId, examSubjectId) {
  const { rows } = await pool.query(
    `SELECT
       es.id AS exam_subject_id,
       es.exam_id,
       es.subject_id,
       es.exam_date,
       es.start_time,
       es.end_time,
       es.max_marks,
       es.passing_marks,
       es.room,
       e.title AS exam_title,
       e.exam_type,
       e.department,
       e.semester,
       e.section,
       e.status AS exam_status,
       s.code AS subject_code,
       s.name AS subject_name,
       ta.id AS assignment_id
     FROM exam_subjects es
     INNER JOIN exams e ON es.exam_id = e.id
     INNER JOIN subjects s ON es.subject_id = s.id
     INNER JOIN teacher_assignments ta
       ON ta.teacher_id = $1
      AND ta.subject_id = es.subject_id
      AND LOWER(ta.department) = LOWER(e.department)
      AND ta.semester = e.semester
      AND UPPER(ta.section) = UPPER(e.section)
      AND ta.status = 'active'
     WHERE es.id = $2
     LIMIT 1`,
    [teacherId, examSubjectId]
  );

  return rows[0] || null;
}

/**
 * GET /api/teacher/dashboard
 * Overview metrics and upcoming assessments strictly for the logged-in teacher.
 */
async function getTeacherDashboard(req, res) {
  try {
    const teacherId = req.user.id;

    const { rows: assignments } = await pool.query(
      `SELECT
         ta.id,
         ta.subject_id,
         ta.department,
         ta.semester,
         ta.section,
         ta.academic_year,
         s.code AS subject_code,
         s.name AS subject_name,
         s.credits,
         (
           SELECT COUNT(*)::int
           FROM users u
           WHERE u.role = 'student'
             AND u.status = 'active'
             AND LOWER(u.department) = LOWER(ta.department)
             AND u.semester = ta.semester
             AND UPPER(COALESCE(u.section, 'A')) = UPPER(ta.section)
         ) AS student_count
       FROM teacher_assignments ta
       INNER JOIN subjects s ON ta.subject_id = s.id
       WHERE ta.teacher_id = $1 AND ta.status = 'active'
       ORDER BY ta.department ASC, ta.semester ASC, ta.section ASC, s.name ASC`,
      [teacherId]
    );

    const { rows: upcomingAssessments } = await pool.query(
      `SELECT
         es.id AS exam_subject_id,
         es.exam_id,
         es.exam_date,
         es.start_time,
         es.end_time,
         es.max_marks,
         es.passing_marks,
         es.room,
         e.title AS exam_title,
         e.exam_type,
         e.department,
         e.semester,
         e.section,
         s.code AS subject_code,
         s.name AS subject_name
       FROM exam_subjects es
       INNER JOIN exams e ON es.exam_id = e.id
       INNER JOIN subjects s ON es.subject_id = s.id
       INNER JOIN teacher_assignments ta
         ON ta.teacher_id = $1
        AND ta.subject_id = es.subject_id
        AND LOWER(ta.department) = LOWER(e.department)
        AND ta.semester = e.semester
        AND UPPER(ta.section) = UPPER(e.section)
        AND ta.status = 'active'
       WHERE e.status = 'published'
         AND es.status = 'published'
       ORDER BY es.exam_date ASC, es.start_time ASC
       LIMIT 10`,
      [teacherId]
    );

    const { rows: marksStatsRows } = await pool.query(
      `SELECT
         COUNT(*)::int AS total_entries,
         COALESCE(SUM(CASE WHEN m.submission_status = 'draft' THEN 1 ELSE 0 END), 0)::int AS draft_count,
         COALESCE(SUM(CASE WHEN m.submission_status = 'submitted' THEN 1 ELSE 0 END), 0)::int AS submitted_count,
         COALESCE(SUM(CASE WHEN m.submission_status = 'approved' THEN 1 ELSE 0 END), 0)::int AS approved_count,
         COALESCE(SUM(CASE WHEN m.submission_status = 'rejected' THEN 1 ELSE 0 END), 0)::int AS rejected_count,
         ROUND(AVG((m.obtained_marks / NULLIF(m.max_marks, 0)) * 100), 2) AS avg_percentage
       FROM marks m
       INNER JOIN exam_subjects es ON m.exam_subject_id = es.id
       INNER JOIN exams e ON es.exam_id = e.id
       INNER JOIN teacher_assignments ta
         ON ta.teacher_id = $1
        AND ta.subject_id = es.subject_id
        AND LOWER(ta.department) = LOWER(e.department)
        AND ta.semester = e.semester
        AND UPPER(ta.section) = UPPER(e.section)
        AND ta.status = 'active'`,
      [teacherId]
    );

    const uniqueClasses = new Set(
      assignments.map((a) => `${a.department}|${a.semester}|${a.section}`)
    );

    const ms = marksStatsRows[0] || {};

    return res.status(200).json({
      teacher: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        employee_id: req.user.employee_id,
        department: req.user.department,
      },
      stats: {
        assignedSubjects: assignments.length,
        assignedClasses: uniqueClasses.size,
        pendingSubmissions:
          Number(ms.draft_count || 0) + Number(ms.rejected_count || 0),
        submittedForApproval: Number(ms.submitted_count || 0),
        approvedMarks: Number(ms.approved_count || 0),
        upcomingAssessments: upcomingAssessments.length,
        averagePercentage: ms.avg_percentage !== null && ms.avg_percentage !== undefined
          ? Number(ms.avg_percentage)
          : null,
      },
      assignments,
      upcomingAssessments,
    });
  } catch (error) {
    console.error(
      `GET /api/teacher/dashboard failed (${error && error.code ? error.code : 'UNKNOWN'})`
    );
    return res.status(500).json({
      message: 'Unable to load teacher dashboard right now.',
    });
  }
}

/**
 * GET /api/teacher/assignments
 */
async function getTeacherAssignments(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT
         ta.id,
         ta.subject_id,
         ta.department,
         ta.semester,
         ta.section,
         ta.academic_year,
         ta.status,
         s.code AS subject_code,
         s.name AS subject_name,
         s.credits,
         (
           SELECT COUNT(*)::int
           FROM users u
           WHERE u.role = 'student'
             AND u.status = 'active'
             AND LOWER(u.department) = LOWER(ta.department)
             AND u.semester = ta.semester
             AND UPPER(COALESCE(u.section, 'A')) = UPPER(ta.section)
         ) AS student_count
       FROM teacher_assignments ta
       INNER JOIN subjects s ON ta.subject_id = s.id
       WHERE ta.teacher_id = $1 AND ta.status = 'active'
       ORDER BY ta.department ASC, ta.semester ASC, ta.section ASC, s.name ASC`,
      [req.user.id]
    );

    return res.status(200).json({
      assignments: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error(
      `GET /api/teacher/assignments failed (${error && error.code ? error.code : 'UNKNOWN'})`
    );
    return res.status(500).json({
      message: 'Unable to load assigned subjects.',
    });
  }
}

/**
 * GET /api/teacher/assignments/:assignmentId/students
 * Returns students strictly for an assignment owned by req.user.
 */
async function getAssignedStudents(req, res) {
  try {
    const assignmentId = Number(req.params.assignmentId);
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
      return res.status(400).json({ message: 'Invalid assignment ID.' });
    }

    const { rows: assignRows } = await pool.query(
      `SELECT ta.id, ta.teacher_id, ta.department, ta.semester, ta.section, s.code AS subject_code, s.name AS subject_name
       FROM teacher_assignments ta
       INNER JOIN subjects s ON ta.subject_id = s.id
       WHERE ta.id = $1 AND ta.status = 'active'
       LIMIT 1`,
      [assignmentId]
    );

    if (assignRows.length === 0) {
      return res.status(404).json({ message: 'Assignment not found.' });
    }

    const assignment = assignRows[0];
    if (assignment.teacher_id !== req.user.id) {
      return res.status(403).json({
        message: 'Access denied. You are not assigned to this class.',
      });
    }

    const { rows: students } = await pool.query(
      `SELECT id, name, email, student_id, department, semester, COALESCE(section, 'A') AS section
       FROM users
       WHERE role = 'student'
         AND status = 'active'
         AND LOWER(department) = LOWER($1)
         AND semester = $2
         AND UPPER(COALESCE(section, 'A')) = UPPER($3)
       ORDER BY student_id ASC, name ASC`,
      [assignment.department, assignment.semester, assignment.section]
    );

    return res.status(200).json({
      assignment: {
        id: assignment.id,
        department: assignment.department,
        semester: assignment.semester,
        section: assignment.section,
        subject_code: assignment.subject_code,
        subject_name: assignment.subject_name,
      },
      students,
      count: students.length,
    });
  } catch (error) {
    console.error(
      `GET /api/teacher/assignments/:id/students failed (${error && error.code ? error.code : 'UNKNOWN'})`
    );
    return res.status(500).json({
      message: 'Unable to load student list.',
    });
  }
}

/**
 * GET /api/teacher/exams
 * Returns published exam subjects strictly matching this teacher's active assignments.
 */
async function getTeacherExamSubjects(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT
         es.id AS exam_subject_id,
         es.exam_id,
         es.subject_id,
         es.exam_date,
         es.start_time,
         es.end_time,
         es.max_marks,
         es.passing_marks,
         es.room,
         es.instructions,
         e.title AS exam_title,
         e.exam_type,
         e.department,
         e.semester,
         e.section,
         s.code AS subject_code,
         s.name AS subject_name,
         (
           SELECT COUNT(*)::int FROM marks m WHERE m.exam_subject_id = es.id
         ) AS marks_entered_count,
         (
           SELECT COUNT(*)::int FROM marks m WHERE m.exam_subject_id = es.id AND m.submission_status = 'submitted'
         ) AS marks_submitted_count,
         (
           SELECT COUNT(*)::int FROM marks m WHERE m.exam_subject_id = es.id AND m.submission_status = 'approved'
         ) AS marks_approved_count
       FROM exam_subjects es
       INNER JOIN exams e ON es.exam_id = e.id
       INNER JOIN subjects s ON es.subject_id = s.id
       INNER JOIN teacher_assignments ta
         ON ta.teacher_id = $1
        AND ta.subject_id = es.subject_id
        AND LOWER(ta.department) = LOWER(e.department)
        AND ta.semester = e.semester
        AND UPPER(ta.section) = UPPER(e.section)
        AND ta.status = 'active'
       WHERE e.status = 'published' AND es.status = 'published'
       ORDER BY es.exam_date ASC, es.start_time ASC`,
      [req.user.id]
    );

    return res.status(200).json({
      examSubjects: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error(
      `GET /api/teacher/exams failed (${error && error.code ? error.code : 'UNKNOWN'})`
    );
    return res.status(500).json({
      message: 'Unable to load assigned examinations.',
    });
  }
}

/**
 * GET /api/teacher/exam-subjects/:examSubjectId/marks
 * Returns the student roster + entered marks for a teacher-assigned exam subject.
 */
async function getExamSubjectMarks(req, res) {
  try {
    const examSubjectId = Number(req.params.examSubjectId);
    if (!Number.isInteger(examSubjectId) || examSubjectId <= 0) {
      return res.status(400).json({ message: 'Invalid exam subject ID.' });
    }

    const assigned = await verifyTeacherAssignmentForExamSubject(
      req.user.id,
      examSubjectId
    );
    if (!assigned) {
      return res.status(403).json({
        message:
          'Access denied. You are not assigned to this subject or class.',
      });
    }

    const { rows: roster } = await pool.query(
      `SELECT
         u.id AS student_user_id,
         u.name AS student_name,
         u.student_id AS roll_number,
         u.department,
         u.semester,
         COALESCE(u.section, 'A') AS section,
         m.id AS mark_id,
         m.obtained_marks,
         m.remarks,
         m.submission_status,
         m.submitted_at,
         m.review_notes,
         r.publish_status AS result_publish_status
       FROM users u
       LEFT JOIN marks m
         ON m.student_id = u.id AND m.exam_subject_id = $1
       LEFT JOIN results r
         ON r.student_id = u.id AND r.exam_id = $2
       WHERE u.role = 'student'
         AND u.status = 'active'
         AND LOWER(u.department) = LOWER($3)
         AND u.semester = $4
         AND UPPER(COALESCE(u.section, 'A')) = UPPER($5)
       ORDER BY u.student_id ASC, u.name ASC`,
      [
        examSubjectId,
        assigned.exam_id,
        assigned.department,
        assigned.semester,
        assigned.section,
      ]
    );

    return res.status(200).json({
      examSubject: assigned,
      roster,
    });
  } catch (error) {
    console.error(
      `GET /api/teacher/exam-subjects/:id/marks failed (${error && error.code ? error.code : 'UNKNOWN'})`
    );
    return res.status(500).json({
      message: 'Unable to load marks sheet.',
    });
  }
}

/**
 * POST /api/teacher/marks
 * Enters or updates marks for a student in an exam subject assigned to the teacher.
 * Enforces: assigned class only, 0 <= obtained <= max_marks, cannot modify approved/published marks.
 */
async function upsertStudentMark(req, res) {
  try {
    const { exam_subject_id, student_id, obtained_marks, remarks } =
      req.body || {};

    const examSubjectId = Number(exam_subject_id);
    const studentUserId = Number(student_id);
    const numericMarks = Number(obtained_marks);

    if (
      !Number.isInteger(examSubjectId) ||
      examSubjectId <= 0 ||
      !Number.isInteger(studentUserId) ||
      studentUserId <= 0
    ) {
      return res.status(400).json({
        message: 'Valid exam_subject_id and student_id are required.',
      });
    }

    if (
      obtained_marks === '' ||
      obtained_marks === null ||
      obtained_marks === undefined ||
      Number.isNaN(numericMarks)
    ) {
      return res.status(400).json({
        message: 'Obtained marks must be a valid number.',
      });
    }

    const assigned = await verifyTeacherAssignmentForExamSubject(
      req.user.id,
      examSubjectId
    );
    if (!assigned) {
      return res.status(403).json({
        message:
          'Access denied. You can only enter marks for your assigned subjects and classes.',
      });
    }

    const maxMarks = Number(assigned.max_marks);
    if (numericMarks < 0 || numericMarks > maxMarks) {
      return res.status(400).json({
        message: `Obtained marks must be between 0 and ${maxMarks}.`,
      });
    }

    // Verify student belongs to this exact class (department, semester, section)
    const { rows: studentRows } = await pool.query(
      `SELECT id, name, student_id
       FROM users
       WHERE id = $1
         AND role = 'student'
         AND status = 'active'
         AND LOWER(department) = LOWER($2)
         AND semester = $3
         AND UPPER(COALESCE(section, 'A')) = UPPER($4)
       LIMIT 1`,
      [
        studentUserId,
        assigned.department,
        assigned.semester,
        assigned.section,
      ]
    );

    if (studentRows.length === 0) {
      return res.status(403).json({
        message:
          'This student does not belong to your assigned class for this exam.',
      });
    }

    // Prevent modifying marks after result publication
    const { rows: pubRows } = await pool.query(
      `SELECT publish_status FROM results WHERE exam_id = $1 AND student_id = $2 LIMIT 1`,
      [assigned.exam_id, studentUserId]
    );
    if (pubRows.length > 0 && pubRows[0].publish_status === 'published') {
      return res.status(409).json({
        message:
          'Results for this examination are already published and cannot be edited by teachers.',
      });
    }

    // Check existing mark to prevent unauthorized duplicates or edits of approved marks
    const { rows: existingRows } = await pool.query(
      `SELECT id, submission_status FROM marks WHERE exam_subject_id = $1 AND student_id = $2 LIMIT 1`,
      [examSubjectId, studentUserId]
    );

    const cleanRemarks =
      typeof remarks === 'string' ? remarks.trim().slice(0, 255) : null;

    if (existingRows.length > 0) {
      const existing = existingRows[0];
      if (existing.submission_status === 'approved') {
        return res.status(409).json({
          message:
            'These marks have already been approved by an administrator and are locked.',
        });
      }

      await pool.query(
        `UPDATE marks
         SET obtained_marks = $1,
             max_marks = $2,
             remarks = $3,
             entered_by = $4,
             submission_status = 'draft',
             review_notes = NULL
         WHERE id = $5`,
        [numericMarks, maxMarks, cleanRemarks, req.user.id, existing.id]
      );

      return res.status(200).json({
        message: 'Student marks updated and saved as draft.',
        markId: existing.id,
        submission_status: 'draft',
      });
    }

    const { rows: insertedRows } = await pool.query(
      `INSERT INTO marks
         (exam_subject_id, student_id, subject_id, entered_by, obtained_marks, max_marks, remarks, submission_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
       RETURNING id`,
      [
        examSubjectId,
        studentUserId,
        assigned.subject_id,
        req.user.id,
        numericMarks,
        maxMarks,
        cleanRemarks,
      ]
    );

    return res.status(201).json({
      message: 'Student marks saved as draft.',
      markId: insertedRows[0].id,
      submission_status: 'draft',
    });
  } catch (error) {
    console.error(
      `POST /api/teacher/marks failed (${error && error.code ? error.code : 'UNKNOWN'})`
    );
    return res.status(500).json({
      message: 'Unable to save marks right now.',
    });
  }
}

/**
 * POST /api/teacher/exam-subjects/:examSubjectId/submit
 * Submits all draft/rejected marks for an assigned exam subject to Admin for approval.
 * Teachers CANNOT approve or publish results.
 */
async function submitMarksForApproval(req, res) {
  try {
    const examSubjectId = Number(req.params.examSubjectId);
    if (!Number.isInteger(examSubjectId) || examSubjectId <= 0) {
      return res.status(400).json({ message: 'Invalid exam subject ID.' });
    }

    const assigned = await verifyTeacherAssignmentForExamSubject(
      req.user.id,
      examSubjectId
    );
    if (!assigned) {
      return res.status(403).json({
        message:
          'Access denied. You are not assigned to this exam subject.',
      });
    }

    const result = await pool.query(
      `UPDATE marks
       SET submission_status = 'submitted',
           submitted_at = NOW()
       WHERE exam_subject_id = $1
         AND submission_status IN ('draft', 'rejected')`,
      [examSubjectId]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({
        message:
          'No draft or rejected marks found to submit for this assessment.',
      });
    }

    return res.status(200).json({
      message: `Submitted ${result.rowCount} mark record(s) for administrator approval.`,
      submittedCount: result.rowCount,
    });
  } catch (error) {
    console.error(
      `POST /api/teacher/exam-subjects/:id/submit failed (${error && error.code ? error.code : 'UNKNOWN'})`
    );
    return res.status(500).json({
      message: 'Unable to submit marks for approval.',
    });
  }
}

/**
 * GET /api/teacher/performance
 * Performance statistics strictly across the logged-in teacher's assigned classes.
 */
async function getTeacherPerformance(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT
         es.id AS exam_subject_id,
         e.title AS exam_title,
         e.exam_type,
         e.department,
         e.semester,
         e.section,
         s.code AS subject_code,
         s.name AS subject_name,
         es.max_marks,
         es.passing_marks,
         COUNT(m.id)::int AS graded_count,
         ROUND(AVG(m.obtained_marks), 2) AS avg_marks,
         MAX(m.obtained_marks) AS highest_marks,
         MIN(m.obtained_marks) AS lowest_marks,
         COALESCE(SUM(CASE WHEN m.obtained_marks >= es.passing_marks THEN 1 ELSE 0 END), 0)::int AS pass_count
       FROM exam_subjects es
       INNER JOIN exams e ON es.exam_id = e.id
       INNER JOIN subjects s ON es.subject_id = s.id
       INNER JOIN teacher_assignments ta
         ON ta.teacher_id = $1
        AND ta.subject_id = es.subject_id
        AND LOWER(ta.department) = LOWER(e.department)
        AND ta.semester = e.semester
        AND UPPER(ta.section) = UPPER(e.section)
        AND ta.status = 'active'
       LEFT JOIN marks m ON m.exam_subject_id = es.id
       WHERE e.status = 'published'
       GROUP BY
         es.id, es.exam_date, es.max_marks, es.passing_marks,
         e.id, e.title, e.exam_type, e.department, e.semester, e.section,
         s.id, s.code, s.name
       ORDER BY es.exam_date DESC`,
      [req.user.id]
    );

    return res.status(200).json({
      performance: rows,
    });
  } catch (error) {
    console.error(
      `GET /api/teacher/performance failed (${error && error.code ? error.code : 'UNKNOWN'})`
    );
    return res.status(500).json({
      message: 'Unable to load performance statistics.',
    });
  }
}

/**
 * GET /api/teacher/timetable
 * Returns published timetable entries linked to this teacher's faculty profile
 * or assigned classes/subjects.
 */
async function getTeacherTimetable(req, res) {
  try {
    const { rows } = await pool.query(
      `WITH teacher_slots AS (
         SELECT DISTINCT
           t.id,
           t.department,
           t.semester,
           t.section,
           t.subject,
           t.day_of_week,
           t.start_time,
           t.end_time,
           t.classroom,
           f.name AS faculty_name
         FROM timetable t
         LEFT JOIN faculty f ON t.faculty_id = f.id
         LEFT JOIN teacher_assignments ta
           ON ta.teacher_id = $1
          AND ta.status = 'active'
          AND LOWER(ta.department) = LOWER(t.department)
          AND ta.semester = t.semester
          AND UPPER(ta.section) = UPPER(t.section)
         LEFT JOIN subjects s ON ta.subject_id = s.id
         WHERE t.status = 'published'
           AND (
             ($2::int IS NOT NULL AND t.faculty_id = $2::int)
             OR (s.id IS NOT NULL AND LOWER(t.subject) = LOWER(s.name))
           )
       )
       SELECT
         id,
         department,
         semester,
         section,
         subject,
         day_of_week,
         start_time,
         end_time,
         classroom,
         faculty_name
       FROM teacher_slots
       ORDER BY
         CASE day_of_week
           WHEN 'Monday' THEN 1
           WHEN 'Tuesday' THEN 2
           WHEN 'Wednesday' THEN 3
           WHEN 'Thursday' THEN 4
           WHEN 'Friday' THEN 5
           WHEN 'Saturday' THEN 6
           ELSE 7
         END,
         start_time ASC`,
      [req.user.id, req.user.faculty_id ?? null]
    );

    return res.status(200).json({
      timetable: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error(
      `GET /api/teacher/timetable failed (${error && error.code ? error.code : 'UNKNOWN'})`
    );
    return res.status(500).json({
      message: 'Unable to load teacher timetable.',
    });
  }
}

module.exports = {
  getTeacherDashboard,
  getTeacherAssignments,
  getAssignedStudents,
  getTeacherExamSubjects,
  getExamSubjectMarks,
  upsertStudentMark,
  submitMarksForApproval,
  getTeacherPerformance,
  getTeacherTimetable,
};
