// ============================================================================
// Sample / Demo UI Preview Data for Phase 4
// NOTE: This file contains static placeholder data for frontend layout preview
// only. Real MySQL records (campus_assistant_db_v2) and live Google Gemini
// responses will be connected through Express APIs in upcoming phases.
// ============================================================================

export const SAMPLE_NOTICES = [
  {
    id: 1,
    title: 'Mid-Semester Examination Schedule Released',
    description:
      'Timetables for all undergraduate mid-semester assessments have been finalized. Students must bring their university ID cards to the examination hall.',
    category: 'exam',
    target_department: 'All',
    priority: 'urgent',
    status: 'published',
    posted_by: 'Office of Academic Affairs',
    published_date: '2026-11-22',
  },
  {
    id: 2,
    title: 'AI & Software Engineering Project Review Dates',
    description:
      'Department of Computer Science project milestone reviews for Semester 5 and 7 will take place in Block B seminar rooms next week.',
    category: 'academic',
    target_department: 'Computer Science',
    priority: 'important',
    status: 'published',
    posted_by: 'CS Department Admin',
    published_date: '2026-11-20',
  },
  {
    id: 3,
    title: 'Campus Placement Readiness Orientation',
    description:
      'The Training & Placement Cell is hosting a resume review and mock interview briefing for final-year and pre-final-year students.',
    category: 'placement',
    target_department: 'All',
    priority: 'normal',
    status: 'published',
    posted_by: 'Placement Cell',
    published_date: '2026-11-18',
  },
  {
    id: 4,
    title: 'Extended Central Library Hours During Exam Week',
    description:
      'The Central Library reading hall will remain open until 10:30 PM from Monday through Saturday during the examination period.',
    category: 'general',
    target_department: 'All',
    priority: 'important',
    status: 'published',
    posted_by: 'Chief Librarian',
    published_date: '2026-11-16',
  },
  {
    id: 5,
    title: 'Winter Break Academic Calendar Draft',
    description:
      'Internal draft notice outlining tentative dates for semester recess and next-term course registration.',
    category: 'holiday',
    target_department: 'All',
    priority: 'normal',
    status: 'draft',
    posted_by: 'Registrar Office',
    published_date: '2026-11-23',
  },
];

export const SAMPLE_EVENTS = [
  {
    id: 1,
    title: 'Annual AI & Smart Systems Symposium',
    description:
      'Keynote talks and student poster presentations exploring applied AI in campus automation and software engineering.',
    event_date: '2026-11-28',
    event_time: '10:00 AM',
    venue: 'Main Auditorium, Block A',
    organizer: 'Department of Computer Science',
    registration_details: 'Open to all students • Register at CS Helpdesk',
  },
  {
    id: 2,
    title: 'Full-Stack Web Engineering Workshop',
    description:
      'Hands-on workshop covering REST API architecture, relational database design, and responsive frontend systems.',
    event_date: '2026-12-02',
    event_time: '02:00 PM',
    venue: 'Innovation Lab 204',
    organizer: 'ACM Student Chapter',
    registration_details: 'Limited to 60 seats • Free student entry',
  },
  {
    id: 3,
    title: 'Inter-Department Tech & Robotics Expo',
    description:
      'Live demonstrations of student prototypes across robotics, IoT, and green campus engineering initiatives.',
    event_date: '2026-12-06',
    event_time: '11:00 AM',
    venue: 'Central Courtyard Pavilion',
    organizer: 'Student Technical Council',
    registration_details: 'Team submissions close Dec 3',
  },
  {
    id: 4,
    title: 'Research Methodology & Paper Writing Clinic',
    description:
      'Faculty-led session on literature surveys, citation standards, and presenting academic project reports.',
    event_date: '2026-12-10',
    event_time: '03:30 PM',
    venue: 'Seminar Hall 2, Library Wing',
    organizer: 'Academic Research Cell',
    registration_details: 'Walk-in registration with student ID',
  },
];

