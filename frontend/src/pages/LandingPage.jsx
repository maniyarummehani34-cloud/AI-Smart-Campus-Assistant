import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  Bell,
  BookOpenCheck,
  Bot,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  GraduationCap,
  MapPin,
  Menu,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { getRoleHomePath } from '../components/ProtectedRoute';
import { useAuth } from '../context/AuthContext';
import { fetchPublicHighlightsApi } from '../services/campusApi';
import './LandingPage.css';

const FEATURES = [
  {
    icon: Bell,
    title: 'Verified Notices & Circulars',
    description:
      'Department-targeted announcements, exam alerts, and academic circulars curated and published by campus administrators.',
    linkLabel: 'Access Student Portal',
    to: '/student',
  },
  {
    icon: Award,
    title: 'Exams, Marks & Official Results',
    description:
      'Semester-wise exam schedules, role-isolated teacher marks entry, admin approval workflow, and private student results.',
    linkLabel: 'Explore Portals',
    to: '/login',
  },
  {
    icon: Calendar,
    title: 'Campus Events & Fests',
    description:
      'Discover technical workshops, hackathons, coding contests, cultural fests, sports meets, and placement drives.',
    linkLabel: 'Browse Campus Events',
    to: '/events',
  },
  {
    icon: Clock,
    title: 'Conflict-Free Timetables',
    description:
      'Department, semester, and section timetables with assigned faculty details and database-enforced conflict prevention.',
    linkLabel: 'View Timetable',
    to: '/student',
  },
  {
    icon: Users,
    title: 'Faculty & Facilities Directory',
    description:
      'Locate faculty offices, consultation hours, library timings, computing labs, and campus services instantly.',
    linkLabel: 'Open Directory',
    to: '/student',
  },
  {
    icon: Bot,
    title: 'AI Campus Assistant',
    description:
      'Conversational helpdesk UI designed to answer everyday student queries using verified university records.',
    linkLabel: 'Open AI Assistant',
    to: '/chatbot',
  },
];

function formatCategoryLabel(cat) {
  return String(cat || 'general').replace(/_/g, ' ');
}

