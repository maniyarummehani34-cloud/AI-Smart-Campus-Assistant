-- ============================================================================
-- AI-Powered Smart Campus Assistant — Upgrade Migration 001
-- Database: campus_assistant_db_v2
-- ============================================================================
-- IMPORTANT:
--   * Separate migration file (does NOT overwrite database/schema.sql).
--   * Preserves all existing tables, triggers, and existing user accounts.
--   * Safe to run via backend/scripts/runMigration.js or phpMyAdmin Import.
-- ============================================================================

USE campus_assistant_db_v2;

-- ----------------------------------------------------------------------------
-- 1. EXTEND USERS TABLE FOR 3 ROLES (student, teacher, admin) & SECTION
-- ----------------------------------------------------------------------------
ALTER TABLE users
  MODIFY COLUMN role ENUM('student', 'teacher', 'admin') NOT NULL DEFAULT 'student';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS section VARCHAR(20) NULL DEFAULT 'A' AFTER semester,
  ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) NULL AFTER student_id,
  ADD COLUMN IF NOT EXISTS faculty_id INT UNSIGNED NULL AFTER employee_id;

UPDATE users
SET section = 'A'
WHERE role = 'student' AND (section IS NULL OR section = '');

-- Add unique index on employee_id and foreign key to faculty if not present
SET @idx_emp_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'uq_users_employee_id'
);
SET @sql_emp := IF(@idx_emp_exists = 0,
  'ALTER TABLE users ADD UNIQUE KEY uq_users_employee_id (employee_id)',
  'SELECT 1');