export const SAMPLE_FACULTY = [
  {
    id: 1,
    name: 'Dr. Meera Nair',
    department: 'Computer Science',
    designation: 'Professor & HOD',
    email: 'meera.nair@campus-demo.edu',
    phone: '+91 98000 11001',
    office_location: 'Block B, Room 302',
    consultation_hours: 'Mon & Wed, 2:00 PM – 4:00 PM',
  },
  {
    id: 2,
    name: 'Prof. Arjun Deshmukh',
    department: 'Computer Science',
    designation: 'Associate Professor',
    email: 'arjun.deshmukh@campus-demo.edu',
    phone: '+91 98000 11002',
    office_location: 'Block B, Room 214',
    consultation_hours: 'Tue & Thu, 11:30 AM – 1:00 PM',
  },
  {
    id: 3,
    name: 'Dr. Kavita Kulkarni',
    department: 'Electronics & Communication',
    designation: 'Professor',
    email: 'kavita.kulkarni@campus-demo.edu',
    phone: '+91 98000 11003',
    office_location: 'Block C, Room 108',
    consultation_hours: 'Mon–Fri, 3:00 PM – 4:00 PM',
  },
  {
    id: 4,
    name: 'Prof. Rohan Verma',
    department: 'Information Technology',
    designation: 'Assistant Professor',
    email: 'rohan.verma@campus-demo.edu',
    phone: '+91 98000 11004',
    office_location: 'Block B, Room 119',
    consultation_hours: 'Wed & Fri, 1:30 PM – 3:00 PM',
  },
  {
    id: 5,
    name: 'Dr. Ananya Sen',
    department: 'Mathematics',
    designation: 'Associate Professor',
    email: 'ananya.sen@campus-demo.edu',
    phone: '+91 98000 11005',
    office_location: 'Block A, Room 205',
    consultation_hours: 'Tue & Thu, 2:30 PM – 4:00 PM',
  },
];

export const SAMPLE_TIMETABLE = [
  {
    id: 1,
    department: 'Computer Science',
    semester: 5,
    section: 'A',
    subject: 'AI Software Development',
    faculty_name: 'Dr. Meera Nair',
    day_of_week: 'Monday',
    start_time: '09:00 AM',
    end_time: '10:00 AM',
    classroom: 'CS-201',
  },
  {
    id: 2,
    department: 'Computer Science',
    semester: 5,
    section: 'A',
    subject: 'Database Management Systems',
    faculty_name: 'Prof. Arjun Deshmukh',
    day_of_week: 'Monday',
    start_time: '10:15 AM',
    end_time: '11:15 AM',
    classroom: 'CS-204',
  },
  {
    id: 3,
    department: 'Computer Science',
    semester: 5,
    section: 'A',
    subject: 'Web Engineering Lab',
    faculty_name: 'Prof. Rohan Verma',
    day_of_week: 'Monday',
    start_time: '01:30 PM',
    end_time: '03:30 PM',
    classroom: 'Lab-3',
  },
  {
    id: 4,
    department: 'Computer Science',
    semester: 5,
    section: 'A',
    subject: 'Probability & Statistics',
    faculty_name: 'Dr. Ananya Sen',
    day_of_week: 'Tuesday',
    start_time: '09:00 AM',
    end_time: '10:00 AM',
    classroom: 'A-105',
  },
  {
    id: 5,
    department: 'Computer Science',
    semester: 5,
    section: 'A',
    subject: 'Computer Networks',
    faculty_name: 'Dr. Kavita Kulkarni',
    day_of_week: 'Wednesday',
    start_time: '11:30 AM',
    end_time: '12:30 PM',
    classroom: 'CS-202',
  },
  {
    id: 6,
    department: 'Computer Science',
    semester: 5,
    section: 'A',
    subject: 'AI Software Development Lab',
    faculty_name: 'Dr. Meera Nair',
    day_of_week: 'Thursday',
    start_time: '02:00 PM',
    end_time: '04:00 PM',
    classroom: 'AI-Lab 1',
  },
  {
    id: 7,
    department: 'Computer Science',
    semester: 5,
    section: 'A',
    subject: 'Software Architecture Seminar',
    faculty_name: 'Prof. Arjun Deshmukh',
    day_of_week: 'Friday',
    start_time: '10:15 AM',
    end_time: '11:15 AM',
    classroom: 'CS-201',
  },
];

