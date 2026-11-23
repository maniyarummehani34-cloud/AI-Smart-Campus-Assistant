import { useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardEdit,
  Clock,
  LayoutDashboard,
  Save,
  Send,
  Users,
  X,
} from 'lucide-react';
import PortalLayout from '../components/PortalLayout';
import { useAuth } from '../context/AuthContext';
import { fetchEventsApi, fetchNoticesApi } from '../services/campusApi';
import {
  fetchAssignedStudentsApi,
  fetchExamSubjectMarksApi,
  fetchTeacherAssignmentsApi,
  fetchTeacherDashboardApi,
  fetchTeacherExamsApi,
  fetchTeacherPerformanceApi,
  fetchTeacherTimetableApi,
  saveTeacherMarkApi,
  submitExamSubjectMarksApi,
} from '../services/teacherApi';
import './StudentPortal.css';
import './TeacherPortal.css';

const TEACHER_NAV_ITEMS = [
  { id: 'overview', label: 'Teacher Dashboard', icon: LayoutDashboard },
  { id: 'classes', label: 'Assigned Classes', icon: BookOpen },
  { id: 'marks', label: 'Marks Entry', icon: ClipboardEdit },
  { id: 'performance', label: 'Student Performance', icon: BarChart3 },
  { id: 'timetable', label: 'My Timetable', icon: Clock },
  { id: 'notices', label: 'Announcements', icon: Bell },
  { id: 'events', label: 'Campus Events', icon: Calendar },
];