PREPARE stmt FROM @sql_emp; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_usr_fac := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'fk_users_faculty_id'
);
SET @sql_fk_uf := IF(@fk_usr_fac = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_faculty_id FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql_fk_uf; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- 2. EXTEND EXISTING CONTENT TABLES FOR RICH EVENTS & DEMO/DRAFT WORKFLOW
-- ----------------------------------------------------------------------------
ALTER TABLE notices
  ADD COLUMN IF NOT EXISTS is_demo TINYINT(1) NOT NULL DEFAULT 0 AFTER status;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS category ENUM(
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
    'general'
  ) NOT NULL DEFAULT 'general' AFTER description,
  ADD COLUMN IF NOT EXISTS target_department VARCHAR(100) NOT NULL DEFAULT 'All' AFTER category,
  ADD COLUMN IF NOT EXISTS semester_eligibility VARCHAR(100) NOT NULL DEFAULT 'All Semesters' AFTER target_department,
  ADD COLUMN IF NOT EXISTS image_url VARCHAR(500) NULL AFTER registration_details,
  ADD COLUMN IF NOT EXISTS registration_link VARCHAR(500) NULL AFTER image_url,
  ADD COLUMN IF NOT EXISTS status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'published' AFTER registration_link,
  ADD COLUMN IF NOT EXISTS is_demo TINYINT(1) NOT NULL DEFAULT 0 AFTER status;

ALTER TABLE timetable
  ADD COLUMN IF NOT EXISTS status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'published' AFTER classroom,
  ADD COLUMN IF NOT EXISTS is_demo TINYINT(1) NOT NULL DEFAULT 0 AFTER status;

ALTER TABLE faculty
  ADD COLUMN IF NOT EXISTS is_demo TINYINT(1) NOT NULL DEFAULT 0 AFTER consultation_hours;

ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS is_demo TINYINT(1) NOT NULL DEFAULT 0 AFTER status;

-- ----------------------------------------------------------------------------
-- 3. DEPARTMENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_departments_code (code),
    UNIQUE KEY uq_departments_name (name),
    INDEX idx_departments_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. SUBJECTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subjects (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,
    department_id INT UNSIGNED NOT NULL,
    department VARCHAR(100) NOT NULL,
    semester TINYINT UNSIGNED NOT NULL,
    credits TINYINT UNSIGNED NOT NULL DEFAULT 3,
    status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'published',
    is_demo TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_subjects_code (code),
    INDEX idx_subjects_dept_sem (department, semester),
    INDEX idx_subjects_department_id (department_id),
    CONSTRAINT chk_subjects_semester CHECK (semester BETWEEN 1 AND 12),
    CONSTRAINT fk_subjects_department
        FOREIGN KEY (department_id) REFERENCES departments(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. TEACHER ASSIGNMENTS TABLE
-- Maps authenticated teacher users to their assigned subjects, departments,
-- semesters, and sections. Enforces strict teacher class-level isolation.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teacher_assignments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT UNSIGNED NOT NULL,
    subject_id INT UNSIGNED NOT NULL,
    department VARCHAR(100) NOT NULL,
    semester TINYINT UNSIGNED NOT NULL,
    section VARCHAR(20) NOT NULL DEFAULT 'A',
    academic_year VARCHAR(20) NOT NULL DEFAULT '2026-27',
    assigned_by INT UNSIGNED NULL,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_teacher_assignment (teacher_id, subject_id, department, semester, section, academic_year),
    INDEX idx_ta_teacher (teacher_id, status),
    INDEX idx_ta_class (department, semester, section),
    INDEX idx_ta_subject (subject_id),
    CONSTRAINT chk_ta_semester CHECK (semester BETWEEN 1 AND 12),
    CONSTRAINT fk_ta_teacher
        FOREIGN KEY (teacher_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_ta_subject
        FOREIGN KEY (subject_id) REFERENCES subjects(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_ta_assigned_by
        FOREIGN KEY (assigned_by) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. EXAMS TABLE
-- Represents an examination cycle/assessment group for a department, semester,
-- and section (Internal 1, Internal 2, Mid-Sem, End-Sem, Practical, Assignment).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exams (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    exam_type ENUM('internal_1', 'internal_2', 'mid_semester', 'end_semester', 'practical', 'assignment') NOT NULL,
    department VARCHAR(100) NOT NULL,
    semester TINYINT UNSIGNED NOT NULL,
    section VARCHAR(20) NOT NULL DEFAULT 'A',
    academic_year VARCHAR(20) NOT NULL DEFAULT '2026-27',
    instructions TEXT NULL,
    status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
    is_demo TINYINT(1) NOT NULL DEFAULT 0,
    created_by INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_exams_scope (department, semester, section, status),
    INDEX idx_exams_type (exam_type),
    CONSTRAINT chk_exams_semester CHECK (semester BETWEEN 1 AND 12),
    CONSTRAINT fk_exams_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. EXAM SUBJECTS TABLE
-- Individual scheduled subject papers inside an exam with date, time, max marks.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exam_subjects (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    exam_id INT UNSIGNED NOT NULL,
    subject_id INT UNSIGNED NOT NULL,
    exam_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_marks DECIMAL(6,2) NOT NULL,
    passing_marks DECIMAL(6,2) NOT NULL,
    room VARCHAR(80) NULL,
    instructions TEXT NULL,
    status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_exam_subject (exam_id, subject_id),
    INDEX idx_es_date (exam_date),
    INDEX idx_es_subject (subject_id),
    CONSTRAINT chk_es_time_range CHECK (end_time > start_time),
    CONSTRAINT chk_es_marks_range CHECK (max_marks > 0 AND passing_marks >= 0 AND passing_marks <= max_marks),
    CONSTRAINT fk_es_exam
        FOREIGN KEY (exam_id) REFERENCES exams(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_es_subject
        FOREIGN KEY (subject_id) REFERENCES subjects(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. MARKS TABLE
-- Stores student subject marks entered by assigned teachers.
-- Workflow: draft -> submitted (by Teacher) -> approved / rejected (by Admin).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marks (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    exam_subject_id INT UNSIGNED NOT NULL,
    student_id INT UNSIGNED NOT NULL,
    subject_id INT UNSIGNED NOT NULL,
    entered_by INT UNSIGNED NULL,
    obtained_marks DECIMAL(6,2) NOT NULL,
    max_marks DECIMAL(6,2) NOT NULL,
    remarks VARCHAR(255) NULL,
    submission_status ENUM('draft', 'submitted', 'approved', 'rejected') NOT NULL DEFAULT 'draft',
    submitted_at DATETIME NULL,
    reviewed_by INT UNSIGNED NULL,
    reviewed_at DATETIME NULL,
    review_notes VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_marks_student_exam_subject (student_id, exam_subject_id),
    INDEX idx_marks_status (submission_status),
    INDEX idx_marks_student (student_id),
    INDEX idx_marks_entered_by (entered_by),
    CONSTRAINT chk_marks_valid_range CHECK (obtained_marks >= 0 AND max_marks > 0 AND obtained_marks <= max_marks),
    CONSTRAINT fk_marks_exam_subject
        FOREIGN KEY (exam_subject_id) REFERENCES exam_subjects(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_marks_student
        FOREIGN KEY (student_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_marks_subject
        FOREIGN KEY (subject_id) REFERENCES subjects(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_marks_entered_by
        FOREIGN KEY (entered_by) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_marks_reviewed_by
        FOREIGN KEY (reviewed_by) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 9. RESULTS TABLE
-- Stores aggregated exam results per student. Published ONLY by Admin after
-- marks approval. Students can only see their own published results.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS results (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    exam_id INT UNSIGNED NOT NULL,
    student_id INT UNSIGNED NOT NULL,
    total_obtained DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    total_max DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    grade VARCHAR(10) NOT NULL,
    pass_status ENUM('pass', 'fail') NOT NULL,
    publish_status ENUM('unpublished', 'published') NOT NULL DEFAULT 'unpublished',
    published_by INT UNSIGNED NULL,
    published_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_results_exam_student (exam_id, student_id),
    INDEX idx_results_student_pub (student_id, publish_status),
    CONSTRAINT fk_results_exam
        FOREIGN KEY (exam_id) REFERENCES exams(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_results_student
        FOREIGN KEY (student_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_results_published_by
        FOREIGN KEY (published_by) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
