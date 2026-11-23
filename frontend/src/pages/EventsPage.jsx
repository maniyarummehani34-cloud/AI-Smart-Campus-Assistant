import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  GraduationCap,
  MapPin,
  Search,
  Users,
  X,
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import PaginationBar from '../components/PaginationBar';
import PortalLayout from '../components/PortalLayout';
import { useAuth } from '../context/AuthContext';
import { fetchEventsApi, fetchPublicHighlightsApi } from '../services/campusApi';
import './StudentPortal.css';
import './EventsPage.css';

const EVENT_CATEGORIES = [
  { key: 'all', label: 'All Categories' },
  { key: 'technical_workshop', label: 'Technical Workshop' },
  { key: 'hackathon', label: 'Hackathon' },
  { key: 'coding_competition', label: 'Coding Competition' },
  { key: 'cultural', label: 'Cultural' },
  { key: 'sports', label: 'Sports' },
  { key: 'seminar', label: 'Seminar' },
  { key: 'guest_lecture', label: 'Guest Lecture' },
  { key: 'entrepreneurship', label: 'Entrepreneurship' },
  { key: 'placement', label: 'Placement' },
  { key: 'career_guidance', label: 'Career Guidance' },
  { key: 'club', label: 'Club Activities' },
];

const DEPARTMENTS = [
  'all',
  'Computer Science',
  'Information Technology',
  'Electronics & Communication',
  'Mechanical Engineering',
  'Civil Engineering',
  'Artificial Intelligence & Data Science',
];