function TeacherPortal() {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Teacher data
  const [dashboard, setDashboard] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [classStudents, setClassStudents] = useState([]);
  const [examSubjects, setExamSubjects] = useState([]);
  const [selectedExamSubjectId, setSelectedExamSubjectId] = useState('');
  const [marksSheet, setMarksSheet] = useState(null);
  const [draftInputs, setDraftInputs] = useState({});
  const [performance, setPerformance] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [notices, setNotices] = useState([]);
  const [events, setEvents] = useState([]);

  const showFeedback = (type, text) => setFeedback({ type, text });

  useEffect(() => {
    if (!token) return;
    let active = true;

    async function loadTab() {
      setLoading(true);
      try {
        if (activeTab === 'overview') {
          const data = await fetchTeacherDashboardApi(token);
          if (active) setDashboard(data);
        } else if (activeTab === 'classes') {
          const data = await fetchTeacherAssignmentsApi(token);
          if (active) setAssignments(data.assignments || []);
        } else if (activeTab === 'marks') {
          const data = await fetchTeacherExamsApi(token);
          const list = data.examSubjects || [];
          if (active) {
            setExamSubjects(list);
            if (!selectedExamSubjectId && list.length > 0) {
              setSelectedExamSubjectId(String(list[0].exam_subject_id));
            }
          }
        } else if (activeTab === 'performance') {
          const data = await fetchTeacherPerformanceApi(token);
          if (active) setPerformance(data.performance || []);
        } else if (activeTab === 'timetable') {
          const data = await fetchTeacherTimetableApi(token);
          if (active) setTimetable(data.timetable || []);
        } else if (activeTab === 'notices') {
          const data = await fetchNoticesApi(token);
          if (active) setNotices(data.notices || []);
        } else if (activeTab === 'events') {
          const data = await fetchEventsApi(token, { filter: 'upcoming' });
          if (active) setEvents(data.events || []);
        }
      } catch (err) {
        if (active) showFeedback('error', err.message || 'Unable to load teacher data.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadTab();
    return () => {
      active = false;
    };
  }, [activeTab, token]);

  // Load marks roster whenever selectedExamSubjectId changes
  useEffect(() => {
    if (!token || activeTab !== 'marks' || !selectedExamSubjectId) return;
    let active = true;

    async function loadSheet() {
      try {
        const data = await fetchExamSubjectMarksApi(token, selectedExamSubjectId);
        if (active) {
          setMarksSheet(data);
          const nextInputs = {};
          for (const row of data.roster || []) {
            nextInputs[row.student_user_id] = {
              marks:
                row.obtained_marks !== null && row.obtained_marks !== undefined
                  ? String(row.obtained_marks)
                  : '',
              remarks: row.remarks || '',
            };
          }
          setDraftInputs(nextInputs);
        }
      } catch (err) {
        if (active) showFeedback('error', err.message || 'Unable to load marks sheet.');
      }
    }

    loadSheet();
    return () => {
      active = false;
    };
  }, [activeTab, selectedExamSubjectId, token]);

  const handleViewRoster = async (assignment) => {
    try {
      const data = await fetchAssignedStudentsApi(token, assignment.id);
      setSelectedAssignment(data.assignment);
      setClassStudents(data.students || []);
    } catch (err) {
      showFeedback('error', err.message);
    }
  };

  const handleSaveMark = async (studentUserId) => {
    const entry = draftInputs[studentUserId];
    if (!entry || entry.marks === '') {
      showFeedback('error', 'Please enter obtained marks before saving.');
      return;
    }

    const maxMarks = Number(marksSheet?.examSubject?.max_marks || 0);
    const val = Number(entry.marks);
    if (Number.isNaN(val) || val < 0 || val > maxMarks) {
      showFeedback(
        'error',
        `Marks must be a valid number between 0 and ${maxMarks}.`
      );
      return;
    }

    try {
      await saveTeacherMarkApi(token, {
        exam_subject_id: Number(selectedExamSubjectId),
        student_id: studentUserId,
        obtained_marks: val,
        remarks: entry.remarks,
      });
      showFeedback('success', 'Marks saved as draft successfully.');
      const refreshed = await fetchExamSubjectMarksApi(token, selectedExamSubjectId);
      setMarksSheet(refreshed);
    } catch (err) {
      showFeedback('error', err.message);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!selectedExamSubjectId) return;
    try {
      const res = await submitExamSubjectMarksApi(token, selectedExamSubjectId);
      showFeedback('success', res.message);
      const refreshed = await fetchExamSubjectMarksApi(token, selectedExamSubjectId);
      setMarksSheet(refreshed);
    } catch (err) {
      showFeedback('error', err.message);
    }
  };

  const stats = dashboard?.stats || {
    assignedSubjects: 0,
    assignedClasses: 0,
    pendingSubmissions: 0,
    submittedForApproval: 0,
    approvedMarks: 0,
    upcomingAssessments: 0,
    averagePercentage: null,
  };

  return (
    <PortalLayout
      roleLabel="Faculty Workspace"
      roleName="Teacher Portal"
      userLabel={user?.name || 'Teacher'}
      userInitials="TR"
      pageTitle="Teacher Portal"
      pageSubtitle={`${user?.department || 'Faculty'} • Employee ID: ${user?.employee_id || '—'}`}
      navItems={TEACHER_NAV_ITEMS}
      activeItem={activeTab}
      onSelectItem={setActiveTab}
      quickSwitch="teacher"
    >
      {feedback.text && (
        <div className={`teacher-feedback-bar ${feedback.type}`} role="status">
          <span>{feedback.text}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setFeedback({ type: '', text: '' })}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* TEACHER DASHBOARD OVERVIEW */}
      {activeTab === 'overview' && (
        <>
          <div className="teacher-hero">
            <div>
              <h2>Welcome, {user?.name || 'Teacher'}</h2>
              <p>
                Manage your assigned classes, enter validated assessment marks,
                track student performance, and submit marks for administrator approval.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => setActiveTab('marks')}
            >
              <ClipboardEdit size={17} />
              <span>Quick Marks Entry</span>
            </button>
          </div>

          <div className="stats-grid">
            <div className="stat-card card-3d">
              <div>
                <div className="stat-label">Assigned Subjects</div>
                <div className="stat-value">{stats.assignedSubjects}</div>
                <div className="stat-caption">{stats.assignedClasses} active classes</div>
              </div>
              <span className="stat-icon">
                <BookOpen size={20} />
              </span>
            </div>

            <div className="stat-card card-3d">
              <div>
                <div className="stat-label">Pending Submissions</div>
                <div className="stat-value">{stats.pendingSubmissions}</div>
                <div className="stat-caption">Draft / needs revision</div>
              </div>
              <span className="stat-icon">
                <ClipboardEdit size={20} />
              </span>
            </div>

            <div className="stat-card card-3d">
              <div>
                <div className="stat-label">Upcoming Assessments</div>
                <div className="stat-value">{stats.upcomingAssessments}</div>
                <div className="stat-caption">Published exam papers</div>
              </div>
              <span className="stat-icon">
                <Calendar size={20} />
              </span>
            </div>

            <div className="stat-card card-3d">
              <div>
                <div className="stat-label">Avg Performance</div>
                <div className="stat-value">
                  {stats.averagePercentage !== null ? `${stats.averagePercentage}%` : '—'}
                </div>
                <div className="stat-caption">{stats.approvedMarks} approved entries</div>
              </div>
              <span className="stat-icon">
                <BarChart3 size={20} />
              </span>
            </div>
          </div>

          <div className="dashboard-two-col">
            <section className="panel-card">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Your Assigned Subjects</h2>
                  <p className="panel-subtitle">Strictly isolated to your assignments</p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setActiveTab('classes')}
                >
                  View Rosters
                </button>
              </div>
              <div className="table-wrap">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Class</th>
                      <th>Students</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dashboard?.assignments || []).length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          No subjects assigned yet. Contact your Administrator.
                        </td>
                      </tr>
                    ) : (
                      dashboard.assignments.map((a) => (
                        <tr key={a.id}>
                          <td>
                            <strong>{a.subject_code}</strong> — {a.subject_name}
                          </td>
                          <td>
                            {a.department} &bull; Sem {a.semester}-{a.section}
                          </td>
                          <td>{a.student_count}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel-card">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Assigned Assessments</h2>
                  <p className="panel-subtitle">Published exams ready for marks entry</p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setActiveTab('marks')}
                >
                  Enter Marks
                </button>
              </div>
              <div className="panel-body">
                {(dashboard?.upcomingAssessments || []).length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    No published assessments currently match your assigned subjects.
                  </p>
                ) : (
                  <div className="notice-list">
                    {dashboard.upcomingAssessments.slice(0, 4).map((ex) => (
                      <div className="notice-item" key={ex.exam_subject_id}>
                        <div className="notice-item-top">
                          <span className="badge badge-info">{ex.subject_code}</span>
                          <span className="notice-date">Max {ex.max_marks} marks</span>
                        </div>
                        <h3>{ex.exam_title}</h3>
                        <p>
                          {ex.subject_name} &bull; {ex.department} Sem {ex.semester}-{ex.section}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}

      {/* ASSIGNED CLASSES & ROSTERS */}
      {activeTab === 'classes' && (
        <div className="dashboard-two-col">
          <section className="panel-card">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Assigned Subjects &amp; Classes</h2>
                <p className="panel-subtitle">Click a class to view enrolled students</p>
              </div>
            </div>
            <div className="panel-body">
              {loading ? (
                <div className="portal-spinner" />
              ) : assignments.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>
                  No active teaching assignments found.
                </p>
              ) : (
                <div className="notice-list">
                  {assignments.map((a) => (
                    <div className="notice-item" key={a.id}>
                      <div className="notice-item-top">
                        <span className="badge badge-info">{a.subject_code}</span>
                        <span className="badge badge-neutral">{a.student_count} Students</span>
                      </div>
                      <h3>{a.subject_name}</h3>
                      <p style={{ marginBottom: '0.65rem' }}>
                        {a.department} &bull; Semester {a.semester} &bull; Section {a.section}
                      </p>
                      <button
                        type="button"
                        className="btn btn-soft btn-sm"
                        onClick={() => handleViewRoster(a)}
                      >
                        <Users size={14} />
                        <span>View Student List</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="panel-card">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">
                  {selectedAssignment
                    ? `${selectedAssignment.subject_code} Student Roster`
                    : 'Class Roster'}
                </h2>
                <p className="panel-subtitle">
                  {selectedAssignment
                    ? `${selectedAssignment.department} • Sem ${selectedAssignment.semester}-${selectedAssignment.section}`
                    : 'Select an assigned subject on the left'}
                </p>
              </div>
            </div>
            <div className="table-wrap">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Full Name</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {classStudents.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        {selectedAssignment
                          ? 'No active students enrolled in this class yet.'
                          : 'Choose an assigned class to view its students.'}
                      </td>
                    </tr>
                  ) : (
                    classStudents.map((st) => (
                      <tr key={st.id}>
                        <td>
                          <strong>{st.student_id}</strong>
                        </td>
                        <td>{st.name}</td>
                        <td>{st.email}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* MARKS ENTRY & SUBMISSION WORKSPACE */}
      {activeTab === 'marks' && (
        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Marks Entry &amp; Admin Submission</h2>
              <p className="panel-subtitle">
                Enter validated marks (0 to Max) and submit for Admin approval. Teachers cannot publish results directly.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                className="form-input"
                style={{ width: 'auto', minWidth: '280px', padding: '0.45rem 0.75rem' }}
                value={selectedExamSubjectId}
                onChange={(e) => setSelectedExamSubjectId(e.target.value)}
              >
                {examSubjects.length === 0 && (
                  <option value="">No published assigned assessments</option>
                )}
                {examSubjects.map((es) => (
                  <option key={es.exam_subject_id} value={es.exam_subject_id}>
                    {es.exam_title} — {es.subject_code} ({es.department} S{es.semester}-{es.section})
                  </option>
                ))}
              </select>

              {selectedExamSubjectId && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleSubmitForApproval}
                >
                  <Send size={14} />
                  <span>Submit All Drafts to Admin</span>
                </button>
              )}
            </div>
          </div>

          {marksSheet ? (
            <div className="table-wrap">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Student Name</th>
                    <th>Max Marks</th>
                    <th>Obtained Marks</th>
                    <th>Remarks</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(marksSheet.roster || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No active students found in {marksSheet.examSubject.department} Sem{' '}
                        {marksSheet.examSubject.semester}-{marksSheet.examSubject.section}.
                      </td>
                    </tr>
                  ) : (
                    marksSheet.roster.map((row) => {
                      const locked =
                        row.submission_status === 'approved' ||
                        row.result_publish_status === 'published';
                      const cur = draftInputs[row.student_user_id] || { marks: '', remarks: '' };
                      return (
                        <tr key={row.student_user_id}>
                          <td>
                            <strong>{row.roll_number}</strong>
                          </td>
                          <td>{row.student_name}</td>
                          <td>{marksSheet.examSubject.max_marks}</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max={marksSheet.examSubject.max_marks}
                              step="0.5"
                              className="marks-input"
                              disabled={locked}
                              value={cur.marks}
                              onChange={(e) =>
                                setDraftInputs((prev) => ({
                                  ...prev,
                                  [row.student_user_id]: {
                                    ...cur,
                                    marks: e.target.value,
                                  },
                                }))
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="remarks-input"
                              disabled={locked}
                              placeholder="Optional remarks"
                              value={cur.remarks}
                              onChange={(e) =>
                                setDraftInputs((prev) => ({
                                  ...prev,
                                  [row.student_user_id]: {
                                    ...cur,
                                    remarks: e.target.value,
                                  },
                                }))
                              }
                            />
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                row.submission_status === 'approved'
                                  ? 'badge-success'
                                  : row.submission_status === 'submitted'
                                  ? 'badge-info'
                                  : row.submission_status === 'rejected'
                                  ? 'badge-danger'
                                  : 'badge-neutral'
                              }`}
                            >
                              {row.submission_status || 'not entered'}
                            </span>
                          </td>
                          <td>
                            {locked ? (
                              <span style={{ fontSize: '0.78rem', color: 'var(--status-success-text)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <CheckCircle2 size={14} /> Locked
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-soft btn-sm"
                                onClick={() => handleSaveMark(row.student_user_id)}
                              >
                                <Save size={14} />
                                <span>Save Draft</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="panel-body">
              <p style={{ color: 'var(--text-muted)' }}>
                Select a published examination assigned to you to enter marks.
              </p>
            </div>
          )}
        </section>
      )}

      {/* PERFORMANCE STATISTICS */}
      {activeTab === 'performance' && (
        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Assigned Class Performance Summary</h2>
              <p className="panel-subtitle">Statistics across your assigned subjects only</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Examination</th>
                  <th>Subject</th>
                  <th>Class</th>
                  <th>Graded</th>
                  <th>Average</th>
                  <th>Highest / Lowest</th>
                  <th>Passed</th>
                </tr>
              </thead>
              <tbody>
                {performance.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No performance data yet.
                    </td>
                  </tr>
                ) : (
                  performance.map((p) => (
                    <tr key={p.exam_subject_id}>
                      <td><strong>{p.exam_title}</strong></td>
                      <td>{p.subject_code} — {p.subject_name}</td>
                      <td>{p.department} S{p.semester}-{p.section}</td>
                      <td>{p.graded_count}</td>
                      <td>{p.avg_marks !== null ? `${p.avg_marks} / ${p.max_marks}` : '—'}</td>
                      <td>
                        {p.highest_marks !== null
                          ? `${p.highest_marks} / ${p.lowest_marks}`
                          : '—'}
                      </td>
                      <td>{p.pass_count || 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TEACHER TIMETABLE */}
      {activeTab === 'timetable' && (
        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">My Teaching Timetable</h2>
              <p className="panel-subtitle">Published schedule for your classes</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Time</th>
                  <th>Subject</th>
                  <th>Class</th>
                  <th>Classroom</th>
                </tr>
              </thead>
              <tbody>
                {timetable.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No published timetable slots linked to your assignments yet.
                    </td>
                  </tr>
                ) : (
                  timetable.map((slot) => (
                    <tr key={slot.id}>
                      <td><span className="badge badge-info">{slot.day_of_week}</span></td>
                      <td>{slot.start_time} – {slot.end_time}</td>
                      <td><strong>{slot.subject}</strong></td>
                      <td>{slot.department} S{slot.semester}-{slot.section}</td>
                      <td>{slot.classroom}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* NOTICES */}
      {activeTab === 'notices' && (
        <section className="panel-card">
          <div className="panel-header">
            <h2 className="panel-title">Published Campus Notices</h2>
          </div>
          <div className="panel-body">
            {notices.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No published notices right now.</p>
            ) : (
              <div className="notice-list">
                {notices.map((n) => (
                  <article className="notice-item" key={n.id}>
                    <div className="notice-item-top">
                      <span className="badge badge-info">{n.category}</span>
                      <span className="notice-date">{String(n.published_date).slice(0, 10)}</span>
                    </div>
                    <h3>{n.title}</h3>
                    <p>{n.description}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* EVENTS */}
      {activeTab === 'events' && (
        <section className="panel-card">
          <div className="panel-header">
            <h2 className="panel-title">Upcoming Campus Events</h2>
          </div>
          <div className="panel-body">
            {events.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No upcoming published events right now.</p>
            ) : (
              <div className="directory-grid">
                {events.map((ev) => (
                  <article className="directory-card" key={ev.id}>
                    <span className="badge badge-info">{String(ev.category || 'general').replace(/_/g, ' ')}</span>
                    <h3>{ev.title}</h3>
                    <p className="event-desc">{ev.description}</p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {String(ev.event_date).slice(0, 10)} &bull; {ev.venue}
                    </p>
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

export default TeacherPortal;