export const SAMPLE_FACILITIES = [
  {
    id: 1,
    name: 'Central Academic Library',
    category: 'library',
    description:
      'Multi-floor library with quiet study zones, digital journal access, and group discussion cabins.',
    location: 'Knowledge Wing, Ground & 1st Floor',
    opening_hours: 'Mon–Sat: 8:00 AM – 8:00 PM',
    contact_info: 'library@campus-demo.edu • Ext. 201',
    status: 'open',
  },
  {
    id: 2,
    name: 'AI & High-Performance Computing Lab',
    category: 'lab',
    description:
      'Equipped with 45 workstations dedicated to software development, data science, and AI coursework.',
    location: 'Block B, 2nd Floor, Room 210',
    opening_hours: 'Mon–Fri: 9:00 AM – 6:30 PM',
    contact_info: 'ailab@campus-demo.edu • Ext. 314',
    status: 'open',
  },
  {
    id: 3,
    name: 'Campus Medical & Wellness Center',
    category: 'medical',
    description:
      'On-campus primary health care, first aid, and student counseling services.',
    location: 'Student Services Annex, Ground Floor',
    opening_hours: 'Mon–Sat: 8:30 AM – 6:00 PM',
    contact_info: 'wellness@campus-demo.edu • Ext. 108',
    status: 'open',
  },
  {
    id: 4,
    name: 'Indoor Sports Complex',
    category: 'sports',
    description:
      'Badminton courts, table tennis arena, and student fitness center.',
    location: 'North Campus Recreation Block',
    opening_hours: 'Daily: 6:00 AM – 9:00 PM',
    contact_info: 'sports@campus-demo.edu • Ext. 412',
    status: 'maintenance',
  },
  {
    id: 5,
    name: 'Campus Dining Commons',
    category: 'dining',
    description:
      'Hygienic student cafeteria offering daily meals, snacks, and study seating.',
    location: 'Central Plaza, East Wing',
    opening_hours: 'Daily: 7:30 AM – 9:30 PM',
    contact_info: 'dining@campus-demo.edu • Ext. 502',
    status: 'open',
  },
];

export const SUGGESTED_CHAT_QUESTIONS = [
  'What are the latest exam notices?',
  'What are Central Library opening hours?',
  'Show my Monday CS Semester 5 classes',
  'Where is Dr. Meera Nair’s office and consultation hours?',
  'What upcoming campus events can I attend?',
];

export function getDemoChatbotReply(question) {
  const q = question.toLowerCase();

  if (q.includes('exam') || q.includes('notice')) {
    return 'Demo Preview Response: According to the sample notices, the Mid-Semester Examination Schedule has been released (Priority: Urgent) and Central Library hours are extended until 10:30 PM during exam week. Live verified notices from MySQL will be connected in the Gemini integration phase.';
  }

  if (q.includes('library') || q.includes('facility') || q.includes('hours')) {
    return 'Demo Preview Response: In the sample facilities directory, the Central Academic Library (Knowledge Wing) is listed as Open Mon–Sat, 8:00 AM – 8:00 PM (extended to 10:30 PM during exam week). Live database-backed answers will be enabled once Gemini is integrated.';
  }

  if (q.includes('timetable') || q.includes('monday') || q.includes('class')) {
    return 'Demo Preview Response: Sample Monday classes for CS Semester 5 (Section A) include AI Software Development (09:00 AM, CS-201), Database Management Systems (10:15 AM, CS-204), and Web Engineering Lab (01:30 PM, Lab-3).';
  }

  if (q.includes('faculty') || q.includes('meera') || q.includes('office') || q.includes('prof')) {
    return 'Demo Preview Response: In the sample faculty directory, Dr. Meera Nair (Professor & HOD, Computer Science) is located in Block B, Room 302, with consultation hours on Mon & Wed, 2:00 PM – 4:00 PM.';
  }

  if (q.includes('event') || q.includes('workshop') || q.includes('symposium')) {
    return 'Demo Preview Response: Upcoming sample events include the Annual AI & Smart Systems Symposium (Nov 28, Main Auditorium) and the Full-Stack Web Engineering Workshop (Dec 2, Innovation Lab 204).';
  }

  return 'Demo Preview Response: Thank you for testing the Smart Campus AI Chatbot UI! Right now this interface uses sample preview responses. Once Google Gemini API and our campus_assistant_db_v2 MySQL endpoints are connected, I will answer directly using verified college records.';
}