function formatDate(value) {
  if (!value) return 'TBD';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(value);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[Number(match[2]) - 1] || ''} ${Number(match[3])}, ${match[1]}`;
}

function formatTime(timeStr) {
  if (!timeStr) return '—';
  const parts = String(timeStr).split(':');
  if (parts.length < 2) return timeStr;
  let hr = Number(parts[0]);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  hr = hr % 12 || 12;
  return `${String(hr).padStart(2, '0')}:${parts[1]} ${ampm}`;
}

function EventsPage() {
  const { isAuthenticated, token, user } = useAuth();
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('upcoming');
  const [category, setCategory] = useState('all');
  const [department, setDepartment] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        if (isAuthenticated && token) {
          const data = await fetchEventsApi(token, {
            filter,
            category,
            department,
            search,
          });
          if (active) setEvents(data.events || []);
        } else {
          const data = await fetchPublicHighlightsApi();
          let list = data.events || [];
          if (category !== 'all') {
            list = list.filter((e) => e.category === category);
          }
          if (department !== 'all') {
            list = list.filter(
              (e) =>
                e.target_department === 'All' ||
                e.target_department === department
            );
          }
          if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(
              (e) =>
                e.title.toLowerCase().includes(q) ||
                e.description.toLowerCase().includes(q) ||
                e.venue.toLowerCase().includes(q)
            );
          }
          if (active) setEvents(list);
        }
      } catch {
        if (active) setEvents([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [isAuthenticated, token, filter, category, department, search]);

  const content = (
    <>
      <div className="events-hero-band">
        <div>
          <h2>Campus Events &amp; Student Activities</h2>
          <p>
            Explore admin-verified technical workshops, hackathons, coding
            contests, cultural festivals, sports meets, seminars, and placement
            sessions across all departments.
          </p>
        </div>
        <span className="badge badge-info" style={{ fontSize: '0.82rem', padding: '0.35rem 0.85rem' }}>
          {events.length} Published Event{events.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="events-controls-card">
        <div className="events-controls-top">
          <div className="filter-pills">
            {['upcoming', 'past', 'all'].map((mode) => (
              <button
                key={mode}
                type="button"
                className={`filter-pill ${filter === mode ? 'active' : ''}`}
                onClick={() => setFilter(mode)}
              >
                {mode}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              className="form-input"
              style={{ width: 'auto', padding: '0.45rem 0.75rem', fontSize: '0.86rem' }}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              aria-label="Filter by department"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d === 'all' ? 'All Departments' : d}
                </option>
              ))}
            </select>

            <div className="student-search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search events or venues..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="filter-pills">
          {EVENT_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              className={`filter-pill ${category === cat.key ? 'active' : ''}`}
              onClick={() => setCategory(cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="portal-state-card">
          <div className="portal-spinner" />
          <p>Loading campus events...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="portal-state-card">
          <span className="portal-state-icon">
            <Calendar size={22} />
          </span>
          <h3>No Published Events Match Your Filters</h3>
          <p>
            Draft demo events are staged in the Admin Portal and appear here
            immediately once verified and published by an Administrator.
          </p>
        </div>
      ) : (
        <>
        <div className="events-rich-grid">
          {events.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((ev) => (
            <article className="rich-event-card card-3d" key={ev.id}>
              <div className="rich-event-media">
                <img
                  src={ev.image_url || '/images/event-seminar.svg'}
                  alt={ev.title}
                />
                <div className="rich-event-badges">
                  <span className="rich-event-pill">
                    {String(ev.category || 'general').replace(/_/g, ' ')}
                  </span>
                  {Boolean(ev.is_demo) && (
                    <span className="badge badge-warning">DEMO DATA</span>
                  )}
                </div>
              </div>

              <div className="rich-event-content">
                <h3>{ev.title}</h3>
                <p>{ev.description}</p>

                <div className="rich-event-meta">
                  <div className="rich-event-meta-row">
                    <Calendar size={14} />
                    <span>
                      {formatDate(ev.event_date)} &bull; {formatTime(ev.event_time)}
                    </span>
                  </div>
                  <div className="rich-event-meta-row">
                    <MapPin size={14} />
                    <span>{ev.venue}</span>
                  </div>
                  <div className="rich-event-meta-row">
                    <GraduationCap size={14} />
                    <span>
                      {ev.target_department} &bull; {ev.semester_eligibility || 'All Semesters'}
                    </span>
                  </div>
                  <div className="rich-event-meta-row">
                    <Users size={14} />
                    <span>Organized by {ev.organizer}</span>
                  </div>
                </div>
              </div>

              <div className="rich-event-footer">
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {ev.registration_details || 'Open campus event'}
                </span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setSelectedEvent(ev)}
                >
                  <span>Register Info</span>
                  <ExternalLink size={13} />
                </button>
              </div>
            </article>
          ))}
        </div>
        <div className="card" style={{ marginTop: '1.25rem', overflow: 'hidden' }}>
          <PaginationBar
            page={page}
            totalPages={Math.max(1, Math.ceil(events.length / PAGE_SIZE))}
            total={events.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
        </>
      )}

      {selectedEvent && (
        <div className="modal-backdrop" onClick={() => setSelectedEvent(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedEvent.title}</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedEvent(null)}
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.92rem' }}>
              {selectedEvent.description}
            </p>
            <div className="rich-event-meta" style={{ marginBottom: '1.2rem' }}>
              <div className="rich-event-meta-row">
                <Clock size={15} />
                <span>
                  {formatDate(selectedEvent.event_date)} at {formatTime(selectedEvent.event_time)}
                </span>
              </div>
              <div className="rich-event-meta-row">
                <MapPin size={15} />
                <span>{selectedEvent.venue}</span>
              </div>
              <div className="rich-event-meta-row">
                <GraduationCap size={15} />
                <span>
                  Eligibility: {selectedEvent.target_department} ({selectedEvent.semester_eligibility})
                </span>
              </div>
            </div>
            <div className="demo-banner" style={{ marginBottom: '1rem' }}>
              <span>
                <strong>Registration Details:</strong>{' '}
                {selectedEvent.registration_details || 'Contact event organizer on campus.'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setSelectedEvent(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (isAuthenticated && user) {
    return (
      <PortalLayout
        roleLabel="Campus Activities"
        roleName="Events Directory"
        userLabel={user.name}
        userInitials="EV"
        pageTitle="Campus Events"
        pageSubtitle="Verified workshops, hackathons, cultural fests, and academic seminars"
        navItems={[{ id: 'events', label: 'All Campus Events', icon: Calendar }]}
        activeItem="events"
        quickSwitch="events"
      >
        {content}
      </PortalLayout>
    );
  }

  return (
    <div className="auth-page">
      <header className="auth-header">
        <div className="container auth-header-inner">
          <Link to="/">
            <BrandLogo />
          </Link>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <Link to="/login" className="btn btn-primary btn-sm">Sign In</Link>
            <Link to="/" className="btn btn-ghost btn-sm">
              <ArrowLeft size={15} />
              <span>Home</span>
            </Link>
          </div>
        </div>
      </header>
      <main className="container" style={{ padding: '2rem 1.5rem 3rem' }}>
        {content}
      </main>
    </div>
  );
}

export default EventsPage;