function formatShortDate(dateVal) {
  if (!dateVal) return 'TBD';
  const match = String(dateVal).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(dateVal);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[Number(match[2]) - 1] || ''} ${Number(match[3])}, ${match[1]}`;
}

function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const [highlights, setHighlights] = useState({
    notices: [],
    events: [],
    stats: { departments: 6, faculty: 12, openFacilities: 7, upcomingEvents: 0 },
  });

  useEffect(() => {
    let active = true;
    fetchPublicHighlightsApi()
      .then((data) => {
        if (active && data) setHighlights(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const studentDest =
    isAuthenticated && user?.role === 'student' ? '/student' : '/login?portal=student';
  const teacherDest =
    isAuthenticated && user?.role === 'teacher' ? '/teacher' : '/login?portal=teacher';
  const adminDest =
    isAuthenticated && user?.role === 'admin' ? '/admin' : '/login?portal=admin';

  return (
    <div className="landing-page">
      {/* Top Navigation */}
      <header className="landing-nav">
        <div className="container landing-nav-inner">
          <Link to="/">
            <BrandLogo />
          </Link>

          <nav className="landing-nav-links" aria-label="Primary Navigation">
            <a href="#features">Features</a>
            <a href="#events-preview">Events</a>
            <a href="#notices-preview">Notices</a>
            <a href="#portals">Portals</a>
            <Link to="/events">All Events</Link>
            <Link to="/chatbot">AI Assistant</Link>
          </nav>

          <div className="landing-nav-actions">
            {isAuthenticated && user ? (
              <Link to={getRoleHomePath(user.role)} className="btn btn-primary btn-sm">
                Open {user.role.charAt(0).toUpperCase() + user.role.slice(1)} Dashboard
              </Link>
            ) : (
              <>
                <Link to={studentDest} className="btn btn-primary btn-sm">
                  Student Login
                </Link>
                <Link to={teacherDest} className="btn btn-soft btn-sm">
                  Teacher Login
                </Link>
                <Link to={adminDest} className="btn btn-secondary btn-sm">
                  Admin Login
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="landing-mobile-toggle"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <div className={`landing-mobile-drawer ${mobileMenuOpen ? 'open' : ''}`}>
          <div className="landing-mobile-links">
            <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#events-preview" onClick={() => setMobileMenuOpen(false)}>Events</a>
            <a href="#notices-preview" onClick={() => setMobileMenuOpen(false)}>Notices</a>
            <Link to="/events" onClick={() => setMobileMenuOpen(false)}>Campus Events</Link>
            <Link to="/chatbot" onClick={() => setMobileMenuOpen(false)}>AI Assistant</Link>
          </div>
          <div className="landing-mobile-actions">
            <Link to={studentDest} className="btn btn-primary btn-sm" onClick={() => setMobileMenuOpen(false)}>
              Student Login
            </Link>
            <Link to={teacherDest} className="btn btn-soft btn-sm" onClick={() => setMobileMenuOpen(false)}>
              Teacher Login
            </Link>
            <Link to={adminDest} className="btn btn-secondary btn-sm" onClick={() => setMobileMenuOpen(false)}>
              Admin Login
            </Link>
            <Link to="/register" className="btn btn-ghost btn-sm" onClick={() => setMobileMenuOpen(false)}>
              Student Register
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="container hero-grid">
          <div>
            <span className="hero-pill">
              <Sparkles size={14} />
              <span>AI-Powered Smart Campus Platform</span>
            </span>

            <h1 className="hero-title">
              Your Campus, <span className="hero-title-accent">One Smart Platform</span>
            </h1>

            <p className="hero-description">
              A unified university portal bringing together students, teachers,
              and administrators with verified notices, examination schedules,
              marks approval workflows, timetables, campus events, and AI assistance.
            </p>

            <div className="hero-actions">
              <Link to={studentDest} className="btn btn-primary">
                <GraduationCap size={18} />
                <span>Student Login</span>
              </Link>
              <Link to={teacherDest} className="btn btn-glass">
                <BookOpenCheck size={18} />
                <span>Teacher Login</span>
              </Link>
              <Link to={adminDest} className="btn btn-glass">
                <ShieldCheck size={18} />
                <span>Admin Login</span>
              </Link>
              <Link to="/register" className="btn btn-soft">
                <span>Student Sign Up</span>
              </Link>
            </div>

            <div className="hero-meta-row">
              <span className="hero-meta-item">
                <CheckCircle2 size={16} />
                <span>3 Role-Protected Portals</span>
              </span>
              <span className="hero-meta-item">
                <CheckCircle2 size={16} />
                <span>Exams, Marks &amp; Results Engine</span>
              </span>
              <span className="hero-meta-item">
                <CheckCircle2 size={16} />
                <span>Live MySQL Campus Records</span>
              </span>
            </div>
          </div>

          {/* 3D Glass Floating Stage */}
          <div className="hero-visual-stage">
            <div className="hero-floating-chip top-right">
              <ShieldCheck size={16} color="#1d5bbf" />
              <span>Role-Verified JWT Security</span>
            </div>

            <div className="hero-glass-card">
              <div className="glass-card-head">
                <strong>Live Campus Overview</strong>
                <span className="badge badge-info">MySQL Connected</span>
              </div>

              <div className="glass-mini-grid">
                <div className="glass-metric">
                  <div className="glass-metric-val">{highlights.stats.departments}</div>
                  <div className="glass-metric-lbl">Active Departments</div>
                </div>
                <div className="glass-metric">
                  <div className="glass-metric-val">{highlights.stats.faculty}</div>
                  <div className="glass-metric-lbl">Faculty Profiles</div>
                </div>
                <div className="glass-metric">
                  <div className="glass-metric-val">{highlights.stats.openFacilities}</div>
                  <div className="glass-metric-lbl">Open Facilities</div>
                </div>
                <div className="glass-metric">
                  <div className="glass-metric-val">{highlights.events.length}</div>
                  <div className="glass-metric-lbl">Published Events</div>
                </div>
              </div>

              <div className="glass-role-row">
                <Link to={studentDest} className="glass-role-btn">
                  <GraduationCap size={18} />
                  <span>Student</span>
                </Link>
                <Link to={teacherDest} className="glass-role-btn">
                  <BookOpenCheck size={18} />
                  <span>Teacher</span>
                </Link>
                <Link to={adminDest} className="glass-role-btn">
                  <ShieldCheck size={18} />
                  <span>Admin</span>
                </Link>
              </div>
            </div>

            <div className="hero-floating-chip bottom-left">
              <Award size={16} color="#11663e" />
              <span>Admin-Approved Exam Results</span>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="landing-section" id="features">
        <div className="container">
          <div className="section-heading-row">
            <div className="section-heading-wrap">
              <div className="section-kicker">Platform Modules</div>
              <h2 className="section-heading">
                Built for Modern Academic Operations
              </h2>
              <p className="section-subtext">
                Every core university workflow — from daily timetables and campus
                events to examination schedules and verified results — unified in one place.
              </p>
            </div>
          </div>

          <div className="features-grid">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article className="feature-card card-3d" key={feature.title}>
                  <span className="feature-icon-box" aria-hidden="true">
                    <Icon size={22} />
                  </span>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                  <Link to={feature.to} className="feature-link">
                    <span>{feature.linkLabel}</span>
                    <ArrowRight size={15} />
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Campus Events Preview */}
      <section className="landing-section landing-section-tinted" id="events-preview">
        <div className="container">
          <div className="section-heading-row">
            <div className="section-heading-wrap">
              <div className="section-kicker">Campus Life</div>
              <h2 className="section-heading">Upcoming Campus Events</h2>
              <p className="section-subtext">
                Verified workshops, hackathons, cultural festivals, sports tournaments,
                and career summits published by campus administrators.
              </p>
            </div>
            <Link to="/events" className="btn btn-secondary">
              <span>View All Events</span>
              <ArrowRight size={16} />
            </Link>
          </div>

          {highlights.events.length === 0 ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
              <h3 style={{ color: 'var(--navy-950)', marginBottom: '0.4rem' }}>
                No Published Events Yet
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                Draft demo events are staged in MySQL and remain hidden from public
                view until an Administrator reviews and publishes them in the Admin Portal.
              </p>
            </div>
          ) : (
            <div className="landing-events-grid">
              {highlights.events.slice(0, 3).map((ev) => (
                <article className="landing-event-card card-3d" key={ev.id}>
                  <div className="landing-event-img-wrap">
                    <img
                      src={ev.image_url || '/images/event-seminar.svg'}
                      alt={ev.title}
                    />
                    <span className="landing-event-cat">
                      {formatCategoryLabel(ev.category)}
                    </span>
                  </div>
                  <div className="landing-event-body">
                    <h3>{ev.title}</h3>
                    <p>{ev.description}</p>
                    <div className="landing-event-meta">
                      <span>
                        <Calendar size={14} />
                        {formatShortDate(ev.event_date)}
                      </span>
                      <span>
                        <MapPin size={14} />
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

      {/* Latest Published Notices */}
      <section className="landing-section" id="notices-preview">
        <div className="container">
          <div className="section-heading-row">
            <div className="section-heading-wrap">
              <div className="section-kicker">Official Bulletin</div>
              <h2 className="section-heading">Latest Published Notices</h2>
              <p className="section-subtext">
                Only admin-published announcements appear here. Sign in as a student
                to see department-specific circulars.
              </p>
            </div>
            <Link to={studentDest} className="btn btn-soft">
              <span>Sign In for Full Feed</span>
              <ArrowRight size={16} />
            </Link>
          </div>

          {highlights.notices.length === 0 ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
              <h3 style={{ color: 'var(--navy-950)', marginBottom: '0.4rem' }}>
                No Published Notices Yet
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                Draft notices await administrator verification and publishing.
              </p>
            </div>
          ) : (
            <div className="landing-notices-grid">
              {highlights.notices.map((n) => (
                <article className="landing-notice-card card-3d" key={n.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <span className={`badge ${n.priority === 'urgent' ? 'badge-danger' : n.priority === 'important' ? 'badge-warning' : 'badge-info'}`}>
                        {n.priority}
                      </span>
                      <span className="badge badge-neutral">{n.category}</span>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {formatShortDate(n.published_date)}
                    </span>
                  </div>
                  <h3>{n.title}</h3>
                  <p>{n.description}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Three Role Portals */}
      <section className="landing-section landing-section-tinted" id="portals">
        <div className="container">
          <div className="section-heading-wrap" style={{ marginBottom: '2.2rem' }}>
            <div className="section-kicker">Three Dedicated Workspaces</div>
            <h2 className="section-heading">
              Role-Based Access for Students, Teachers &amp; Admins
            </h2>
          </div>

          <div className="portals-grid-3">
            <div className="portal-showcase-card card-3d">
              <span className="badge badge-info">Student Role</span>
              <h3>Student Portal</h3>
              <p>Personalized view of notices, exams, published results, timetables, and events.</p>
              <ul className="portal-checklist">
                <li><CheckCircle2 size={15} /><span>Semester-wise exam schedules</span></li>
                <li><CheckCircle2 size={15} /><span>Private published marks &amp; grades</span></li>
                <li><CheckCircle2 size={15} /><span>Personal timetable &amp; AI Assistant</span></li>
              </ul>
              <Link to={studentDest} className="btn btn-primary">
                <span>Student Login</span>
                <ArrowRight size={15} />
              </Link>
            </div>

            <div className="portal-showcase-card card-3d">
              <span className="badge badge-success">Teacher Role</span>
              <h3>Teacher Portal</h3>
              <p>Class-isolated marks entry, student rosters, and submission for admin approval.</p>
              <ul className="portal-checklist">
                <li><CheckCircle2 size={15} /><span>Assigned subjects &amp; class lists only</span></li>
                <li><CheckCircle2 size={15} /><span>Validated marks entry &amp; statistics</span></li>
                <li><CheckCircle2 size={15} /><span>Submit marks for admin verification</span></li>
              </ul>
              <Link to={teacherDest} className="btn btn-soft">
                <span>Teacher Login</span>
                <ArrowRight size={15} />
              </Link>
            </div>

            <div className="portal-showcase-card card-3d">
              <span className="badge badge-neutral">Admin Role</span>
              <h3>Admin Console</h3>
              <p>Complete governance over accounts, subjects, exams, approvals, and publication.</p>
              <ul className="portal-checklist">
                <li><CheckCircle2 size={15} /><span>Create teachers &amp; assign subjects</span></li>
                <li><CheckCircle2 size={15} /><span>Approve marks &amp; publish results</span></li>
                <li><CheckCircle2 size={15} /><span>Verify &amp; publish notices and events</span></li>
              </ul>
              <Link to={adminDest} className="btn btn-secondary">
                <span>Admin Login</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-grid">
            <div>
              <BrandLogo light />
              <p className="footer-desc">
                AI-Powered Smart Campus Assistant — a full-stack university
                information, examination, and intelligent student assistance platform.
              </p>
            </div>
            <div>
              <div className="footer-col-title">Portals</div>
              <ul className="footer-links">
                <li><Link to={studentDest}>Student Portal</Link></li>
                <li><Link to={teacherDest}>Teacher Portal</Link></li>
                <li><Link to={adminDest}>Admin Portal</Link></li>
                <li><Link to="/register">Student Registration</Link></li>
              </ul>
            </div>
            <div>
              <div className="footer-col-title">Explore</div>
              <ul className="footer-links">
                <li><Link to="/events">Campus Events</Link></li>
                <li><Link to="/chatbot">AI Campus Assistant</Link></li>
                <li><a href="#features">Platform Features</a></li>
                <li><a href="#notices-preview">Latest Notices</a></li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <span>
              &copy; {new Date().getFullYear()} AI-Powered Smart Campus Assistant &bull; AISD Course Project
            </span>
            <span>React + Vite &bull; Node.js + Express &bull; MySQL (XAMPP)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
