/**
 * AI-Powered Smart Campus Assistant — Large Synthetic DEMO Data Generator
 *
 * SAFETY GUARANTEES:
 * 1. Never drops or alters any tables, never touches other databases.
 * 2. Never modifies or deletes existing real Admin, Teacher, or Student accounts.
 * 3. Never generates fake marks or results for real student accounts.
 * 4. Strictly idempotent: safe to run multiple times without creating duplicates.
 * 5. Uses parameterized SQL and transactions in foreign-key-safe order.
 * 6. Saves local demo credentials report outside frontend/public in docs/demo-local/
 *    (which is listed in .gitignore and never exposed via API).
 *
 * Usage:
 *   cd backend
 *   npm run seed-large
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { pool } = require('../config/db');
const { calculateExamResult } = require('../config/gradingRules');

const BCRYPT_ROUNDS = 12;
const TEACHERS_PER_DEPT = 10;
const STUDENTS_PER_CLASS = 20;
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Rohan', 'Karthik', 'Nikhil', 'Pranav', 'Siddharth', 'Dev', 'Kabir', 'Manav', 'Varun', 'Harsh',
  'Ananya', 'Diya', 'Isha', 'Kavya', 'Meera', 'Neha', 'Pooja', 'Priya', 'Riya', 'Saanvi',
  'Shreya', 'Sneha', 'Tanvi', 'Aditi', 'Nandini', 'Bhavna', 'Chitra', 'Divya', 'Gauri', 'Hema',
  'Kiran', 'Lakshmi', 'Maya', 'Nisha', 'Pallavi', 'Radhika', 'Sakshi', 'Trisha', 'Uma', 'Vidya',
  'Akash', 'Deepak', 'Gaurav', 'Kunal', 'Mayank', 'Omkar', 'Rahul', 'Sagar', 'Tarun', 'Yash',
];

const LAST_NAMES = [
  'Sharma', 'Patel', 'Kulkarni', 'Deshmukh', 'Nair', 'Verma', 'Joshi', 'Rao', 'Menon', 'Iyer',
  'Patil', 'Shetty', 'Sen', 'Malhotra', 'Gupta', 'Reddy', 'Mehta', 'Singh', 'Bhat', 'Kamath',
  'Hegde', 'Gowda', 'Chatterjee', 'Banerjee', 'Das', 'Kapoor', 'Khanna', 'Bansal', 'Agarwal', 'Tiwari',
  'Mishra', 'Dubey', 'Pandey', 'Saxena', 'Chauhan', 'Rathore', 'Thakur', 'Yadav', 'Kaur', 'Gill',
  'Bose', 'Roy', 'Dutta', 'Ghosh', 'Sarkar', 'Pawar', 'Jadhav', 'Shinde', 'More', 'Sawant',
];

const TEACHER_TITLES = [
  { prefix: 'Dr.', qualification: 'Ph.D.', designation: 'Professor & Senior Faculty' },
  { prefix: 'Dr.', qualification: 'Ph.D.', designation: 'Professor' },
  { prefix: 'Dr.', qualification: 'Ph.D.', designation: 'Associate Professor' },
  { prefix: 'Prof.', qualification: 'M.Tech', designation: 'Associate Professor' },
  { prefix: 'Prof.', qualification: 'M.Tech', designation: 'Assistant Professor' },
  { prefix: 'Dr.', qualification: 'Ph.D.', designation: 'Associate Professor' },
  { prefix: 'Prof.', qualification: 'M.S.', designation: 'Assistant Professor' },
  { prefix: 'Prof.', qualification: 'M.E.', designation: 'Assistant Professor' },
  { prefix: 'Dr.', qualification: 'Ph.D.', designation: 'Professor' },
  { prefix: 'Prof.', qualification: 'M.Tech', designation: 'Assistant Professor' },
];

const SPECIALIZATIONS = {
  CS: ['Artificial Intelligence', 'Software Engineering', 'Distributed Systems', 'Database Internals', 'Cybersecurity', 'Algorithms', 'Cloud Computing', 'Compilers', 'Computer Networks', 'Human-Computer Interaction'],
  IT: ['Enterprise Web Systems', 'Information Security', 'Cloud DevOps', 'Data Warehousing', 'Mobile Engineering', 'API Architecture', 'UI Systems', 'Network Administration', 'IT Governance', 'Edge Computing'],
  ECE: ['VLSI Design', 'Embedded Systems', 'Digital Signal Processing', 'Wireless Communications', 'IoT Hardware', 'Microcontrollers', 'Optical Networks', 'RF Engineering', 'Robotics Control', 'Sensor Systems'],
  ME: ['Thermodynamics', 'CAD/CAM Design', 'Industrial Robotics', 'Fluid Mechanics', 'Mechatronics', 'Renewable Energy', 'Manufacturing Systems', 'Material Science', 'Finite Element Analysis', 'Automotive Dynamics'],
  CE: ['Structural Engineering', 'Geotechnical Systems', 'Smart Urban Planning', 'Environmental Engineering', 'Hydraulics', 'Transportation Systems', 'Concrete Technology', 'Surveying & GIS', 'Construction Management', 'Earthquake Engineering'],
  AIDS: ['Deep Learning', 'Natural Language Processing', 'Computer Vision', 'Statistical Inference', 'Big Data Engineering', 'Reinforcement Learning', 'Responsible AI', 'Predictive Analytics', 'Knowledge Graphs', 'MLOps'],
};

const THIRD_SUBJECT_BY_SEM = {
  1: 'Engineering Physics & Lab',
  2: 'Applied Communication & Ethics',
  3: 'Object-Oriented Design Lab',
  4: 'System Modeling & Simulation',
  5: 'Full-Stack Software Studio',
  6: 'Research Methodology & Mini Project',
  7: 'Industry Elective & Practical',
  8: 'Professional Practice & Viva',
};

const EXAM_DEFINITIONS = [
  { type: 'internal_1', label: 'Internal Assessment 1', maxMarks: 30, passMarks: 12, offsetDays: -35, start: '09:30:00', end: '10:45:00' },
  { type: 'assignment', label: 'Assignment Assessment', maxMarks: 20, passMarks: 8, offsetDays: -24, start: '14:00:00', end: '15:00:00' },
  { type: 'mid_semester', label: 'Mid-Semester Examination', maxMarks: 50, passMarks: 20, offsetDays: -12, start: '10:00:00', end: '12:00:00' },
  { type: 'practical', label: 'Practical Examination', maxMarks: 50, passMarks: 20, offsetDays: 5, start: '13:30:00', end: '16:00:00' },
  { type: 'internal_2', label: 'Internal Assessment 2', maxMarks: 30, passMarks: 12, offsetDays: 12, start: '09:30:00', end: '10:45:00' },
  { type: 'end_semester', label: 'End-Semester Examination', maxMarks: 100, passMarks: 40, offsetDays: 28, start: '10:00:00', end: '13:00:00' },
];

const EXTRA_FACILITIES = [
  { name: 'Digital Language & Communication Lab', category: 'lab', description: 'DEMO DATA: Audio-visual communication studio supporting interview prep and technical presentations.', location: 'Block A, 2nd Floor', hours: 'Mon-Fri: 9:00 AM - 5:30 PM', contact: 'langlab@smartcampus.demo', status: 'open' },
  { name: 'Central Student Hostels Complex', category: 'hostel', description: 'DEMO DATA: Residential student wings with Wi-Fi study lounges and 24/7 warden desk.', location: 'West Campus Residential Zone', hours: '24 Hours (Office 9 AM - 6 PM)', contact: 'hostels@smartcampus.demo', status: 'open' },
  { name: 'Mechanical & Mechatronics Workshop', category: 'lab', description: 'DEMO DATA: CNC machines, fabrication bays, and robotics prototyping floor.', location: 'Block D, Ground Floor', hours: 'Mon-Sat: 8:30 AM - 5:30 PM', contact: 'workshop@smartcampus.demo', status: 'open' },
  { name: 'Seminar & Placement Auditorium Annex', category: 'academic', description: 'DEMO DATA: Dedicated pre-placement talk auditorium and interview panel suites.', location: 'Placement Wing, 1st Floor', hours: 'Mon-Sat: 8:30 AM - 7:30 PM', contact: 'placementhall@smartcampus.demo', status: 'open' },
];

function deterministicRand(seed) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function buildDemoNotices(departments) {
  const notices = [];
  const categories = ['academic', 'exam', 'event', 'holiday', 'general'];
  const priorities = ['normal', 'important', 'urgent'];

  // 24 general/department academic & exam notices (brings total well over 30)
  for (let i = 1; i <= 24; i += 1) {
    const dept = i % 3 === 0 ? 'All' : departments[i % departments.length].name;
    const cat = categories[i % categories.length];
    const prio = priorities[i % priorities.length];
    notices.push({
      title: `[DEMO] ${dept === 'All' ? 'Campus-Wide' : dept} ${cat.toUpperCase()} Notice #${String(i).padStart(2, '0')}`,
      description: `DEMO DATA: Synthetic academic announcement #${i} regarding ${cat} workflows, lab submissions, and schedule reminders for ${dept}. Marked as demo content for evaluation.`,
      category: cat,
      target_department: dept,
      priority: prio,
    });
  }

  // 12 dedicated Placement & Career Development announcements
  const placementTopics = [
    'Software Engineering Campus Drive — Demo Eligibility & Pre-Placement Talk',
    'AI & Data Analytics Internship Fair — Demo Registration Open',
    'Mock Technical & Coding Assessment Round — Practice Schedule',
    'Resume Clinic & Portfolio Review Workshop for Pre-Final Year',
    'Core Electronics & Embedded Systems Placement Orientation',
    'Mechanical & Robotics Industry Hiring Simulation Briefing',
    'Civil & Smart Infrastructure Consulting Career Session',
    'Cloud Architecture & DevOps Apprenticeship Info Desk',
    'Soft Skills, Group Discussion & HR Interview Bootcamp',
    'Entrepreneurship & Startup Internship Matching Portal Demo',
    'Alumni Career Mentorship Week — Department Panels',
    'Gate, GRE & Higher Studies Guidance Desk Announcement',
  ];

  placementTopics.forEach((topic, idx) => {
    notices.push({
      title: `[DEMO Placement] ${topic}`,
      description: `DEMO DATA: Synthetic placement & career-development announcement #${idx + 1}. Contact the Training & Placement Cell demo desk for practice schedules and eligibility checklists.`,
      category: 'placement',
      target_department: idx < 4 ? 'All' : departments[idx % departments.length].name,
      priority: idx % 3 === 0 ? 'important' : 'normal',
    });
  });

  return notices;
}

function buildDemoEvents(departments) {
  const categorySpecs = [
    { cat: 'hackathon', label: 'Hackathon', img: '/images/event-hackathon.svg' },
    { cat: 'coding_competition', label: 'Coding Challenge', img: '/images/event-coding.svg' },
    { cat: 'technical_workshop', label: 'Technical Workshop', img: '/images/event-tech-workshop.svg' },
    { cat: 'cultural', label: 'Cultural Fest', img: '/images/event-cultural.svg' },
    { cat: 'sports', label: 'Sports Meet', img: '/images/event-sports.svg' },
    { cat: 'guest_lecture', label: 'Guest Lecture', img: '/images/event-seminar.svg' },
    { cat: 'seminar', label: 'Academic Seminar', img: '/images/event-seminar.svg' },
    { cat: 'placement', label: 'Placement Drive Prep', img: '/images/event-career.svg' },
    { cat: 'career_guidance', label: 'Career Guidance', img: '/images/event-career.svg' },
    { cat: 'club', label: 'Student Club Meetup', img: '/images/event-tech-workshop.svg' },
    { cat: 'entrepreneurship', label: 'Startup Pitch Day', img: '/images/event-career.svg' },
  ];

  const venues = [
    'Main Auditorium, Block A',
    'Innovation Lab 204',
    'Central Courtyard Pavilion',
    'Seminar Hall 2, Library Wing',
    'North Campus Sports Complex',
    'Placement Training Center',
    'AI Research Wing Atrium',
    'Open-Air Amphitheater',
  ];

  const events = [];
  for (let i = 0; i < 33; i += 1) {
    const spec = categorySpecs[i % categorySpecs.length];
    const dept = i % 2 === 0 ? 'All' : departments[i % departments.length].name;
    const semRange =
      spec.cat === 'placement' || spec.cat === 'career_guidance'
        ? 'Semesters 5-8'
        : i % 3 === 0
        ? 'All Semesters'
        : 'Semesters 1-8';
    const edition = Math.floor(i / categorySpecs.length) + 1;
    events.push({
      title: `[DEMO] ${dept === 'All' ? 'Campus' : dept} ${spec.label} Series ${edition}`,
      description: `DEMO DATA: Synthetic campus ${spec.label.toLowerCase()} organized for ${dept} students (${semRange}). Features interactive sessions, demos, and faculty mentorship.`,
      category: spec.cat,
      target_department: dept,
      semester_eligibility: semRange,
      offsetDays: 3 + i * 2,
      time: `${String(9 + (i % 7)).padStart(2, '0')}:30:00`,
      venue: venues[i % venues.length],
      organizer: `${dept === 'All' ? 'Student Council' : `${dept} Forum`} (Demo)`,
      registration_details: 'DEMO DATA • Free student registration with campus ID',
      image_url: spec.img,
    });
  }
  return events;
}

async function batchInsertIgnore(client, table, columns, rows, chunkSize = 400) {
  let inserted = 0;
  const safeChunkSize = Math.max(
    1,
    Math.min(chunkSize, Math.floor(60000 / columns.length))
  );
  for (let i = 0; i < rows.length; i += safeChunkSize) {
    const chunk = rows.slice(i, i + safeChunkSize);
    const flatValues = [];
    const valueTuples = [];
    for (const row of chunk) {
      const placeholders = [];
      for (const val of row) {
        flatValues.push(val);
        placeholders.push(`$${flatValues.length}`);
      }
      valueTuples.push(`(${placeholders.join(', ')})`);
    }
    const res = await client.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${valueTuples.join(', ')} ON CONFLICT DO NOTHING`,
      flatValues
    );
    inserted += res.rowCount || 0;
  }
  return inserted;
}

async function run() {
  const teacherPassPrefix = (process.env.DEMO_TEACHER_PASS_PREFIX || '').trim();
  const studentPassPrefix = (process.env.DEMO_STUDENT_PASS_PREFIX || '').trim();

  if (!teacherPassPrefix || !studentPassPrefix) {
    console.error(
      'Error: DEMO_TEACHER_PASS_PREFIX and DEMO_STUDENT_PASS_PREFIX environment variables are required.'
    );
    console.error(
      'Define both locally in backend/.env or your shell before running this seeder. No default password prefixes are provided in source code.'
    );
    process.exit(1);
  }

  const startedAt = Date.now();
  const stats = {
    facultyInserted: 0,
    teachersInserted: 0,
    teachersSkipped: 0,
    studentsInserted: 0,
    studentsSkipped: 0,
    subjectsInserted: 0,
    assignmentsInserted: 0,
    timetableInserted: 0,
    timetableSkipped: 0,
    noticesInserted: 0,
    eventsInserted: 0,
    facilitiesInserted: 0,
    examsInserted: 0,
    examSubjectsInserted: 0,
    marksInserted: 0,
    resultsInserted: 0,
    publishedDraftsUpdated: 0,
  };

  const teacherCredentials = [];
  const studentCredentials = [];

  let client = null;
  let inTransaction = false;

  try {
    client = await pool.connect();
    console.log('=== Starting Large Synthetic DEMO Data Generation ===');

    // 1. Inspect configured departments & existing admin reference (never alter real users)
    const { rows: departments } = await client.query(
      "SELECT id, code, name FROM departments WHERE status = 'active' ORDER BY id ASC"
    );
    if (departments.length === 0) {
      throw new Error('No active departments found. Run seed-demo first.');
    }

    const { rows: sectionRows } = await client.query(
      `SELECT DISTINCT UPPER(TRIM(section)) AS section FROM (
         SELECT section FROM users WHERE section IS NOT NULL AND section <> ''
         UNION SELECT section FROM timetable WHERE section IS NOT NULL AND section <> ''
         UNION SELECT section FROM exams WHERE section IS NOT NULL AND section <> ''
       ) s ORDER BY section ASC`
    );
    const sections = sectionRows.length > 0 ? sectionRows.map((r) => r.section) : ['A'];

    const { rows: admins } = await client.query(
      "SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1"
    );
    const adminId = admins[0]?.id || null;

    console.log(
      `Configured scope: ${departments.length} departments × ${SEMESTERS.length} semesters × ${sections.length} section(s) [${sections.join(', ')}]`
    );

    // Precompute cost-12 bcrypt hashes per password group (fast & genuinely salted!)
    console.log('Generating bcrypt hashes (cost 12) for synthetic demo accounts...');
    const teacherHashByDept = new Map();
    for (const dept of departments) {
      const pwd = `${teacherPassPrefix}${dept.code}2026`;
      teacherHashByDept.set(dept.code, {
        plain: pwd,
        hash: await bcrypt.hash(pwd, BCRYPT_ROUNDS),
      });
    }

    const studentHashByDeptSem = new Map();
    for (const dept of departments) {
      for (const sem of SEMESTERS) {
        const key = `${dept.code}|${sem}`;
        const pwd = `${studentPassPrefix}${dept.code}S${sem}`;
        studentHashByDeptSem.set(key, {
          plain: pwd,
          hash: await bcrypt.hash(pwd, BCRYPT_ROUNDS),
        });
      }
    }

    // ------------------------------------------------------------------------
    // PHASE A: Publish existing DEMO/DRAFT academic records so demo flows work
    // ------------------------------------------------------------------------
    await client.query('BEGIN');
    inTransaction = true;
    try {
      const u1 = await client.query(
        "UPDATE subjects SET status = 'published' WHERE is_demo = TRUE AND status = 'draft'"
      );
      const u2 = await client.query(
        "UPDATE notices SET status = 'published' WHERE is_demo = TRUE AND status = 'draft'"
      );
      const u3 = await client.query(
        "UPDATE events SET status = 'published' WHERE is_demo = TRUE AND status = 'draft'"
      );
      const u4 = await client.query(
        "UPDATE timetable SET status = 'published' WHERE is_demo = TRUE AND status = 'draft'"
      );
      const u5 = await client.query(
        "UPDATE exams SET status = 'published' WHERE is_demo = TRUE AND status = 'draft'"
      );
      const u6 = await client.query(
        `UPDATE exam_subjects es
         SET status = 'published'
         FROM exams e
         WHERE es.exam_id = e.id
           AND e.is_demo = TRUE
           AND es.status = 'draft'`
      );
      stats.publishedDraftsUpdated =
        u1.rowCount + u2.rowCount + u3.rowCount + u4.rowCount + u5.rowCount + u6.rowCount;
      await client.query('COMMIT');
      inTransaction = false;
    } catch (e) {
      if (inTransaction) {
        await client.query('ROLLBACK').catch(() => {});
        inTransaction = false;
      }
      throw e;
    }

    // ------------------------------------------------------------------------
    // PHASE B: 60 Synthetic Demo Teachers (10 per department) + Faculty Profiles
    // ------------------------------------------------------------------------
    await client.query('BEGIN');
    inTransaction = true;
    const demoTeachersByDept = new Map();
    try {
      for (let dIdx = 0; dIdx < departments.length; dIdx += 1) {
        const dept = departments[dIdx];
        const specs = SPECIALIZATIONS[dept.code] || SPECIALIZATIONS.CS;
        const pwdInfo = teacherHashByDept.get(dept.code);
        demoTeachersByDept.set(dept.name, []);

        for (let t = 1; t <= TEACHERS_PER_DEPT; t += 1) {
          const titleSpec = TEACHER_TITLES[(t - 1) % TEACHER_TITLES.length];
          const first = FIRST_NAMES[(dIdx * 10 + t * 3) % FIRST_NAMES.length];
          const last = LAST_NAMES[(dIdx * 7 + t * 5) % LAST_NAMES.length];
          const fullName = `${titleSpec.prefix} ${first} ${last}`;
          const num = String(t).padStart(2, '0');
          const empId = `DEMO-EMP-${dept.code}-${num}`;
          const email = `teacher.${dept.code.toLowerCase()}.${num}@smartcampus.demo`;
          const designation = `${titleSpec.designation} (${titleSpec.qualification}, ${specs[(t - 1) % specs.length]})`;
          const office = `Block ${dept.code}, Floor ${Math.ceil(t / 4)}, Room ${100 + t}`;
          const phone = `+91 98${String(dIdx + 1).padStart(2, '0')}0 ${String(20000 + t * 17).slice(0, 5)}`;
          const consult = t % 2 === 0 ? 'Tue & Thu, 2:00 PM - 4:00 PM' : 'Mon & Wed, 11:00 AM - 1:00 PM';

          // 1) Faculty profile
          const facRes = await client.query(
            `INSERT INTO faculty
               (name, department, designation, email, phone, office_location, consultation_hours, is_demo)
             VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
             ON CONFLICT DO NOTHING`,
            [fullName, dept.name, designation.slice(0, 100), email, phone, office, consult]
          );
          if (facRes.rowCount > 0) stats.facultyInserted += 1;

          const { rows: facRow } = await client.query(
            'SELECT id FROM faculty WHERE email = $1 LIMIT 1',
            [email]
          );
          const facultyId = facRow[0]?.id || null;

          // 2) Teacher user account
          const usrRes = await client.query(
            `INSERT INTO users
               (name, email, password_hash, role, student_id, employee_id, faculty_id, department, semester, section, status)
             VALUES ($1, $2, $3, 'teacher', NULL, $4, $5, $6, NULL, NULL, 'active')
             ON CONFLICT DO NOTHING`,
            [fullName, email, pwdInfo.hash, empId, facultyId, dept.name]
          );
          if (usrRes.rowCount > 0) stats.teachersInserted += 1;
          else stats.teachersSkipped += 1;

          const { rows: usrRow } = await client.query(
            'SELECT id, name, email, employee_id, faculty_id FROM users WHERE email = $1 LIMIT 1',
            [email]
          );
          demoTeachersByDept.get(dept.name).push(usrRow[0]);

          teacherCredentials.push({
            role: 'teacher',
            name: fullName,
            email,
            password: pwdInfo.plain,
            idNumber: empId,
            department: dept.name,
            semester: '-',
            section: '-',
          });
        }
      }
      await client.query('COMMIT');
      inTransaction = false;
    } catch (e) {
      if (inTransaction) {
        await client.query('ROLLBACK').catch(() => {});
        inTransaction = false;
      }
      throw e;
    }

    // ------------------------------------------------------------------------
    // PHASE C: 960+ Synthetic Demo Students (20 per dept × sem × section)
    // ------------------------------------------------------------------------
    await client.query('BEGIN');
    inTransaction = true;
    try {
      const studentRowsToInsert = [];
      let globalIdx = 1;
      for (let dIdx = 0; dIdx < departments.length; dIdx += 1) {
        const dept = departments[dIdx];
        for (const sem of SEMESTERS) {
          const pwdInfo = studentHashByDeptSem.get(`${dept.code}|${sem}`);
          for (const sec of sections) {
            for (let s = 1; s <= STUDENTS_PER_CLASS; s += 1) {
              const first = FIRST_NAMES[(globalIdx * 7 + dIdx * 3) % FIRST_NAMES.length];
              const last = LAST_NAMES[(globalIdx * 11 + sem * 5 + s) % LAST_NAMES.length];
              const fullName = `${first} ${last}`;
              const num = String(s).padStart(2, '0');
              const studentId = `DEMO-${dept.code}-S${sem}-${sec}-${num}`;
              const email = `student.${dept.code.toLowerCase()}.s${sem}.${sec.toLowerCase()}.${num}@smartcampus.demo`;

              studentRowsToInsert.push([
                fullName,
                email,
                pwdInfo.hash,
                'student',
                studentId,
                null,
                null,
                dept.name,
                sem,
                sec,
                'active',
              ]);

              studentCredentials.push({
                role: 'student',
                name: fullName,
                email,
                password: pwdInfo.plain,
                idNumber: studentId,
                department: dept.name,
                semester: sem,
                section: sec,
              });
              globalIdx += 1;
            }
          }
        }
      }

      const insertedCount = await batchInsertIgnore(
        client,
        'users',
        [
          'name', 'email', 'password_hash', 'role', 'student_id',
          'employee_id', 'faculty_id', 'department', 'semester', 'section', 'status',
        ],
        studentRowsToInsert,
        200
      );
      stats.studentsInserted = insertedCount;
      stats.studentsSkipped = studentRowsToInsert.length - insertedCount;
      await client.query('COMMIT');
      inTransaction = false;
    } catch (e) {
      if (inTransaction) {
        await client.query('ROLLBACK').catch(() => {});
        inTransaction = false;
      }
      throw e;
    }

    // ------------------------------------------------------------------------
    // PHASE D: Expand Subjects (3 per dept × sem = 144) & Teacher Assignments
    // ------------------------------------------------------------------------
    await client.query('BEGIN');
    inTransaction = true;
    const subjectsByDeptSem = new Map();
    const assignedTeacherByKey = new Map();
    try {
      for (const dept of departments) {
        for (const sem of SEMESTERS) {
          const code = `${dept.code}${sem}03`;
          const name = `${THIRD_SUBJECT_BY_SEM[sem]} (${dept.code})`;
          const res = await client.query(
            `INSERT INTO subjects
               (code, name, department_id, department, semester, credits, status, is_demo)
             VALUES ($1, $2, $3, $4, $5, 3, 'published', TRUE)
             ON CONFLICT DO NOTHING`,
            [code, name, dept.id, dept.name, sem]
          );
          if (res.rowCount > 0) stats.subjectsInserted += 1;
        }
      }

      // Load all published subjects per dept & sem
      const { rows: allSubjects } = await client.query(
        'SELECT id, code, name, department, semester FROM subjects ORDER BY department ASC, semester ASC, code ASC'
      );

      const assignmentRows = [];

      for (const subj of allSubjects) {
        const key = `${subj.department}|${subj.semester}`;
        if (!subjectsByDeptSem.has(key)) subjectsByDeptSem.set(key, []);
        subjectsByDeptSem.get(key).push(subj);
      }

      for (const dept of departments) {
        const deptTeachers = demoTeachersByDept.get(dept.name) || [];
        let rolling = 0;
        for (const sem of SEMESTERS) {
          const subjs = subjectsByDeptSem.get(`${dept.name}|${sem}`) || [];
          for (const sec of sections) {
            for (const subj of subjs) {
              const teacher = deptTeachers[rolling % deptTeachers.length];
              rolling += 1;
              if (teacher) {
                assignmentRows.push([
                  teacher.id,
                  subj.id,
                  dept.name,
                  sem,
                  sec,
                  '2026-27',
                  adminId,
                  'active',
                ]);
                assignedTeacherByKey.set(`${dept.name}|${sem}|${sec}|${subj.id}`, teacher);
              }
            }
          }
        }
      }

      stats.assignmentsInserted = await batchInsertIgnore(
        client,
        'teacher_assignments',
        ['teacher_id', 'subject_id', 'department', 'semester', 'section', 'academic_year', 'assigned_by', 'status'],
        assignmentRows,
        200
      );
      await client.query('COMMIT');
      inTransaction = false;
    } catch (e) {
      if (inTransaction) {
        await client.query('ROLLBACK').catch(() => {});
        inTransaction = false;
      }
      throw e;
    }

    // ----------------------------------------------------------------------
    // PHASE E: Conflict-Free Timetables Across Every Configured Class
    // ----------------------------------------------------------------------
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const slotTimes = [
      ['09:00:00', '10:00:00'],
      ['10:30:00', '11:30:00'],
      ['13:00:00', '14:00:00'],
      ['14:30:00', '15:30:00'],
    ];

    for (const dept of departments) {
      for (const sem of SEMESTERS) {
        const subjs = (subjectsByDeptSem.get(`${dept.name}|${sem}`) || []).slice(0, 3);
        for (const sec of sections) {
          for (let sIdx = 0; sIdx < subjs.length; sIdx += 1) {
            const slotNum = (sem - 1) * 3 + sIdx; // 0..23 unique within dept
            const day = days[slotNum % 6];
            const [startT, endT] = slotTimes[Math.floor(slotNum / 6) % 4];
            const room = `${dept.code}-T${sem}${sec}${sIdx + 1}`;
            const assignedTeacher = assignedTeacherByKey.get(
              `${dept.name}|${sem}|${sec}|${subjs[sIdx].id}`
            );

            try {
              const tRes = await client.query(
                `INSERT INTO timetable
                   (department, semester, section, subject, faculty_id, day_of_week, start_time, end_time, classroom, status, is_demo)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'published', TRUE)`,
                [
                  dept.name,
                  sem,
                  sec,
                  subjs[sIdx].name,
                  assignedTeacher ? assignedTeacher.faculty_id : null,
                  day,
                  startT,
                  endT,
                  room,
                ]
              );
              if (tRes.rowCount > 0) stats.timetableInserted += 1;
            } catch (err) {
              if (err && (err.code === 'P0001' || err.code === '23505')) {
                stats.timetableSkipped += 1;
              } else {
                throw err;
              }
            }
          }
        }
      }
    }

    // ----------------------------------------------------------------------
    // PHASE F: Notices (36+ new), Events (33+ new), Extra Facilities
    // ----------------------------------------------------------------------
    await client.query('BEGIN');
    inTransaction = true;
    try {
      for (const fac of EXTRA_FACILITIES) {
        const fRes = await client.query(
          `INSERT INTO facilities
             (name, category, description, location, opening_hours, contact_info, status, is_demo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
           ON CONFLICT DO NOTHING`,
          [fac.name, fac.category, fac.description, fac.location, fac.hours, fac.contact, fac.status]
        );
        if (fRes.rowCount > 0) stats.facilitiesInserted += 1;
      }

      const demoNotices = buildDemoNotices(departments);
      for (const n of demoNotices) {
        const { rows: exists } = await client.query(
          'SELECT id FROM notices WHERE title = $1 LIMIT 1',
          [n.title]
        );
        if (exists.length === 0) {
          await client.query(
            `INSERT INTO notices
               (title, description, category, target_department, priority, status, is_demo, posted_by, published_date)
             VALUES ($1, $2, $3, $4, $5, 'published', TRUE, $6, NOW())`,
            [n.title, n.description, n.category, n.target_department, n.priority, adminId]
          );
          stats.noticesInserted += 1;
        }
      }

      const demoEvents = buildDemoEvents(departments);
      for (const ev of demoEvents) {
        const { rows: exists } = await client.query(
          'SELECT id FROM events WHERE title = $1 LIMIT 1',
          [ev.title]
        );
        if (exists.length === 0) {
          await client.query(
            `INSERT INTO events
               (title, description, category, target_department, semester_eligibility,
                event_date, event_time, venue, organizer, registration_details,
                image_url, registration_link, status, is_demo, created_by)
             VALUES ($1, $2, $3, $4, $5, CURRENT_DATE + ($6::int * INTERVAL '1 day'), $7, $8, $9, $10, $11, '#demo-register', 'published', TRUE, $12)`,
            [
              ev.title,
              ev.description,
              ev.category,
              ev.target_department,
              ev.semester_eligibility,
              ev.offsetDays,
              ev.time,
              ev.venue,
              ev.organizer,
              ev.registration_details,
              ev.image_url,
              adminId,
            ]
          );
          stats.eventsInserted += 1;
        }
      }
      await client.query('COMMIT');
      inTransaction = false;
    } catch (e) {
      if (inTransaction) {
        await client.query('ROLLBACK').catch(() => {});
        inTransaction = false;
      }
      throw e;
    }

    // ----------------------------------------------------------------------
    // PHASE G: Examinations (All 6 Types × All Depts × All Semesters)
    // ----------------------------------------------------------------------
    await client.query('BEGIN');
    inTransaction = true;
    const examMetaList = [];
    try {
      for (const dept of departments) {
        for (const sem of SEMESTERS) {
          const subjs = (subjectsByDeptSem.get(`${dept.name}|${sem}`) || []).slice(0, 3);
          for (const sec of sections) {
            for (const exDef of EXAM_DEFINITIONS) {
              const title = `[DEMO] ${dept.code} Semester ${sem} ${exDef.label}`;
              const { rows: existing } = await client.query(
                `SELECT id FROM exams WHERE title = $1 AND department = $2 AND semester = $3 AND section = $4 LIMIT 1`,
                [title, dept.name, sem, sec]
              );

              let examId;
              if (existing.length === 0) {
                const { rows: exRows } = await client.query(
                  `INSERT INTO exams
                     (title, exam_type, department, semester, section, academic_year, instructions, status, is_demo, created_by)
                   VALUES ($1, $2, $3, $4, $5, '2026-27', $6, 'published', TRUE, $7)
                   RETURNING id`,
                  [
                    title,
                    exDef.type,
                    dept.name,
                    sem,
                    sec,
                    'DEMO DATA: Synthetic examination schedule generated for portal evaluation.',
                    adminId,
                  ]
                );
                examId = exRows[0].id;
                stats.examsInserted += 1;
              } else {
                examId = existing[0].id;
              }

              const examSubjectEntries = [];
              for (let sIdx = 0; sIdx < subjs.length; sIdx += 1) {
                const subj = subjs[sIdx];
                const esRes = await client.query(
                  `INSERT INTO exam_subjects
                     (exam_id, subject_id, exam_date, start_time, end_time, max_marks, passing_marks, room, instructions, status)
                   VALUES ($1, $2, CURRENT_DATE + ($3::int * INTERVAL '1 day'), $4, $5, $6, $7, $8, 'DEMO DATA: Carry ID card.', 'published')
                   ON CONFLICT DO NOTHING`,
                  [
                    examId,
                    subj.id,
                    exDef.offsetDays + sIdx,
                    exDef.start,
                    exDef.end,
                    exDef.maxMarks,
                    exDef.passMarks,
                    `${dept.code}-ExamHall-${sem}`,
                  ]
                );
                if (esRes.rowCount > 0) stats.examSubjectsInserted += 1;

                const { rows: esRow } = await client.query(
                  'SELECT id, subject_id, max_marks, passing_marks FROM exam_subjects WHERE exam_id = $1 AND subject_id = $2 LIMIT 1',
                  [examId, subj.id]
                );
                if (esRow[0]) {
                  examSubjectEntries.push({
                    ...esRow[0],
                    teacher: assignedTeacherByKey.get(`${dept.name}|${sem}|${sec}|${subj.id}`),
                  });
                }
              }

              examMetaList.push({
                examId,
                examType: exDef.type,
                department: dept.name,
                semester: sem,
                section: sec,
                subjects: examSubjectEntries,
              });
            }
          }
        }
      }
      await client.query('COMMIT');
      inTransaction = false;
    } catch (e) {
      if (inTransaction) {
        await client.query('ROLLBACK').catch(() => {});
        inTransaction = false;
      }
      throw e;
    }

    // ----------------------------------------------------------------------
    // PHASE H: Synthetic Marks & Results (STRICTLY FOR DEMO STUDENTS ONLY!)
    // Never generates fake marks for real student accounts!
    // ----------------------------------------------------------------------
    console.log('Generating realistic synthetic marks & results for DEMO students only...');
    const { rows: demoStudents } = await client.query(
      `SELECT id, student_id, department, semester, COALESCE(section, 'A') AS section
       FROM users
       WHERE role = 'student'
         AND email LIKE 'student.%@smartcampus.demo'
         AND student_id LIKE 'DEMO-%'
       ORDER BY id ASC`
    );

    const studentsByClass = new Map();
    for (const st of demoStudents) {
      const key = `${st.department}|${st.semester}|${st.section}`;
      if (!studentsByClass.has(key)) studentsByClass.set(key, []);
      studentsByClass.get(key).push(st);
    }

    const markRows = [];
    const resultRows = [];

    for (const ex of examMetaList) {
      const classStudents =
        studentsByClass.get(`${ex.department}|${ex.semester}|${ex.section}`) || [];

      // Keep Sem 5 internal_2 marks in 'submitted' state so Admin sees real pending approvals!
      const leavePendingApproval =
        ex.semester === 5 && ex.examType === 'internal_2';

      for (let stIdx = 0; stIdx < classStudents.length; stIdx += 1) {
        const st = classStudents[stIdx];

        // Realistic varied performance bands across the 20 students in each class:
        // 0..3 High (84%-97%), 4..13 Average (60%-82%), 14..16 Borderline Pass (44%-58%), 17..19 Low/Fail (20%-38%)
        let bandMin = 60;
        let bandMax = 82;
        let remark = 'DEMO DATA — Consistent academic progress';
        if (stIdx < 4) {
          bandMin = 84;
          bandMax = 97;
          remark = 'DEMO DATA — Outstanding academic performance';
        } else if (stIdx >= 14 && stIdx <= 16) {
          bandMin = 44;
          bandMax = 58;
          remark = 'DEMO DATA — Satisfactory; scope to improve';
        } else if (stIdx >= 17) {
          bandMin = 20;
          bandMax = 38;
          remark = 'DEMO DATA — Below passing threshold; academic support advised';
        }

        const studentSubjectMarks = [];

        for (let subIdx = 0; subIdx < ex.subjects.length; subIdx += 1) {
          const es = ex.subjects[subIdx];
          const maxM = Number(es.max_marks);
          const passM = Number(es.passing_marks);

          const r = deterministicRand(st.id * 31 + es.id * 17 + subIdx * 7);
          const pct = bandMin + r * (bandMax - bandMin);
          let obtained = Math.round(((pct / 100) * maxM) * 2) / 2;
          obtained = Math.max(0, Math.min(maxM, obtained));

          const submissionStatus = leavePendingApproval ? 'submitted' : 'approved';
          const enteredBy = es.teacher ? es.teacher.id : adminId;
          const reviewedBy = leavePendingApproval ? null : adminId;
          const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

          markRows.push([
            es.id,
            st.id,
            es.subject_id,
            enteredBy,
            obtained,
            maxM,
            remark,
            submissionStatus,
            nowStr,
            reviewedBy,
            leavePendingApproval ? null : nowStr,
            leavePendingApproval ? null : 'DEMO DATA — Verified for demo publication',
          ]);

          studentSubjectMarks.push({
            obtained_marks: obtained,
            max_marks: maxM,
            passing_marks: passM,
          });
        }

        // Publish verified results for approved demo exams using configurable gradingRules.js
        if (!leavePendingApproval && studentSubjectMarks.length > 0) {
          const calc = calculateExamResult(studentSubjectMarks);
          const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
          resultRows.push([
            ex.examId,
            st.id,
            calc.totalObtained,
            calc.totalMax,
            calc.percentage,
            calc.grade,
            calc.passStatus,
            'published',
            adminId,
            nowStr,
          ]);
        }
      }
    }

    await client.query('BEGIN');
    inTransaction = true;
    try {
      stats.marksInserted = await batchInsertIgnore(
        client,
        'marks',
        [
          'exam_subject_id', 'student_id', 'subject_id', 'entered_by',
          'obtained_marks', 'max_marks', 'remarks', 'submission_status',
          'submitted_at', 'reviewed_by', 'reviewed_at', 'review_notes',
        ],
        markRows,
        500
      );

      stats.resultsInserted = await batchInsertIgnore(
        client,
        'results',
        [
          'exam_id', 'student_id', 'total_obtained', 'total_max',
          'percentage', 'grade', 'pass_status', 'publish_status',
          'published_by', 'published_at',
        ],
        resultRows,
        500
      );
      await client.query('COMMIT');
      inTransaction = false;
    } catch (e) {
      if (inTransaction) {
        await client.query('ROLLBACK').catch(() => {});
        inTransaction = false;
      }
      throw e;
    }

    // ------------------------------------------------------------------------
    // PHASE I: Write Local Credentials Report & Summary (gitignored docs/demo-local)
    // ------------------------------------------------------------------------
    const reportDir = path.join(__dirname, '..', '..', 'docs', 'demo-local');
    fs.mkdirSync(reportDir, { recursive: true });

    // Full CSV of all 1,020 synthetic accounts
    const csvHeader = 'role,name,email,password,id_number,department,semester,section\n';
    const csvLines = [...teacherCredentials, ...studentCredentials]
      .map((c) =>
        [c.role, `"${c.name}"`, c.email, c.password, c.idNumber, `"${c.department}"`, c.semester, c.section].join(',')
      )
      .join('\n');
    fs.writeFileSync(path.join(reportDir, 'DEMO_CREDENTIALS.csv'), csvHeader + csvLines + '\n', 'utf8');

    // Readable Markdown quick-reference + full teacher credentials + sample student logins
    const sampleTeachersMd = teacherCredentials
      .filter((_, idx) => idx % 10 < 2)
      .map(
        (c) =>
          `| ${c.name} | \`${c.email}\` | \`${c.password}\` | ${c.idNumber} | ${c.department} |`
      )
      .join('\n');

    const sampleStudentsMd = studentCredentials
      .filter((_, idx) => idx % 20 === 0)
      .map(
        (c) =>
          `| ${c.name} | \`${c.email}\` | \`${c.password}\` | ${c.idNumber} | ${c.department} | Sem ${c.semester} | ${c.section} |`
      )
      .join('\n');

    const credsMd = `# LOCAL DEMONSTRATION ONLY — Synthetic Demo Login Credentials

> **SECURITY NOTICE:** These accounts are synthetic demo credentials for **local project evaluation only**. This folder (\`docs/demo-local/\`) is gitignored and never served by the backend or frontend. Passwords in PostgreSQL are stored strictly as cost-12 bcrypt hashes.

## Documented Demo Password Policy
* **Demo Teachers:** \`${teacherPassPrefix}<DEPT_CODE>2026\`
* **Demo Students:** \`${studentPassPrefix}<DEPT_CODE>S<SEMESTER>\`
* **Full 1,020-account list:** See \`docs/demo-local/DEMO_CREDENTIALS.csv\`

## Sample Demo Teachers (2 per Department — 60 Total in CSV)
| Name | Email | Password | Employee ID | Department |
| :--- | :--- | :--- | :--- | :--- |
${sampleTeachersMd}

## Sample Demo Students (1 per Department & Semester — 960 Total in CSV)
| Name | Email | Password | Student ID | Department | Semester | Section |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${sampleStudentsMd}
`;
    fs.writeFileSync(path.join(reportDir, 'DEMO_CREDENTIALS.md'), credsMd, 'utf8');

    // Query live database totals for SEED_SUMMARY.md
    const tableTotals = {};
    for (const tbl of [
      'departments', 'users', 'faculty', 'subjects', 'teacher_assignments',
      'timetable', 'notices', 'events', 'facilities', 'exams', 'exam_subjects',
      'marks', 'results',
    ]) {
      const { rows: cnt } = await client.query(`SELECT COUNT(*)::int AS c FROM ${tbl}`);
      tableTotals[tbl] = Number(cnt[0].c);
    }

    const { rows: roleTotals } = await client.query(
      'SELECT role, COUNT(*)::int AS c FROM users GROUP BY role ORDER BY role'
    );

    const summaryMd = `# Synthetic Demo Data Seeding Summary

Generated at: ${new Date().toISOString()}
Database: \`${process.env.PG_DATABASE || 'campus_assistant_pg'}\`

## Records Inserted / Skipped During Latest Run
| Category | Inserted | Skipped / Existing |
| :--- | ---: | ---: |
| Synthetic Teachers | ${stats.teachersInserted} | ${stats.teachersSkipped} |
| Synthetic Students | ${stats.studentsInserted} | ${stats.studentsSkipped} |
| Faculty Profiles | ${stats.facultyInserted} | — |
| Subjects Added | ${stats.subjectsInserted} | — |
| Teacher Assignments | ${stats.assignmentsInserted} | — |
| Timetable Slots | ${stats.timetableInserted} | ${stats.timetableSkipped} |
| Notices | ${stats.noticesInserted} | — |
| Campus Events | ${stats.eventsInserted} | — |
| Facilities | ${stats.facilitiesInserted} | — |
| Examinations | ${stats.examsInserted} | — |
| Exam Subject Papers | ${stats.examSubjectsInserted} | — |
| Synthetic Marks (DEMO students only) | ${stats.marksInserted} | — |
| Synthetic Results (DEMO students only) | ${stats.resultsInserted} | — |
| Existing DEMO Drafts Published | ${stats.publishedDraftsUpdated} | — |

## Live Database Totals
| Table | Total Rows |
| :--- | ---: |
${Object.entries(tableTotals).map(([k, v]) => `| \`${k}\` | ${v} |`).join('\n')}

## Users Breakdown by Role (Includes Preserved Real Accounts)
${roleTotals.map((r) => `- **${r.role}**: ${r.c}`).join('\n')}
`;
    fs.writeFileSync(path.join(reportDir, 'SEED_SUMMARY.md'), summaryMd, 'utf8');

    const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(2);
    console.log(`\n=== Seeding Complete in ${elapsedSec}s ===`);
    console.log(JSON.stringify({ stats, tableTotals, roleTotals }, null, 2));
    console.log('Local reports saved in: docs/demo-local/ (gitignored)');
  } catch (e) {
    if (inTransaction && client) {
      await client.query('ROLLBACK').catch(() => {});
      inTransaction = false;
    }
    throw e;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Large demo seeding failed:', err.code || err.message, err);
  process.exit(1);
});
