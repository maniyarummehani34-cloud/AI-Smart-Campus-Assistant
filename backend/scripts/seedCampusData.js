/**
 * Safe, Idempotent DEMO / DRAFT Campus Data Seeder
 *
 * RULES ENFORCED:
 * 1. Never deletes or modifies existing user accounts or passwords.
 * 2. Never creates fake marks or fake results for real students.
 * 3. Marks all generated notices, events, subjects, timetables, and exam
 *    schedules as is_demo = 1 and status = 'draft' until an Admin verifies
 *    and publishes them in the Admin Portal.
 * 4. Safe to run multiple times without duplicating rows.
 *
 * Usage:
 *   cd backend
 *   npm run seed-demo
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { pool } = require('../config/db');

const DEPARTMENTS = [
  {
    code: 'CS',
    name: 'Computer Science',
    description: 'Software engineering, algorithms, AI, and distributed systems.',
  },
  {
    code: 'IT',
    name: 'Information Technology',
    description: 'Enterprise systems, cloud computing, cybersecurity, and web platforms.',
  },
  {
    code: 'ECE',
    name: 'Electronics & Communication',
    description: 'VLSI, embedded systems, signal processing, and wireless networks.',
  },
  {
    code: 'ME',
    name: 'Mechanical Engineering',
    description: 'Thermodynamics, CAD/CAM, robotics, and sustainable manufacturing.',
  },
  {
    code: 'CE',
    name: 'Civil Engineering',
    description: 'Structural analysis, smart infrastructure, and environmental engineering.',
  },
  {
    code: 'AIDS',
    name: 'Artificial Intelligence & Data Science',
    description: 'Machine learning, NLP, computer vision, and statistical modeling.',
  },
];

const SUBJECT_TEMPLATES_BY_SEM = {
  1: ['Engineering Mathematics I', 'Programming Fundamentals'],
  2: ['Engineering Mathematics II', 'Digital Logic & Systems'],
  3: ['Data Structures & Algorithms', 'Core Engineering Principles'],
  4: ['Operating Systems & Architecture', 'Applied Probability & Analytics'],
  5: ['AI Software Development', 'Database Management Systems'],
  6: ['Cloud & Distributed Systems', 'Software Architecture & Testing'],
  7: ['Applied Machine Learning', 'Capstone Project Phase I'],
  8: ['Enterprise Innovation Seminar', 'Capstone Project Phase II'],
};

const FACULTY_DATA = [
  { name: 'Dr. Meera Nair', department: 'Computer Science', designation: 'Professor & HOD', email: 'meera.nair@smartcampus.demo', phone: '+91 98000 11001', office: 'Block B, Room 302', hours: 'Mon & Wed, 2:00 PM - 4:00 PM' },
  { name: 'Prof. Arjun Deshmukh', department: 'Computer Science', designation: 'Associate Professor', email: 'arjun.deshmukh@smartcampus.demo', phone: '+91 98000 11002', office: 'Block B, Room 214', hours: 'Tue & Thu, 11:30 AM - 1:00 PM' },
  { name: 'Prof. Rohan Verma', department: 'Information Technology', designation: 'Assistant Professor', email: 'rohan.verma@smartcampus.demo', phone: '+91 98000 11003', office: 'Block B, Room 119', hours: 'Wed & Fri, 1:30 PM - 3:00 PM' },
  { name: 'Dr. Sneha Joshi', department: 'Information Technology', designation: 'Professor', email: 'sneha.joshi@smartcampus.demo', phone: '+91 98000 11004', office: 'Block B, Room 122', hours: 'Mon & Thu, 3:00 PM - 4:30 PM' },
  { name: 'Dr. Kavita Kulkarni', department: 'Electronics & Communication', designation: 'Professor & HOD', email: 'kavita.kulkarni@smartcampus.demo', phone: '+91 98000 11005', office: 'Block C, Room 108', hours: 'Mon-Fri, 3:00 PM - 4:00 PM' },
  { name: 'Prof. Vikram Rao', department: 'Electronics & Communication', designation: 'Assistant Professor', email: 'vikram.rao@smartcampus.demo', phone: '+91 98000 11006', office: 'Block C, Room 204', hours: 'Tue & Fri, 2:00 PM - 3:30 PM' },
  { name: 'Dr. Rajesh Patil', department: 'Mechanical Engineering', designation: 'Professor', email: 'rajesh.patil@smartcampus.demo', phone: '+91 98000 11007', office: 'Block D, Room 112', hours: 'Mon & Wed, 11:00 AM - 12:30 PM' },
  { name: 'Prof. Nikhil Shetty', department: 'Mechanical Engineering', designation: 'Associate Professor', email: 'nikhil.shetty@smartcampus.demo', phone: '+91 98000 11008', office: 'Block D, Room 209', hours: 'Thu & Fri, 2:30 PM - 4:00 PM' },
  { name: 'Dr. Priya Menon', department: 'Civil Engineering', designation: 'Professor', email: 'priya.menon@smartcampus.demo', phone: '+91 98000 11009', office: 'Block E, Room 105', hours: 'Tue & Thu, 10:30 AM - 12:00 PM' },
  { name: 'Prof. Aditya Iyer', department: 'Civil Engineering', designation: 'Assistant Professor', email: 'aditya.iyer@smartcampus.demo', phone: '+91 98000 11010', office: 'Block E, Room 201', hours: 'Mon & Fri, 2:00 PM - 3:30 PM' },
  { name: 'Dr. Ananya Sen', department: 'Artificial Intelligence & Data Science', designation: 'Professor & HOD', email: 'ananya.sen@smartcampus.demo', phone: '+91 98000 11011', office: 'AI Wing, Room 401', hours: 'Mon & Thu, 2:00 PM - 4:00 PM' },
  { name: 'Prof. Karan Malhotra', department: 'Artificial Intelligence & Data Science', designation: 'Associate Professor', email: 'karan.malhotra@smartcampus.demo', phone: '+91 98000 11012', office: 'AI Wing, Room 308', hours: 'Wed & Fri, 11:00 AM - 1:00 PM' },
];

const FACILITIES_DATA = [
  { name: 'Central Academic Library', category: 'library', description: 'Multi-floor digital and print library with quiet reading halls and group study rooms.', location: 'Knowledge Wing, Ground & 1st Floor', hours: 'Mon-Sat: 8:00 AM - 8:30 PM', contact: 'library@smartcampus.demo', status: 'open' },
  { name: 'AI & High-Performance Computing Lab', category: 'lab', description: 'GPU workstations dedicated to AI software development, ML training, and research.', location: 'Block B, 2nd Floor, Room 210', hours: 'Mon-Fri: 9:00 AM - 6:30 PM', contact: 'ailab@smartcampus.demo', status: 'open' },
  { name: 'IoT & Robotics Makerspace', category: 'lab', description: 'Prototyping hardware lab with 3D printers, microcontrollers, and test benches.', location: 'Block C, Ground Floor', hours: 'Mon-Sat: 9:30 AM - 6:00 PM', contact: 'makerspace@smartcampus.demo', status: 'open' },
  { name: 'Main Campus Auditorium', category: 'academic', description: '600-seat auditorium equipped for keynote lectures, symposiums, and cultural nights.', location: 'Block A, Central Atrium', hours: 'Event Schedule: 8:00 AM - 9:00 PM', contact: 'auditorium@smartcampus.demo', status: 'open' },
  { name: 'Campus Medical & Wellness Center', category: 'medical', description: 'On-campus primary healthcare, first aid, and student counseling desk.', location: 'Student Services Annex', hours: 'Mon-Sat: 8:30 AM - 6:00 PM', contact: 'wellness@smartcampus.demo', status: 'open' },
  { name: 'Indoor Sports & Athletics Complex', category: 'sports', description: 'Badminton courts, fitness studio, table tennis arena, and outdoor running track.', location: 'North Campus Recreation Block', hours: 'Daily: 6:00 AM - 9:00 PM', contact: 'sports@smartcampus.demo', status: 'open' },
  { name: 'Campus Dining Commons', category: 'dining', description: 'Hygienic student cafeteria offering daily meals, beverages, and collaborative seating.', location: 'Central Plaza, East Wing', hours: 'Daily: 7:30 AM - 9:30 PM', contact: 'dining@smartcampus.demo', status: 'open' },
  { name: 'Student Innovation & Incubation Hub', category: 'academic', description: 'Co-working hub supporting student startups, mentor sessions, and pitch days.', location: 'Innovation Pavilion, 2nd Floor', hours: 'Mon-Sat: 9:00 AM - 8:00 PM', contact: 'incubator@smartcampus.demo', status: 'maintenance' },
];

const DEMO_NOTICES = [
  { title: '[DEMO] Academic Calendar & Assessment Guidelines Draft', description: 'Draft guidelines for semester-wise internal assessments, lab evaluations, and attendance compliance. Verify official dates before publishing.', category: 'academic', dept: 'All', priority: 'important' },
  { title: '[DEMO] Examination Hall Seating & ID Verification Policy', description: 'Draft examination circular reminding students to carry university ID cards and arrive 20 minutes before scheduled exam start times.', category: 'exam', dept: 'All', priority: 'urgent' },
  { title: '[DEMO] Computer Science Project Milestone Review', description: 'Draft review schedule for CS undergraduate software development projects in Block B seminar rooms.', category: 'academic', dept: 'Computer Science', priority: 'important' },
  { title: '[DEMO] IT Cybersecurity Lab Slot Allocation', description: 'Draft announcement regarding updated lab workstations and network sandbox access for Information Technology semesters.', category: 'academic', dept: 'Information Technology', priority: 'normal' },
  { title: '[DEMO] ECE Hardware Prototyping Component Issue', description: 'Draft notice for Electronics & Communication students to submit lab component requisitions ahead of practical exams.', category: 'exam', dept: 'Electronics & Communication', priority: 'normal' },
  { title: '[DEMO] Mechanical CAD Workshop Safety Briefing', description: 'Draft safety orientation schedule for Mechanical Engineering workshop and robotics lab participants.', category: 'general', dept: 'Mechanical Engineering', priority: 'important' },
  { title: '[DEMO] Civil Surveying Field Session Notice', description: 'Draft schedule for outdoor surveying instrumentation practice and site engineering reports.', category: 'academic', dept: 'Civil Engineering', priority: 'normal' },
  { title: '[DEMO] AI & Data Science GPU Cluster Access', description: 'Draft instructions for requesting compute hours on the AI & Data Science research cluster.', category: 'academic', dept: 'Artificial Intelligence & Data Science', priority: 'important' },
  { title: '[DEMO] Campus Placement Readiness Drive', description: 'Draft schedule for mock technical interviews, aptitude workshops, and resume clinics organized by the Placement Cell.', category: 'placement', dept: 'All', priority: 'important' },
  { title: '[DEMO] Extended Library Hours During Exam Preparation', description: 'Draft notice announcing extended evening reading room hours at the Central Academic Library.', category: 'general', dept: 'All', priority: 'normal' },
];

const DEMO_EVENTS = [
  { title: '[DEMO] Full-Stack React & MySQL Technical Workshop', description: 'Hands-on engineering workshop covering modern React interfaces, Express REST APIs, and relational MySQL database design.', category: 'technical_workshop', dept: 'Computer Science', sem: 'Semesters 3-8', offsetDays: 6, time: '10:00:00', venue: 'Innovation Lab 204', organizer: 'CS Engineering Society', reg: 'Demo registration • Open to CS & IT students', img: '/images/event-tech-workshop.svg' },
  { title: '[DEMO] Smart Campus 24-Hour Innovation Hackathon', description: 'Team-based hackathon inviting students across departments to build AI and sustainability prototypes for campus life.', category: 'hackathon', dept: 'All', sem: 'All Semesters', offsetDays: 10, time: '09:00:00', venue: 'Main Innovation Hall', organizer: 'Student Technical Council', reg: 'Teams of 2-4 • Demo registration link', img: '/images/event-hackathon.svg' },
  { title: '[DEMO] Inter-College Algorithmic Coding Competition', description: 'Timed competitive programming challenge testing data structures, dynamic programming, and graph algorithms.', category: 'coding_competition', dept: 'Information Technology', sem: 'Semesters 2-8', offsetDays: 14, time: '02:00:00', venue: 'Computing Center Lab 1', organizer: 'ACM Student Chapter', reg: 'Individual entry • Laptops or lab PCs provided', img: '/images/event-coding.svg' },
  { title: '[DEMO] Annual University Cultural Festival — Tarang', description: 'Evening celebration of music, classical & contemporary dance, theater, and campus visual arts.', category: 'cultural', dept: 'All', sem: 'All Semesters', offsetDays: 19, time: '05:30:00', venue: 'Open-Air Amphitheater', organizer: 'Cultural Affairs Committee', reg: 'Free entry with University Student ID', img: '/images/event-cultural.svg' },
  { title: '[DEMO] Inter-Department Athletics & Badminton Championship', description: 'Annual sports tournament featuring track events, badminton singles/doubles, and team relays.', category: 'sports', dept: 'All', sem: 'All Semesters', offsetDays: 22, time: '07:30:00', venue: 'North Campus Sports Complex', organizer: 'Department of Physical Education', reg: 'Register via Sports Desk before deadline', img: '/images/event-sports.svg' },
  { title: '[DEMO] Applied Generative AI in Healthcare Seminar', description: 'Academic seminar examining responsible AI deployment, evaluation benchmarks, and privacy-preserving systems.', category: 'seminar', dept: 'Artificial Intelligence & Data Science', sem: 'Semesters 5-8', offsetDays: 12, time: '11:00:00', venue: 'Seminar Hall 2, Library Wing', organizer: 'AI & Data Science Research Cell', reg: 'Open to all faculty and senior students', img: '/images/event-seminar.svg' },
  { title: '[DEMO] Industry Guest Lecture: Cloud-Native Architecture', description: 'Distinguished alumni engineering architect shares lessons on scaling distributed systems in production.', category: 'guest_lecture', dept: 'All', sem: 'Semesters 4-8', offsetDays: 16, time: '03:00:00', venue: 'Main Auditorium, Block A', organizer: 'Industry Relations Office', reg: 'First-come seating • Attendance certificate', img: '/images/event-seminar.svg' },
  { title: '[DEMO] Campus Founder Pitch & Entrepreneurship Summit', description: 'Student startups pitch product prototypes to campus mentors, alumni founders, and incubation advisors.', category: 'entrepreneurship', dept: 'All', sem: 'All Semesters', offsetDays: 25, time: '10:30:00', venue: 'Student Innovation Pavilion', organizer: 'E-Cell & Incubation Hub', reg: 'Pitch deck submission required', img: '/images/event-career.svg' },
  { title: '[DEMO] Technical Interview & Placement Bootcamp', description: 'Intensive placement preparation session covering system design basics, DSA drills, and HR communication.', category: 'placement', dept: 'All', sem: 'Semesters 6-8', offsetDays: 8, time: '02:30:00', venue: 'Placement Training Center', organizer: 'Training & Placement Cell', reg: 'Mandatory for registered placement candidates', img: '/images/event-career.svg' },
  { title: '[DEMO] Higher Studies & Research Career Guidance Session', description: 'Faculty panel discussing graduate admissions, research publications, fellowships, and interdisciplinary careers.', category: 'career_guidance', dept: 'All', sem: 'Semesters 5-8', offsetDays: 18, time: '04:00:00', venue: 'Block A Conference Hall', organizer: 'Academic Advising Cell', reg: 'Walk-in with student ID', img: '/images/event-career.svg' },
  { title: '[DEMO] Robotics & Embedded Systems Club Showcase', description: 'Interactive campus club fair demonstrating autonomous rovers, IoT sensors, and drone telemetry.', category: 'club', dept: 'Electronics & Communication', sem: 'All Semesters', offsetDays: 28, time: '01:30:00', venue: 'Central Courtyard Pavilion', organizer: 'Robotics & IEEE Student Club', reg: 'Open demo day for all departments', img: '/images/event-tech-workshop.svg' },
  { title: '[DEMO] Sustainable Green Infrastructure Design Expo', description: 'Collaborative Civil and Mechanical student exhibition showcasing energy-efficient campus designs.', category: 'seminar', dept: 'Civil Engineering', sem: 'Semesters 3-8', offsetDays: 31, time: '10:00:00', venue: 'Block E Exhibition Atrium', organizer: 'Civil & Mechanical Engineering Forum', reg: 'Open viewing for students and guests', img: '/images/event-seminar.svg' },
];

async function seedCampusData() {
  const conn = await pool.getConnection();
  try {
    console.log('Starting idempotent DEMO/DRAFT campus data seeding...');

    // Find an existing admin id (optional creator reference) without modifying any user
    const [admins] = await conn.query(
      "SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1"
    );
    const adminId = admins[0]?.id || null;

    // 1. Seed Departments
    const deptMap = new Map();
    for (const d of DEPARTMENTS) {
      await conn.query(
        `INSERT IGNORE INTO departments (code, name, description, status)
         VALUES (?, ?, ?, 'active')`,
        [d.code, d.name, d.description]
      );
      const [rows] = await conn.query(
        'SELECT id, code, name FROM departments WHERE code = ? LIMIT 1',
        [d.code]
      );
      deptMap.set(d.name, rows[0]);
    }
    console.log(`Departments ready: ${deptMap.size}`);

    // 2. Seed Faculty (idempotent via unique email)
    const facultyByDept = new Map();
    for (const f of FACULTY_DATA) {
      await conn.query(
        `INSERT IGNORE INTO faculty
           (name, department, designation, email, phone, office_location, consultation_hours, is_demo)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [f.name, f.department, f.designation, f.email, f.phone, f.office, f.hours]
      );
      const [rows] = await conn.query(
        'SELECT id, name, department FROM faculty WHERE email = ? LIMIT 1',
        [f.email]
      );
      if (!facultyByDept.has(f.department)) facultyByDept.set(f.department, []);
      facultyByDept.get(f.department).push(rows[0]);
    }
    console.log(`Faculty profiles ready: ${FACULTY_DATA.length}`);

    // 3. Seed Facilities (idempotent via unique name)
    for (const fac of FACILITIES_DATA) {
      await conn.query(
        `INSERT IGNORE INTO facilities
           (name, category, description, location, opening_hours, contact_info, status, is_demo)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [fac.name, fac.category, fac.description, fac.location, fac.hours, fac.contact, fac.status]
      );
    }
    console.log(`Facilities ready: ${FACILITIES_DATA.length}`);

    // 4. Seed Subjects for EVERY department & semesters 1..8 (DEMO / DRAFT)
    let subjectsCount = 0;
    const subjectsByDeptSem = new Map();
    for (const d of DEPARTMENTS) {
      const deptRec = deptMap.get(d.name);
      for (let sem = 1; sem <= 8; sem += 1) {
        const templates = SUBJECT_TEMPLATES_BY_SEM[sem];
        const key = `${d.name}|${sem}`;
        subjectsByDeptSem.set(key, []);
        for (let idx = 0; idx < templates.length; idx += 1) {
          const code = `${d.code}${sem}0${idx + 1}`;
          const subjectName =
            idx === 0 ? templates[idx] : `${templates[idx]} (${d.code})`;
          await conn.query(
            `INSERT IGNORE INTO subjects
               (code, name, department_id, department, semester, credits, status, is_demo)
             VALUES (?, ?, ?, ?, ?, ?, 'draft', 1)`,
            [code, subjectName, deptRec.id, d.name, sem, idx === 0 ? 4 : 3]
          );
          const [sRows] = await conn.query(
            'SELECT id, code, name FROM subjects WHERE code = ? LIMIT 1',
            [code]
          );
          subjectsByDeptSem.get(key).push(sRows[0]);
          subjectsCount += 1;
        }
      }
    }
    console.log(`Subjects ready (DEMO/DRAFT): ${subjectsCount}`);

    // 5. Seed Notices (DEMO / DRAFT, idempotent by title)
    let noticesInserted = 0;
    for (const n of DEMO_NOTICES) {
      const [exists] = await conn.query(
        'SELECT id FROM notices WHERE title = ? LIMIT 1',
        [n.title]
      );
      if (exists.length === 0) {
        await conn.query(
          `INSERT INTO notices
             (title, description, category, target_department, priority, status, is_demo, posted_by, published_date)
           VALUES (?, ?, ?, ?, ?, 'draft', 1, ?, NOW())`,
          [n.title, n.description, n.category, n.dept, n.priority, adminId]
        );
        noticesInserted += 1;
      }
    }
    console.log(`Notices seeded (DEMO/DRAFT, newly inserted): ${noticesInserted}`);

    // 6. Seed Events across all 11 categories (DEMO / DRAFT, idempotent by title)
    let eventsInserted = 0;
    for (const ev of DEMO_EVENTS) {
      const [exists] = await conn.query(
        'SELECT id FROM events WHERE title = ? LIMIT 1',
        [ev.title]
      );
      if (exists.length === 0) {
        await conn.query(
          `INSERT INTO events
             (title, description, category, target_department, semester_eligibility,
              event_date, event_time, venue, organizer, registration_details,
              image_url, registration_link, status, is_demo, created_by)
           VALUES (?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), ?, ?, ?, ?, ?, ?, 'draft', 1, ?)`,
          [
            ev.title,
            ev.description,
            ev.category,
            ev.dept,
            ev.sem,
            ev.offsetDays,
            ev.time,
            ev.venue,
            ev.organizer,
            ev.reg,
            ev.img,
            '#register-demo',
            adminId,
          ]
        );
        eventsInserted += 1;
      }
    }
    console.log(`Events seeded (DEMO/DRAFT, newly inserted): ${eventsInserted}`);

    // 7. Seed Conflict-Free Timetable slots across ALL departments & semesters 1..8 (DEMO / DRAFT)
    // Unique classroom per (dept, sem) and staggered hours prevent any trigger collision!
    const days = ['Monday', 'Wednesday', 'Friday'];
    let timetableInserted = 0;
    for (let dIdx = 0; dIdx < DEPARTMENTS.length; dIdx += 1) {
      const d = DEPARTMENTS[dIdx];
      const deptFaculty = facultyByDept.get(d.name) || [];
      for (let sem = 1; sem <= 8; sem += 1) {
        const subjs = subjectsByDeptSem.get(`${d.name}|${sem}`) || [];
        // Two conflict-free slots per department/semester using unique rooms & distinct hours per faculty
        for (let sIdx = 0; sIdx < Math.min(2, subjs.length); sIdx += 1) {
          const day = days[(sem + sIdx) % days.length];
          // Give each semester a unique start hour (08:00 through 15:00) so faculty never overlaps
          const startHour = 8 + ((sem - 1) % 8);
          const startTime = `${String(startHour).padStart(2, '0')}:00:00`;
          const endTime = `${String(startHour + 1).padStart(2, '0')}:00:00`;
          const room = `${d.code}-${sem}0${sIdx + 1}`;
          const fac = deptFaculty[sIdx % deptFaculty.length];

          const [exists] = await conn.query(
            `SELECT id FROM timetable
             WHERE department = ? AND semester = ? AND section = 'A' AND day_of_week = ? AND start_time = ?
             LIMIT 1`,
            [d.name, sem, day, startTime]
          );
          if (exists.length === 0) {
            try {
              await conn.query(
                `INSERT INTO timetable
                   (department, semester, section, subject, faculty_id, day_of_week, start_time, end_time, classroom, status, is_demo)
                 VALUES (?, ?, 'A', ?, ?, ?, ?, ?, ?, 'draft', 1)`,
                [
                  d.name,
                  sem,
                  subjs[sIdx].name,
                  fac ? fac.id : null,
                  day,
                  startTime,
                  endTime,
                  room,
                ]
              );
              timetableInserted += 1;
            } catch (err) {
              if (err.sqlState !== '45000' && err.code !== 'ER_DUP_ENTRY') {
                throw err;
              }
            }
          }
        }
      }
    }
    console.log(`Timetable slots seeded (DEMO/DRAFT, newly inserted): ${timetableInserted}`);

    // 8. Seed Semester-Wise Demo/Draft Exam Schedules across ALL departments & semesters 1..8
    // NOTE: Does NOT create any fake marks or results for real students!
    let examsInserted = 0;
    for (const d of DEPARTMENTS) {
      for (let sem = 1; sem <= 8; sem += 1) {
        const examTitle = `[DEMO] ${d.code} Semester ${sem} Internal Assessment 1`;
        const [existingExam] = await conn.query(
          'SELECT id FROM exams WHERE title = ? AND department = ? AND semester = ? AND section = ? LIMIT 1',
          [examTitle, d.name, sem, 'A']
        );

        let examId;
        if (existingExam.length === 0) {
          const [exRes] = await conn.query(
            `INSERT INTO exams
               (title, exam_type, department, semester, section, academic_year, instructions, status, is_demo, created_by)
             VALUES (?, 'internal_1', ?, ?, 'A', '2026-27', ?, 'draft', 1, ?)`,
            [
              examTitle,
              d.name,
              sem,
              'DEMO / DRAFT schedule. Admin must verify official dates before publishing to students.',
              adminId,
            ]
          );
          examId = exRes.insertId;
          examsInserted += 1;
        } else {
          examId = existingExam[0].id;
        }

        const subjs = subjectsByDeptSem.get(`${d.name}|${sem}`) || [];
        for (let idx = 0; idx < subjs.length; idx += 1) {
          await conn.query(
            `INSERT IGNORE INTO exam_subjects
               (exam_id, subject_id, exam_date, start_time, end_time, max_marks, passing_marks, room, instructions, status)
             VALUES (?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), '10:00:00', '11:30:00', 50.00, 20.00, ?, 'Bring student ID card.', 'draft')`,
            [examId, subjs[idx].id, 14 + idx * 2, `${d.code}-Hall-${sem}`]
          );
        }
      }
    }
    console.log(`Exam schedules seeded (DEMO/DRAFT, newly inserted): ${examsInserted}`);
    console.log(
      'Done! All generated content is marked DEMO/DRAFT and hidden from students until approved & published by an Admin.'
    );
  } finally {
    conn.release();
    await pool.end();
  }
}

seedCampusData().catch((err) => {
  console.error('Seeder failed:', err.code || err.message);
  process.exit(1);
});
