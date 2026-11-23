-- ============================================================================
-- AI-Powered Smart Campus Assistant
-- Phase 2: Relational Database Schema (MySQL / XAMPP MariaDB Compatible)
-- Database: campus_assistant_db
-- ============================================================================
-- Security & Application Rules (to be enforced by the Express backend):
--   1. Passwords must always be hashed with bcrypt and stored in password_hash.
--   2. Public registration must always assign role = 'student' (never 'admin').
--   3. Only authenticated users with role = 'admin' may create, update, or
--      delete notices, events, faculty, timetables, and facilities.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS campus_assistant_db_v2
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE campus_assistant_db_v2;

-- ============================================================================
-- 1. USERS TABLE
-- Stores both Student and Admin accounts with role-based access control.
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('student', 'admin') NOT NULL DEFAULT 'student',
    student_id VARCHAR(50) NULL,
    department VARCHAR(100) NULL,
    semester TINYINT UNSIGNED NULL,
    status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_student_id (student_id),
    INDEX idx_users_role (role),
    INDEX idx_users_dept_sem (department, semester),
    INDEX idx_users_status (status),

    CONSTRAINT chk_users_semester
        CHECK (semester IS NULL OR (semester BETWEEN 1 AND 12))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. FACULTY TABLE
-- Stores verified college faculty directory details and consultation hours.
-- Created before timetable because timetable references faculty(id).
-- ============================================================================
CREATE TABLE IF NOT EXISTS faculty (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NULL,
    office_location VARCHAR(150) NOT NULL,
    consultation_hours VARCHAR(150) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_faculty_email (email),
    INDEX idx_faculty_department (department),
    INDEX idx_faculty_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. NOTICES TABLE
-- Stores official college notices, academic updates, priorities, and lifecycle
-- status (draft, published, archived). Only Admins manage notices via backend.
-- ============================================================================
CREATE TABLE IF NOT EXISTS notices (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category ENUM('academic', 'exam', 'event', 'placement', 'holiday', 'general') NOT NULL DEFAULT 'general',
    target_department VARCHAR(100) NOT NULL DEFAULT 'All',
    priority ENUM('normal', 'important', 'urgent') NOT NULL DEFAULT 'normal',
    status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'published',
    posted_by INT UNSIGNED NULL,
    published_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_notices_category (category),
    INDEX idx_notices_target_dept (target_department),
    INDEX idx_notices_priority (priority),
    INDEX idx_notices_status_date (status, published_date),
    INDEX idx_notices_posted_by (posted_by),

    CONSTRAINT fk_notices_posted_by
        FOREIGN KEY (posted_by) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. EVENTS TABLE
-- Stores campus workshops, seminars, fests, and registration details.
-- Only Admins create or modify events via backend.
-- ============================================================================
CREATE TABLE IF NOT EXISTS events (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    event_date DATE NOT NULL,
    event_time TIME NOT NULL,
    venue VARCHAR(150) NOT NULL,
    organizer VARCHAR(150) NOT NULL,
    registration_details TEXT NULL,
    created_by INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_events_date (event_date),
    INDEX idx_events_created_by (created_by),

    CONSTRAINT fk_events_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. TIMETABLE TABLE
-- Stores weekly class schedules by department, semester, and section.
-- Enforces end_time > start_time and prevents room/faculty/section conflicts.
-- ============================================================================
CREATE TABLE IF NOT EXISTS timetable (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    department VARCHAR(100) NOT NULL,
    semester TINYINT UNSIGNED NOT NULL,
    section VARCHAR(20) NOT NULL DEFAULT 'A',
    subject VARCHAR(150) NOT NULL,
    faculty_id INT UNSIGNED NULL,
    day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday') NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    classroom VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_timetable_room_slot (classroom, day_of_week, start_time),
    UNIQUE KEY uq_timetable_faculty_slot (faculty_id, day_of_week, start_time),
    UNIQUE KEY uq_timetable_section_slot (department, semester, section, day_of_week, start_time),
    INDEX idx_timetable_dept_sem_sec_day (department, semester, section, day_of_week),
    INDEX idx_timetable_faculty_id (faculty_id),

    CONSTRAINT chk_timetable_semester
        CHECK (semester BETWEEN 1 AND 12),
    CONSTRAINT chk_timetable_time_range
        CHECK (end_time > start_time),
    CONSTRAINT fk_timetable_faculty
        FOREIGN KEY (faculty_id) REFERENCES faculty(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. FACILITIES TABLE
-- Stores campus facilities, categories, operating hours, and availability.
-- ============================================================================
CREATE TABLE IF NOT EXISTS facilities (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category ENUM('academic', 'library', 'lab', 'sports', 'hostel', 'dining', 'medical', 'other') NOT NULL DEFAULT 'other',
    description TEXT NOT NULL,
    location VARCHAR(150) NOT NULL,
    opening_hours VARCHAR(150) NOT NULL,
    contact_info VARCHAR(150) NULL,
    status ENUM('open', 'closed', 'maintenance') NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_facilities_name (name),
    INDEX idx_facilities_category (category),
    INDEX idx_facilities_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. CHATBOT LOGS TABLE
-- Stores AI Campus Assistant Q&A conversation history linked to each user.
-- ============================================================================
CREATE TABLE IF NOT EXISTS chatbot_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    user_question TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_chatbot_user_time (user_id, created_at),

    CONSTRAINT fk_chatbot_logs_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TIMETABLE OVERLAP VALIDATION TRIGGERS
-- Prevents partial time-range overlaps (e.g., 09:00-10:00 vs 09:30-10:30)
-- for classrooms, faculty members, and class sections on the same day.
-- ============================================================================
DELIMITER $$

DROP TRIGGER IF EXISTS trg_timetable_no_overlap_insert$$
CREATE TRIGGER trg_timetable_no_overlap_insert
BEFORE INSERT ON timetable
FOR EACH ROW
BEGIN
    IF NEW.end_time <= NEW.start_time THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Timetable error: end_time must be later than start_time.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM timetable
        WHERE day_of_week = NEW.day_of_week
          AND classroom = NEW.classroom
          AND NEW.start_time < end_time
          AND NEW.end_time > start_time
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Timetable conflict: classroom is already booked during this time slot.';
    END IF;

    IF NEW.faculty_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM timetable
        WHERE day_of_week = NEW.day_of_week
          AND faculty_id = NEW.faculty_id
          AND NEW.start_time < end_time
          AND NEW.end_time > start_time
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Timetable conflict: faculty member is already scheduled during this time slot.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM timetable
        WHERE day_of_week = NEW.day_of_week
          AND department = NEW.department
          AND semester = NEW.semester
          AND section = NEW.section
          AND NEW.start_time < end_time
          AND NEW.end_time > start_time
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Timetable conflict: this department/semester/section already has a class during this time slot.';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_timetable_no_overlap_update$$
CREATE TRIGGER trg_timetable_no_overlap_update
BEFORE UPDATE ON timetable
FOR EACH ROW
BEGIN
    IF NEW.end_time <= NEW.start_time THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Timetable error: end_time must be later than start_time.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM timetable
        WHERE id <> NEW.id
          AND day_of_week = NEW.day_of_week
          AND classroom = NEW.classroom
          AND NEW.start_time < end_time
          AND NEW.end_time > start_time
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Timetable conflict: classroom is already booked during this time slot.';
    END IF;

    IF NEW.faculty_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM timetable
        WHERE id <> NEW.id
          AND day_of_week = NEW.day_of_week
          AND faculty_id = NEW.faculty_id
          AND NEW.start_time < end_time
          AND NEW.end_time > start_time
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Timetable conflict: faculty member is already scheduled during this time slot.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM timetable
        WHERE id <> NEW.id
          AND day_of_week = NEW.day_of_week
          AND department = NEW.department
          AND semester = NEW.semester
          AND section = NEW.section
          AND NEW.start_time < end_time
          AND NEW.end_time > start_time
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Timetable conflict: this department/semester/section already has a class during this time slot.';
    END IF;
END$$

DELIMITER ;
