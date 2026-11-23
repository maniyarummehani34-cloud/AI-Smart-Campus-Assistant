import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Award,
  Bell,
  Bot,
  Building2,
  Calendar,
  Clock,
  FileSpreadsheet,
  LayoutDashboard,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react';
import PortalLayout from '../components/PortalLayout';
import PaginationBar from '../components/PaginationBar';
import { useAuth } from '../context/AuthContext';
import {
  fetchEventsApi,
  fetchFacilitiesApi,
  fetchFacultyApi,
  fetchNoticesApi,
  fetchStudentDashboardApi,
  fetchStudentExamsApi,
  fetchStudentResultsApi,
  fetchTimetableApi,
} from '../services/campusApi';
import './StudentPortal.css';

const STUDENT_NAV_ITEMS = [
  { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
  { id: 'notices', label: 'Notices & Updates', icon: Bell },
  { id: 'exams', label: 'Exam Schedules', icon: FileSpreadsheet },
  { id: 'results', label: 'Marks & Results', icon: Award },
  { id: 'timetable', label: 'Class Timetable', icon: Clock },
  { id: 'events', label: 'Campus Events', icon: Calendar },
  { id: 'faculty', label: 'Faculty Directory', icon: Users },
  { id: 'facilities', label: 'Campus Facilities', icon: Building2 },
  { id: 'chatbot', label: 'AI Campus Assistant', icon: Bot, to: '/chatbot' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const EXAM_TYPE_LABELS = {
  internal_1: 'Internal Assessment 1',
  internal_2: 'Internal Assessment 2',
  mid_semester: 'Mid-Semester Exam',
  end_semester: 'End-Semester Exam',
  practical: 'Practical Exam',
  assignment: 'Assignment Assessment',
};

function extractDateParts(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return { year: match[1], monthIdx: Number(match[2]) - 1, day: match[3] };
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return {
    year: String(d.getFullYear()),
    monthIdx: d.getMonth(),
    day: String(d.getDate()).padStart(2, '0'),
  };
}

function formatDisplayDate(dateValue) {
  const parts = extractDateParts(dateValue);
  if (!parts) return '—';
  return `${MONTHS[parts.monthIdx] || ''} ${Number(parts.day)}, ${parts.year}`;
}

function formatTime(timeStr) {
  if (!timeStr) return '—';
  const parts = String(timeStr).split(':');
  if (parts.length < 2) return timeStr;
  let hour = Number(parts[0]);
  if (Number.isNaN(hour)) return timeStr;
  const period = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${String(hour).padStart(2, '0')}:${parts[1]} ${period}`;
}

function getPriorityBadgeClass(priority) {
  if (priority === 'urgent') return 'badge-danger';
  if (priority === 'important') return 'badge-warning';
  return 'badge-info';
}

function getFacilityStatusBadge(status) {
  if (status === 'open') return 'badge-success';
  if (status === 'maintenance') return 'badge-warning';
  return 'badge-danger';
}

function LoadingState({ text = 'Loading campus records...' }) {
  return (
    <div className="portal-state-card" role="status" aria-live="polite">
      <div className="portal-spinner" aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, compact = false }) {
  return (
    <div className={`portal-state-card ${compact ? 'compact' : ''}`}>
      <span className="portal-state-icon" aria-hidden="true">
        <Icon size={20} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function ErrorBanner({ message, onRetry }) {
  return (
    <div className="portal-error-card" role="alert">
      <div className="portal-error-left">
        <AlertCircle size={18} style={{ flexShrink: 0 }} />
        <span>{message}</span>
      </div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
        <RefreshCw size={14} />
        <span>Retry</span>
      </button>
    </div>
  );
}

function StudentPortal() {
  const { user, token } = useAuth();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState('overview');
  const [reloadTick, setReloadTick] = useState(0);
  const [accessNotice, setAccessNotice] = useState(
    location.state?.accessNotice || ''
  );

  // Filters & Pagination
  const [noticeCategory, setNoticeCategory] = useState('all');
  const [examTypeFilter, setExamTypeFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('upcoming');
  const [dayFilter, setDayFilter] = useState('All');
  const [facultySearch, setFacultySearch] = useState('');
  const [facilityStatus, setFacilityStatus] = useState('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  // Live API data
  const [dashboardData, setDashboardData] = useState(null);
  const [notices, setNotices] = useState([]);
  const [exams, setExams] = useState([]);
  const [resultsData, setResultsData] = useState({ results: [], gradingRules: null });
  const [events, setEvents] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [facilities, setFacilities] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const handleRetry = () => setReloadTick((prev) => prev + 1);

  useEffect(() => {
    if (!token) return;
    let active = true;

    async function loadTab() {
      setLoading(true);
      setError('');
      try {
        if (activeTab === 'overview') {
          const data = await fetchStudentDashboardApi(token);
          if (active) setDashboardData(data);
        } else if (activeTab === 'notices') {
          const data = await fetchNoticesApi(token, { category: noticeCategory });
          if (active) setNotices(data.notices || []);
        } else if (activeTab === 'exams') {
          const data = await fetchStudentExamsApi(token, { examType: examTypeFilter });
          if (active) setExams(data.exams || []);
        } else if (activeTab === 'results') {
          const data = await fetchStudentResultsApi(token);
          if (active) setResultsData(data);
        } else if (activeTab === 'events') {
          const data = await fetchEventsApi(token, { filter: eventFilter });
          if (active) setEvents(data.events || []);
        } else if (activeTab === 'timetable') {
          const data = await fetchTimetableApi(token, { day: dayFilter });
          if (active) setTimetable(data.timetable || []);
        } else if (activeTab === 'faculty') {
          const data = await fetchFacultyApi(token, { search: facultySearch });
          if (active) setFaculty(data.faculty || []);
        } else if (activeTab === 'facilities') {
          const data = await fetchFacilitiesApi(token, { status: facilityStatus });
          if (active) setFacilities(data.facilities || []);
        }
      } catch (err) {
        if (active) setError(err.message || 'Unable to load campus data.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadTab();
    return () => {
      active = false;
    };
  }, [
    activeTab,
    token,
    noticeCategory,
    examTypeFilter,
    eventFilter,
    dayFilter,
    facultySearch,
    facilityStatus,
    reloadTick,
  ]);

  const profile = dashboardData?.student || user;
  const studentProfileLine = profile
    ? `${profile.department || 'Department'} • Semester ${profile.semester || '-'} • Section ${
        profile.section || 'A'
      } • ID: ${profile.student_id || '-'}`
    : 'Student Workspace';

  const pageMeta = {
    overview: { title: 'Student Dashboard', subtitle: studentProfileLine },
    notices: {
      title: 'Notices & Announcements',
      subtitle: `Published circulars for All & ${profile?.department || 'Your Department'}`,
    },
    exams: {
      title: 'Examination Schedules',
      subtitle: `Published exams for ${studentProfileLine}`,
    },
    results: {
      title: 'Marks & Published Results',
      subtitle: 'Your private, admin-approved academic results',
    },
    events: {
      title: 'Campus Events',
      subtitle: 'Workshops, hackathons, fests, seminars, and placement sessions',
    },
    timetable: { title: 'Class Timetable', subtitle: studentProfileLine },
    faculty: {
      title: 'Faculty Directory',
      subtitle: 'Department contacts, office locations, and consultation hours',
    },
    facilities: {
      title: 'Campus Facilities',
      subtitle: 'Operating hours, locations, and live facility availability',
    },
  };

  const stats = dashboardData?.stats || {
    publishedNotices: 0,
    upcomingEvents: 0,
    weeklyClasses: 0,
    todayClasses: 0,
    openFacilities: 0,
    totalFacilities: 0,
    facultyCount: 0,
    upcomingExams: 0,
    publishedResults: 0,
  };

  const latestNotices = dashboardData?.latestNotices || [];
  const upcomingEvents = dashboardData?.upcomingEvents || [];
  const timetablePreview = dashboardData?.timetablePreview || [];
  const upcomingExams = dashboardData?.upcomingExams || [];
  const recentResults = dashboardData?.recentResults || [];

  return (
    <PortalLayout
      roleLabel="Student Role"
      roleName="Student Portal"
      userLabel={profile?.name || 'Student'}
      userInitials="ST"
      pageTitle={pageMeta[activeTab].title}
      pageSubtitle={pageMeta[activeTab].subtitle}
      navItems={STUDENT_NAV_ITEMS}
      activeItem={activeTab}
      onSelectItem={(tab) => {
        setActiveTab(tab);
        setPage(1);
      }}
      quickSwitch="student"
    >
      {accessNotice && (
        <div
          className="demo-banner"
          style={{
            backgroundColor: 'var(--status-warning-bg)',
            borderColor: '#f5d29c',
            color: 'var(--status-warning-text)',
            justifyContent: 'space-between',
          }}
          role="alert"
        >
          <span>{accessNotice}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setAccessNotice('')}
            aria-label="Dismiss notice"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {error && <ErrorBanner message={error} onRetry={handleRetry} />}

      {/* OVERVIEW */}
      {activeTab === 'overview' &&
        (loading && !dashboardData ? (
          <LoadingState text="Loading your live student dashboard..." />
        ) : (
          <>
            {/* Welcome Banner */}
            <div
              style={{
                background: 'var(--grad-navy)',
                color: '#ffffff',
                borderRadius: '18px',
                padding: '1.65rem 1.85rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1.25rem',
                flexWrap: 'wrap',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <div>
                <span
                  className="badge"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.16)',
                    color: '#dbeafe',
                    marginBottom: '0.55rem',
                  }}
                >
                  {profile?.department} &bull; Semester {profile?.semester} &bull; Section{' '}
                  {profile?.section || 'A'}
                </span>
                <h2 style={{ fontSize: '1.55rem', fontWeight: 800, marginBottom: '0.25rem' }}>
                  Welcome back, {profile?.name || 'Student'}
                </h2>
                <p style={{ fontSize: '0.9rem', color: 'rgba(226,238,255,0.85)' }}>
                  Student ID: {profile?.student_id || '—'} &bull; Track exams, verified results,
                  timetables, and campus events in one place.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-glass btn-sm"
                  onClick={() => setActiveTab('exams')}
                >
                  <FileSpreadsheet size={15} />
                  <span>Exam Schedule</span>
                </button>
                <button
                  type="button"
                  className="btn btn-glass btn-sm"
                  onClick={() => setActiveTab('results')}
                >
                  <Award size={15} />
                  <span>My Results</span>
                </button>
                <Link to="/chatbot" className="btn btn-soft btn-sm">
                  <Bot size={15} />
                  <span>AI Assistant</span>
                </Link>
              </div>
            </div>

            {/* Metric Cards */}
            <div className="stats-grid">
              <div className="stat-card card-3d">
                <div>
                  <div className="stat-label">Upcoming Exams</div>
                  <div className="stat-value">{stats.upcomingExams}</div>
                  <div className="stat-caption">Published schedules</div>
                </div>
                <span className="stat-icon">
                  <FileSpreadsheet size={20} />
                </span>
              </div>

              <div className="stat-card card-3d">
                <div>
                  <div className="stat-label">Published Results</div>
                  <div className="stat-value">{stats.publishedResults}</div>
                  <div className="stat-caption">Verified result sheets</div>
                </div>
                <span className="stat-icon">
                  <Award size={20} />
                </span>
              </div>

              <div className="stat-card card-3d">
                <div>
                  <div className="stat-label">Published Notices</div>
                  <div className="stat-value">{stats.publishedNotices}</div>
                  <div className="stat-caption">All &amp; {profile?.department}</div>
                </div>
                <span className="stat-icon">
                  <Bell size={20} />
                </span>
              </div>

              <div className="stat-card card-3d">
                <div>
                  <div className="stat-label">Upcoming Events</div>
                  <div className="stat-value">{stats.upcomingEvents}</div>
                  <div className="stat-caption">{stats.weeklyClasses} weekly classes</div>
                </div>
                <span className="stat-icon">
                  <Calendar size={20} />
                </span>
              </div>
            </div>

            {/* Quick Access Cards */}
            <div className="quick-links-grid">
              <button
                type="button"
                className="quick-link-card card-3d"
                onClick={() => setActiveTab('exams')}
              >
                <div className="quick-link-left">
                  <span className="quick-link-icon">
                    <FileSpreadsheet size={19} />
                  </span>
                  <div>
                    <div className="quick-link-title">Exam Schedules</div>
                    <div className="quick-link-sub">Dates, timings &amp; rooms</div>
                  </div>
                </div>
                <ArrowRight size={17} color="#6b7d96" />
              </button>

              <button
                type="button"
                className="quick-link-card card-3d"
                onClick={() => setActiveTab('results')}
              >
                <div className="quick-link-left">
                  <span className="quick-link-icon">
                    <Award size={19} />
                  </span>
                  <div>
                    <div className="quick-link-title">Marks &amp; Results</div>
                    <div className="quick-link-sub">Grades &amp; pass status</div>
                  </div>
                </div>
                <ArrowRight size={17} color="#6b7d96" />
              </button>

              <Link to="/chatbot" className="quick-link-card card-3d">
                <div className="quick-link-left">
                  <span className="quick-link-icon">
                    <Bot size={19} />
                  </span>
                  <div>
                    <div className="quick-link-title">AI Campus Assistant</div>
                    <div className="quick-link-sub">Instant campus guidance</div>
                  </div>
                </div>
                <ArrowRight size={17} color="#6b7d96" />
              </Link>
            </div>

            {/* Exams & Results Side by Side */}
            <div className="dashboard-two-col">
              <section className="panel-card">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Upcoming Examinations</h2>
                    <p className="panel-subtitle">Published schedules for your class</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setActiveTab('exams')}
                  >
                    View All
                  </button>
                </div>
                <div className="panel-body">
                  {upcomingExams.length === 0 ? (
                    <EmptyState
                      compact
                      icon={FileSpreadsheet}
                      title="No Published Exam Schedules"
                      description="Published examination dates for your department, semester, and section will appear here."
                    />
                  ) : (
                    <div className="notice-list">
                      {upcomingExams.slice(0, 3).map((ex) => (
                        <article className="notice-item" key={ex.exam_subject_id}>
                          <div className="notice-item-top">
                            <span className="badge badge-info">
                              {EXAM_TYPE_LABELS[ex.exam_type] || ex.exam_type}
                            </span>
                            <span className="notice-date">
                              {formatDisplayDate(ex.exam_date)} &bull; {formatTime(ex.start_time)}
                            </span>
                          </div>
                          <h3>
                            {ex.subject_code} — {ex.subject_name}
                          </h3>
                          <p>
                            {ex.exam_title} &bull; Max Marks: {ex.max_marks}
                            {ex.room ? ` • Room: ${ex.room}` : ''}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="panel-card">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Recently Published Results</h2>
                    <p className="panel-subtitle">Your private, admin-approved results</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setActiveTab('results')}
                  >
                    Full Report
                  </button>
                </div>
                <div className="panel-body">
                  {recentResults.length === 0 ? (
                    <EmptyState
                      compact
                      icon={Award}
                      title="No Published Results Yet"
                      description="Once teachers submit marks and an administrator approves and publishes them, your results will appear here."
                    />
                  ) : (
                    <div className="notice-list">
                      {recentResults.map((r) => (
                        <article className="notice-item" key={r.result_id}>
                          <div className="notice-item-top">
                            <span
                              className={`badge ${
                                r.pass_status === 'pass'
                                  ? 'badge-success'
                                  : 'badge-danger'
                              }`}
                            >
                              {r.pass_status} &bull; Grade {r.grade}
                            </span>
                            <span className="notice-date">{r.percentage}%</span>
                          </div>
                          <h3>{r.exam_title}</h3>
                          <p>
                            Total: {r.total_obtained} / {r.total_max} marks
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Notices & Events with Images */}
            <div className="dashboard-two-col">
              <section className="panel-card">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Latest College Notices</h2>
                    <p className="panel-subtitle">Admin-published announcements</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setActiveTab('notices')}
                  >
                    View All
                  </button>
                </div>
                <div className="panel-body">
                  {latestNotices.length === 0 ? (
                    <EmptyState
                      compact
                      icon={Bell}
                      title="No Published Notices Yet"
                      description="Official notices published for your department or all students will appear here."
                    />
                  ) : (
                    <div className="notice-list">
                      {latestNotices.slice(0, 3).map((notice) => (
                        <article className="notice-item" key={notice.id}>
                          <div className="notice-item-top">
                            <div className="notice-badges">
                              <span
                                className={`badge ${getPriorityBadgeClass(
                                  notice.priority
                                )}`}
                              >
                                {notice.priority}
                              </span>
                              <span className="badge badge-neutral">
                                {notice.category}
                              </span>
                            </div>
                            <span className="notice-date">
                              {formatDisplayDate(notice.published_date)}
                            </span>
                          </div>
                          <h3>{notice.title}</h3>
                          <p>{notice.description}</p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="panel-card">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Upcoming Campus Events</h2>
                    <p className="panel-subtitle">Workshops, fests &amp; seminars</p>
                  </div>
                  <Link to="/events" className="btn btn-ghost btn-sm">
                    Browse All
                  </Link>
                </div>
                <div className="panel-body">
                  {upcomingEvents.length === 0 ? (
                    <EmptyState
                      compact
                      icon={Calendar}
                      title="No Upcoming Events"
                      description="Published campus events will appear here with event images and registration details."
                    />
                  ) : (
                    <div className="event-list">
                      {upcomingEvents.slice(0, 3).map((ev) => (
                        <article
                          className="event-item"
                          key={ev.id}
                          style={{ alignItems: 'center' }}
                        >
                          <img
                            src={ev.image_url || '/images/event-seminar.svg'}
                            alt={ev.title}
                            style={{
                              width: '74px',
                              height: '58px',
                              borderRadius: '10px',
                              objectFit: 'cover',
                              flexShrink: 0,
                            }}
                          />
                          <div className="event-info">
                            <h3>{ev.title}</h3>
                            <div className="event-meta">
                              <span>
                                <Calendar size={13} />
                                {formatDisplayDate(ev.event_date)}
                              </span>
                              <span>
                                <MapPin size={13} />
                                {ev.venue}
                              </span>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Weekly Timetable Preview */}
            <section className="panel-card">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Weekly Timetable Preview</h2>
                  <p className="panel-subtitle">{studentProfileLine}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveTab('timetable')}
                >
                  Full Timetable
                </button>
              </div>
              {timetablePreview.length === 0 ? (
                <div className="panel-body">
                  <EmptyState
                    compact
                    icon={Clock}
                    title="No Published Timetable Yet"
                    description="Published class schedule slots for your department, semester, and section will appear here."
                  />
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="portal-table">
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Time</th>
                        <th>Subject</th>
                        <th>Faculty</th>
                        <th>Classroom</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timetablePreview.map((slot) => (
                        <tr key={slot.id}>
                          <td>
                            <span className="badge badge-info">{slot.day_of_week}</span>
                          </td>
                          <td>
                            {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                          </td>
                          <td>
                            <strong>{slot.subject}</strong>
                          </td>
                          <td>{slot.faculty_name || 'TBA'}</td>
                          <td>{slot.classroom}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ))}

      {/* EXAMS TAB */}
      {activeTab === 'exams' && (
        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Semester Examination Schedule</h2>
              <p className="panel-subtitle">
                Published exams strictly for {profile?.department} &bull; Semester{' '}
                {profile?.semester} &bull; Section {profile?.section || 'A'}
              </p>
            </div>
            <div className="filter-pills">
              {['all', 'internal_1', 'internal_2', 'mid_semester', 'end_semester', 'practical', 'assignment'].map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    className={`filter-pill ${examTypeFilter === t ? 'active' : ''}`}
                    onClick={() => setExamTypeFilter(t)}
                  >
                    {t === 'all' ? 'All Types' : t.replace(/_/g, ' ')}
                  </button>
                )
              )}
            </div>
          </div>
          {loading ? (
            <div className="panel-body">
              <LoadingState text="Loading your examination schedule..." />
            </div>
          ) : exams.length === 0 ? (
            <div className="panel-body">
              <EmptyState
                compact
                icon={FileSpreadsheet}
                title="No Published Examinations Found"
                description="Draft examination schedules remain private until an Administrator publishes them."
              />
            </div>
          ) : (
            <div className="table-wrap">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Examination</th>
                    <th>Type</th>
                    <th>Subject</th>
                    <th>Date &amp; Time</th>
                    <th>Max / Pass</th>
                    <th>Room</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map((ex) => (
                    <tr key={ex.exam_subject_id}>
                      <td>
                        <strong>{ex.exam_title}</strong>
                      </td>
                      <td>
                        <span className="badge badge-info">
                          {EXAM_TYPE_LABELS[ex.exam_type] || ex.exam_type}
                        </span>
                      </td>
                      <td>
                        {ex.subject_code} — {ex.subject_name}
                      </td>
                      <td>
                        {formatDisplayDate(ex.exam_date)} &bull; {formatTime(ex.start_time)} –{' '}
                        {formatTime(ex.end_time)}
                      </td>
                      <td>
                        {ex.max_marks} / {ex.passing_marks}
                      </td>
                      <td>{ex.room || 'TBA'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* RESULTS TAB */}
      {activeTab === 'results' && (
        <>
          {loading ? (
            <LoadingState text="Loading your verified results..." />
          ) : (resultsData.results || []).length === 0 ? (
            <EmptyState
              icon={Award}
              title="No Published Results Available"
              description="Only your own admin-approved and published examination results are displayed here."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {resultsData.results.map((resItem) => (
                <section className="panel-card" key={resItem.result_id}>
                  <div className="panel-header">
                    <div>
                      <h2 className="panel-title">
                        {resItem.exam_title}{' '}
                        {String(resItem.exam_title || '').includes('[DEMO]') && (
                          <span className="badge badge-warning" style={{ marginLeft: '0.4rem' }}>
                            DEMO DATA
                          </span>
                        )}
                      </h2>
                      <p className="panel-subtitle">
                        {EXAM_TYPE_LABELS[resItem.exam_type] || resItem.exam_type} &bull; Published{' '}
                        {formatDisplayDate(resItem.published_at)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className="badge badge-info">
                        Total: {resItem.total_obtained} / {resItem.total_max}
                      </span>
                      <span className="badge badge-info">{resItem.percentage}%</span>
                      <span className="badge badge-neutral">Grade: {resItem.grade}</span>
                      <span
                        className={`badge ${
                          resItem.pass_status === 'pass'
                            ? 'badge-success'
                            : 'badge-danger'
                        }`}
                      >
                        {resItem.pass_status}
                      </span>
                    </div>
                  </div>
                  <div className="table-wrap">
                    <table className="portal-table">
                      <thead>
                        <tr>
                          <th>Subject Code</th>
                          <th>Subject Name</th>
                          <th>Obtained Marks</th>
                          <th>Max Marks</th>
                          <th>Passing Marks</th>
                          <th>Status</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(resItem.subjects || []).map((sub) => (
                          <tr key={sub.subject_code}>
                            <td>
                              <strong>{sub.subject_code}</strong>
                            </td>
                            <td>{sub.subject_name}</td>
                            <td>
                              <strong>{sub.obtained_marks}</strong>
                            </td>
                            <td>{sub.max_marks}</td>
                            <td>{sub.passing_marks}</td>
                            <td>
                              <span
                                className={`badge ${
                                  sub.subject_status === 'pass'
                                    ? 'badge-success'
                                    : 'badge-danger'
                                }`}
                              >
                                {sub.subject_status}
                              </span>
                            </td>
                            <td>{sub.remarks || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {/* NOTICES TAB */}
      {activeTab === 'notices' && (
        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Published Notices</h2>
              <p className="panel-subtitle">Sorted by priority and publication date</p>
            </div>
            <div className="filter-pills">
              {['all', 'exam', 'academic', 'event', 'placement', 'holiday', 'general'].map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`filter-pill ${noticeCategory === cat ? 'active' : ''}`}
                    onClick={() => setNoticeCategory(cat)}
                  >
                    {cat}
                  </button>
                )
              )}
            </div>
          </div>
          <div className="panel-body">
            {loading ? (
              <LoadingState text="Loading published notices..." />
            ) : notices.length === 0 ? (
              <EmptyState
                compact
                icon={Bell}
                title="No Published Notices"
                description="No published notices currently match this category for your department."
              />
            ) : (
              <>
                <div className="notice-list">
                  {notices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((notice) => (
                    <article className="notice-item" key={notice.id}>
                      <div className="notice-item-top">
                        <div className="notice-badges">
                          <span
                            className={`badge ${getPriorityBadgeClass(notice.priority)}`}
                          >
                            {notice.priority}
                          </span>
                          <span className="badge badge-neutral">{notice.category}</span>
                          <span className="badge badge-info">
                            Dept: {notice.target_department}
                          </span>
                          {Boolean(notice.is_demo) && (
                            <span className="badge badge-warning">DEMO DATA</span>
                          )}
                        </div>
                        <span className="notice-date">
                          {formatDisplayDate(notice.published_date)}
                          {notice.posted_by_name ? ` • ${notice.posted_by_name}` : ''}
                        </span>
                      </div>
                      <h3>{notice.title}</h3>
                      <p>{notice.description}</p>
                    </article>
                  ))}
                </div>
                <PaginationBar
                  page={page}
                  totalPages={Math.max(1, Math.ceil(notices.length / PAGE_SIZE))}
                  total={notices.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                />
              </>
            )}
          </div>
        </section>
      )}

      {/* EVENTS TAB */}
      {activeTab === 'events' && (
        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Campus Events</h2>
              <p className="panel-subtitle">Published campus activities &amp; workshops</p>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="filter-pills">
                {['upcoming', 'past', 'all'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`filter-pill ${eventFilter === mode ? 'active' : ''}`}
                    onClick={() => setEventFilter(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <Link to="/events" className="btn btn-soft btn-sm">
                Full Events Gallery
              </Link>
            </div>
          </div>
          <div className="panel-body">
            {loading ? (
              <LoadingState text="Loading campus events..." />
            ) : events.length === 0 ? (
              <EmptyState
                compact
                icon={Calendar}
                title="No Published Events Found"
                description="Published events will appear here with images and registration details."
              />
            ) : (
              <div className="directory-grid">
                {events.map((ev) => (
                  <article
                    className="directory-card card-3d"
                    key={ev.id}
                    style={{ padding: 0, overflow: 'hidden' }}
                  >
                    <img
                      src={ev.image_url || '/images/event-seminar.svg'}
                      alt={ev.title}
                      style={{ width: '100%', height: '145px', objectFit: 'cover' }}
                    />
                    <div style={{ padding: '1.15rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-info">
                          {String(ev.category || 'general').replace(/_/g, ' ')}
                        </span>
                        <span className="badge badge-neutral">{ev.target_department}</span>
                      </div>
                      <h3>{ev.title}</h3>
                      <p className="event-desc">{ev.description}</p>
                      <div className="directory-details">
                        <div className="directory-detail-row">
                          <Clock size={14} />
                          <span>
                            {formatDisplayDate(ev.event_date)} &bull; {formatTime(ev.event_time)}
                          </span>
                        </div>
                        <div className="directory-detail-row">
                          <MapPin size={14} />
                          <span>{ev.venue}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* TIMETABLE TAB */}
      {activeTab === 'timetable' && (
        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Weekly Schedule</h2>
              <p className="panel-subtitle">{studentProfileLine}</p>
            </div>
            <div className="filter-pills">
              {['All', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(
                (day) => (
                  <button
                    key={day}
                    type="button"
                    className={`filter-pill ${dayFilter === day ? 'active' : ''}`}
                    onClick={() => setDayFilter(day)}
                  >
                    {day}
                  </button>
                )
              )}
            </div>
          </div>
          {loading ? (
            <div className="panel-body">
              <LoadingState text="Loading your class timetable..." />
            </div>
          ) : timetable.length === 0 ? (
            <div className="panel-body">
              <EmptyState
                compact
                icon={Clock}
                title="No Published Timetable Slots"
                description="Published timetable entries for your department, semester, and section will appear here."
              />
            </div>
          ) : (
            <div className="table-wrap">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Subject</th>
                    <th>Faculty</th>
                    <th>Classroom</th>
                    <th>Section</th>
                  </tr>
                </thead>
                <tbody>
                  {timetable.map((slot) => (
                    <tr key={slot.id}>
                      <td>
                        <span className="badge badge-info">{slot.day_of_week}</span>
                      </td>
                      <td>
                        {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                      </td>
                      <td>
                        <strong>{slot.subject}</strong>
                      </td>
                      <td>{slot.faculty_name || 'TBA'}</td>
                      <td>{slot.classroom}</td>
                      <td>Sec {slot.section}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* FACULTY TAB */}
      {activeTab === 'faculty' && (
        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Faculty Directory</h2>
              <p className="panel-subtitle">Search by name, department, or office</p>
            </div>
            <div className="student-search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search faculty..."
                value={facultySearch}
                onChange={(e) => setFacultySearch(e.target.value)}
              />
            </div>
          </div>
          <div className="panel-body">
            {loading ? (
              <LoadingState text="Loading faculty directory..." />
            ) : faculty.length === 0 ? (
              <EmptyState
                compact
                icon={Users}
                title="No Faculty Profiles Found"
                description="No faculty entries matched your search."
              />
            ) : (
              <>
              <div className="directory-grid">
                {faculty.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((member) => (
                  <article className="directory-card card-3d" key={member.id}>
                    <div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-info">{member.department}</span>
                        {Boolean(member.is_demo) && (
                          <span className="badge badge-warning">DEMO DATA</span>
                        )}
                      </div>
                      <h3 style={{ marginTop: '0.5rem' }}>{member.name}</h3>
                      <div className="directory-role">{member.designation}</div>
                    </div>
                    <div className="directory-details">
                      <div className="directory-detail-row">
                        <MapPin size={15} />
                        <span>{member.office_location}</span>
                      </div>
                      {member.consultation_hours && (
                        <div className="directory-detail-row">
                          <Clock size={15} />
                          <span>{member.consultation_hours}</span>
                        </div>
                      )}
                      <div className="directory-detail-row">
                        <Mail size={15} />
                        <span>{member.email}</span>
                      </div>
                      {member.phone && (
                        <div className="directory-detail-row">
                          <Phone size={15} />
                          <span>{member.phone}</span>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              <PaginationBar
                page={page}
                totalPages={Math.max(1, Math.ceil(faculty.length / PAGE_SIZE))}
                total={faculty.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
              </>
            )}
          </div>
        </section>
      )}

      {/* FACILITIES TAB */}
      {activeTab === 'facilities' && (
        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Campus Facilities</h2>
              <p className="panel-subtitle">Filter by current availability status</p>
            </div>
            <div className="filter-pills">
              {['all', 'open', 'maintenance', 'closed'].map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`filter-pill ${facilityStatus === st ? 'active' : ''}`}
                  onClick={() => setFacilityStatus(st)}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
          <div className="panel-body">
            {loading ? (
              <LoadingState text="Loading campus facilities..." />
            ) : facilities.length === 0 ? (
              <EmptyState
                compact
                icon={Building2}
                title="No Campus Facilities Found"
                description="No campus facilities match this status."
              />
            ) : (
              <div className="directory-grid">
                {facilities.map((facility) => (
                  <article className="directory-card card-3d" key={facility.id}>
                    <div className="directory-card-top">
                      <div>
                        <span className="badge badge-neutral">{facility.category}</span>
                        <h3 style={{ marginTop: '0.5rem' }}>{facility.name}</h3>
                      </div>
                      <span
                        className={`badge ${getFacilityStatusBadge(facility.status)}`}
                      >
                        {facility.status}
                      </span>
                    </div>
                    <p className="event-desc">{facility.description}</p>
                    <div className="directory-details">
                      <div className="directory-detail-row">
                        <MapPin size={15} />
                        <span>{facility.location}</span>
                      </div>
                      <div className="directory-detail-row">
                        <Clock size={15} />
                        <span>{facility.opening_hours}</span>
                      </div>
                      {facility.contact_info && (
                        <div className="directory-detail-row">
                          <Mail size={15} />
                          <span>{facility.contact_info}</span>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </PortalLayout>
  );
}

export default StudentPortal;
