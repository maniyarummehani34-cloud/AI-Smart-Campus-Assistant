import { useEffect, useState } from 'react';
import {
  Award,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileSpreadsheet,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import PortalLayout from '../components/PortalLayout';
import PaginationBar from '../components/PaginationBar';
import { useAuth } from '../context/AuthContext';
import {
  approveAllExamMarksApi,
  createAdminAssignmentApi,
  createAdminDepartmentApi,
  createAdminEventApi,
  createAdminExamApi,
  createAdminFacilityApi,
  createAdminFacultyApi,
  createAdminNoticeApi,
  createAdminSubjectApi,
  createAdminTimetableApi,
  createAdminUserApi,
  deleteAdminAssignmentApi,
  deleteAdminEventApi,
  deleteAdminExamApi,
  deleteAdminFacilityApi,
  deleteAdminFacultyApi,
  deleteAdminNoticeApi,
  deleteAdminTimetableApi,
  fetchAdminAssignmentsApi,
  fetchAdminDashboardApi,
  fetchAdminDepartmentsApi,
  fetchAdminEventsApi,
  fetchAdminExamsApi,
  fetchAdminFacilitiesApi,
  fetchAdminFacultyApi,
  fetchAdminMarksSubmissionsApi,
  fetchAdminNoticesApi,
  fetchAdminResultsApi,
  fetchAdminSubjectsApi,
  fetchAdminTimetableApi,
  fetchAdminUsersApi,
  publishExamResultsApi,
  publishVerifiedDemoContentApi,
  reviewAdminMarkApi,
  updateAdminEventStatusApi,
  updateAdminExamStatusApi,
  updateAdminFacilityStatusApi,
  updateAdminNoticeStatusApi,
  updateAdminSubjectStatusApi,
  updateAdminTimetableStatusApi,
  updateAdminUserStatusApi,
} from '../services/adminApi';
import './StudentPortal.css';
import './AdminPortal.css';

const ADMIN_NAV_ITEMS = [
  { id: 'overview', label: 'Admin Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Students & Teachers', icon: Users },
  { id: 'assignments', label: 'Teacher Assignments', icon: BookOpen },
  { id: 'exams', label: 'Examinations', icon: FileSpreadsheet },
  { id: 'approvals', label: 'Marks & Results', icon: ClipboardCheck },
  { id: 'notices', label: 'Notices', icon: Bell },
  { id: 'events', label: 'Events', icon: Calendar },
  { id: 'academics', label: 'Depts & Subjects', icon: Layers },
  { id: 'timetable', label: 'Timetable', icon: Clock },
  { id: 'facilities', label: 'Faculty & Facilities', icon: Building2 },
];

function AdminPortal() {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [reloadTick, setReloadTick] = useState(0);
  const [toast, setToast] = useState({ type: 'info', text: '' });
  const [modal, setModal] = useState('');

  // Live data states
  const [dashboard, setDashboard] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [usersMeta, setUsersMeta] = useState({ total: 0, page: 1, totalPages: 1, limit: 25 });
  const [userFilters, setUserFilters] = useState({ role: 'all', department: 'all', search: '', page: 1 });
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [exams, setExams] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [subMeta, setSubMeta] = useState({ total: 0, page: 1, totalPages: 1, limit: 25 });
  const [subFilters, setSubFilters] = useState({ status: 'all', search: '', page: 1 });
  const [results, setResults] = useState([]);
  const [resMeta, setResMeta] = useState({ total: 0, page: 1, totalPages: 1, limit: 25 });
  const [resFilters, setResFilters] = useState({ pass_status: 'all', search: '', page: 1 });
  const [notices, setNotices] = useState([]);
  const [events, setEvents] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [listSearch, setListSearch] = useState('');
  const [listPage, setListPage] = useState(1);
  const CLIENT_PAGE_SIZE = 20;

  // Reusable modal form state
  const [form, setForm] = useState({});

  const refresh = () => setReloadTick((p) => p + 1);
  const showToast = (text, type = 'info') => setToast({ type, text });

  useEffect(() => {
    if (!token) return;
    let active = true;

    async function load() {
      try {
        if (activeTab === 'overview') {
          const d = await fetchAdminDashboardApi(token);
          if (active) setDashboard(d);
        } else if (activeTab === 'users') {
          const [u, d] = await Promise.all([
            fetchAdminUsersApi(token, { ...userFilters, limit: 25 }),
            fetchAdminDepartmentsApi(token),
          ]);
          if (active) {
            setUsersList(u.users || []);
            setUsersMeta({
              total: u.total || 0,
              page: u.page || 1,
              totalPages: u.totalPages || 1,
              limit: u.limit || 25,
            });
            setDepartments(d.departments || []);
          }
        } else if (activeTab === 'assignments') {
          const [a, u, s] = await Promise.all([
            fetchAdminAssignmentsApi(token),
            fetchAdminUsersApi(token, { role: 'teacher', limit: 200 }),
            fetchAdminSubjectsApi(token),
          ]);
          if (active) {
            setAssignments(a.assignments || []);
            setUsersList(u.users || []);
            setSubjects(s.subjects || []);
          }
        } else if (activeTab === 'exams') {
          const [ex, s, d] = await Promise.all([
            fetchAdminExamsApi(token),
            fetchAdminSubjectsApi(token),
            fetchAdminDepartmentsApi(token),
          ]);
          if (active) {
            setExams(ex.exams || []);
            setSubjects(s.subjects || []);
            setDepartments(d.departments || []);
          }
        } else if (activeTab === 'approvals') {
          const [m, r, ex] = await Promise.all([
            fetchAdminMarksSubmissionsApi(token, { ...subFilters, limit: 25 }),
            fetchAdminResultsApi(token, { ...resFilters, limit: 25 }),
            fetchAdminExamsApi(token),
          ]);
          if (active) {
            setSubmissions(m.submissions || []);
            setSubMeta({
              total: m.total || 0,
              page: m.page || 1,
              totalPages: m.totalPages || 1,
              limit: m.limit || 25,
            });
            setResults(r.results || []);
            setResMeta({
              total: r.total || 0,
              page: r.page || 1,
              totalPages: r.totalPages || 1,
              limit: r.limit || 25,
            });
            setExams(ex.exams || []);
          }
        } else if (activeTab === 'notices') {
          const [n, d] = await Promise.all([
            fetchAdminNoticesApi(token),
            fetchAdminDepartmentsApi(token),
          ]);
          if (active) {
            setNotices(n.notices || []);
            setDepartments(d.departments || []);
          }
        } else if (activeTab === 'events') {
          const [ev, d] = await Promise.all([
            fetchAdminEventsApi(token),
            fetchAdminDepartmentsApi(token),
          ]);
          if (active) {
            setEvents(ev.events || []);
            setDepartments(d.departments || []);
          }
        } else if (activeTab === 'academics') {
          const [d, s] = await Promise.all([
            fetchAdminDepartmentsApi(token),
            fetchAdminSubjectsApi(token),
          ]);
          if (active) {
            setDepartments(d.departments || []);
            setSubjects(s.subjects || []);
          }
        } else if (activeTab === 'timetable') {
          const [t, f, d] = await Promise.all([
            fetchAdminTimetableApi(token),
            fetchAdminFacultyApi(token),
            fetchAdminDepartmentsApi(token),
          ]);
          if (active) {
            setTimetable(t.timetable || []);
            setFaculty(f.faculty || []);
            setDepartments(d.departments || []);
          }
        } else if (activeTab === 'facilities') {
          const [f, fac, d] = await Promise.all([
            fetchAdminFacultyApi(token),
            fetchAdminFacilitiesApi(token),
            fetchAdminDepartmentsApi(token),
          ]);
          if (active) {
            setFaculty(f.faculty || []);
            setFacilities(fac.facilities || []);
            setDepartments(d.departments || []);
          }
        }
      } catch (err) {
        if (active) showToast(err.message || 'Failed to load admin data.', 'error');
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [activeTab, token, reloadTick, userFilters, subFilters, resFilters]);

  const handleTabSelect = (tabId) => {
    setActiveTab(tabId);
    setListSearch('');
    setListPage(1);
  };

  const openModal = (name, defaults = {}) => {
    setForm(defaults);
    setModal(name);
  };

  const handleAction = async (fn, successMsg) => {
    try {
      const res = await fn();
      showToast(res?.message || successMsg || 'Saved successfully.', 'info');
      setModal('');
      refresh();
    } catch (err) {
      showToast(err.message || 'Operation failed.', 'error');
    }
  };

  const stats = dashboard?.stats || {};
  const draftTotal =
    (stats.draftNotices || 0) + (stats.draftEvents || 0) + (stats.draftExams || 0);
  const deptBars = dashboard?.charts?.studentsByDepartment || [];
  const maxDeptCount = Math.max(1, ...deptBars.map((d) => Number(d.student_count || 0)));
  const wf = dashboard?.charts?.marksWorkflow || { draft: 0, submitted: 0, approved: 0, rejected: 0 };
  const maxWf = Math.max(1, wf.draft, wf.submitted, wf.approved, wf.rejected);

  return (
    <PortalLayout
      roleLabel="Campus Governance"
      roleName="Admin Portal"
      userLabel={user?.name || 'Administrator'}
      userInitials="AD"
      pageTitle="Admin Management Console"
      pageSubtitle="Full control over users, teachers, examinations, marks approvals, notices, and events"
      navItems={ADMIN_NAV_ITEMS}
      activeItem={activeTab}
      onSelectItem={handleTabSelect}
      quickSwitch="admin"
    >
      {toast.text && (
        <div
          className={`admin-action-toast ${toast.type === 'error' ? 'error' : ''}`}
          role="status"
        >
          <span>{toast.text}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setToast({ type: 'info', text: '' })}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* OVERVIEW & ANALYTICS */}
      {activeTab === 'overview' && (
        <>
          {draftTotal > 0 && (
            <div className="admin-draft-banner">
              <div>
                <strong style={{ color: 'var(--navy-950)', fontSize: '0.96rem' }}>
                  DEMO / DRAFT Campus Content Pending Verification
                </strong>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  {stats.draftNotices || 0} draft notices, {stats.draftEvents || 0} draft events, and{' '}
                  {stats.draftExams || 0} draft exam schedules are currently hidden from students.
                  Inspect them individually or publish verified records below.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() =>
                  handleAction(
                    () => publishVerifiedDemoContentApi(token, 'all'),
                    'Verified draft campus content published!'
                  )
                }
              >
                <CheckCircle2 size={15} />
                <span>Verify &amp; Publish All Draft Content</span>
              </button>
            </div>
          )}

          <div className="admin-stats-grid">
            <div className="stat-card card-3d">
              <div>
                <div className="stat-label">Total Students</div>
                <div className="stat-value">{stats.totalStudents || 0}</div>
                <div className="stat-caption">Registered student accounts</div>
              </div>
              <span className="stat-icon"><GraduationCap size={20} /></span>
            </div>

            <div className="stat-card card-3d">
              <div>
                <div className="stat-label">Total Teachers</div>
                <div className="stat-value">{stats.totalTeachers || 0}</div>
                <div className="stat-caption">Admin-provisioned faculty</div>
              </div>
              <span className="stat-icon"><BookOpen size={20} /></span>
            </div>

            <div className="stat-card card-3d">
              <div>
                <div className="stat-label">Departments</div>
                <div className="stat-value">{stats.totalDepartments || 0}</div>
                <div className="stat-caption">Active academic departments</div>
              </div>
              <span className="stat-icon"><Layers size={20} /></span>
            </div>

            <div className="stat-card card-3d">
              <div>
                <div className="stat-label">Pending Marks Approvals</div>
                <div className="stat-value">{stats.pendingMarksApprovals || 0}</div>
                <div className="stat-caption">{stats.approvedMarks || 0} approved marks</div>
              </div>
              <span className="stat-icon"><ClipboardCheck size={20} /></span>
            </div>

            <div className="stat-card card-3d">
              <div>
                <div className="stat-label">Published Notices</div>
                <div className="stat-value">{stats.publishedNotices || 0}</div>
                <div className="stat-caption">{stats.draftNotices || 0} drafts awaiting review</div>
              </div>
              <span className="stat-icon"><Bell size={20} /></span>
            </div>

            <div className="stat-card card-3d">
              <div>
                <div className="stat-label">Upcoming Events</div>
                <div className="stat-value">{stats.upcomingEvents || 0}</div>
                <div className="stat-caption">{stats.draftEvents || 0} draft events</div>
              </div>
              <span className="stat-icon"><Calendar size={20} /></span>
            </div>

            <div className="stat-card card-3d">
              <div>
                <div className="stat-label">Published Exams</div>
                <div className="stat-value">{stats.upcomingExams || 0}</div>
                <div className="stat-caption">{stats.draftExams || 0} draft schedules</div>
              </div>
              <span className="stat-icon"><FileSpreadsheet size={20} /></span>
            </div>

            <div className="stat-card card-3d">
              <div>
                <div className="stat-label">Pass Threshold</div>
                <div className="stat-value">
                  {dashboard?.gradingRules?.passPercentage ?? 40}%
                </div>
                <div className="stat-caption">Configurable grading rule</div>
              </div>
              <span className="stat-icon"><Award size={20} /></span>
            </div>
          </div>

          <div className="admin-charts-grid">
            <section className="panel-card">
              <div className="panel-header">
                <h2 className="panel-title">Students by Department</h2>
              </div>
              <div className="panel-body">
                {deptBars.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>No students registered yet.</p>
                ) : (
                  <div className="bar-chart-list">
                    {deptBars.map((row) => (
                      <div className="bar-chart-row" key={row.department}>
                        <div className="bar-chart-head">
                          <span>{row.department}</span>
                          <span>{row.student_count}</span>
                        </div>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{
                              width: `${Math.max(
                                8,
                                (Number(row.student_count) / maxDeptCount) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="panel-card">
              <div className="panel-header">
                <h2 className="panel-title">Marks Approval Pipeline</h2>
                <button
                  type="button"
                  className="btn btn-soft btn-sm"
                  onClick={() => setActiveTab('approvals')}
                >
                  Open Approvals
                </button>
              </div>
              <div className="panel-body">
                <div className="bar-chart-list">
                  {[
                    { label: 'Draft (Teacher Working)', val: wf.draft },
                    { label: 'Submitted (Awaiting Admin)', val: wf.submitted },
                    { label: 'Approved (Ready for Results)', val: wf.approved },
                    { label: 'Rejected (Returned to Teacher)', val: wf.rejected },
                  ].map((item) => (
                    <div className="bar-chart-row" key={item.label}>
                      <div className="bar-chart-head">
                        <span>{item.label}</span>
                        <span>{item.val}</span>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${item.val === 0 ? 0 : Math.max(8, (item.val / maxWf) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </>
      )}

      {/* USERS: STUDENTS & TEACHERS */}
      {activeTab === 'users' && (
        <section className="panel-card">
          <div className="admin-toolbar">
            <div>
              <h2 className="panel-title">User Accounts ({usersMeta.total})</h2>
              <p className="panel-subtitle">Search &amp; filter Students, Teachers, and Admins (DEMO accounts clearly labeled)</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="admin-search-box">
                <Search size={15} />
                <input
                  type="text"
                  placeholder="Search name, email, ID..."
                  value={userFilters.search}
                  onChange={(e) => setUserFilters((p) => ({ ...p, search: e.target.value, page: 1 }))}
                />
              </div>
              <select
                className="form-input"
                style={{ width: 'auto', padding: '0.42rem 0.7rem', fontSize: '0.84rem' }}
                value={userFilters.role}
                onChange={(e) => setUserFilters((p) => ({ ...p, role: e.target.value, page: 1 }))}
              >
                <option value="all">All Roles</option>
                <option value="student">Students</option>
                <option value="teacher">Teachers</option>
                <option value="admin">Admins</option>
              </select>
              <select
                className="form-input"
                style={{ width: 'auto', padding: '0.42rem 0.7rem', fontSize: '0.84rem' }}
                value={userFilters.department}
                onChange={(e) => setUserFilters((p) => ({ ...p, department: e.target.value, page: 1 }))}
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() =>
                  openModal('createUser', {
                    role: 'teacher',
                    department: departments[0]?.name || 'Computer Science',
                  })
                }
              >
                <UserPlus size={15} />
                <span>Create Teacher</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  openModal('createUser', {
                    role: 'student',
                    department: departments[0]?.name || 'Computer Science',
                    semester: 1,
                    section: 'A',
                  })
                }
              >
                <Plus size={15} />
                <span>Create Student</span>
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>ID</th>
                  <th>Department / Class</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.name}</strong>
                      {String(u.email || '').endsWith('@smartcampus.demo') && (
                        <span className="badge badge-warning" style={{ marginLeft: '0.4rem' }}>
                          DEMO DATA
                        </span>
                      )}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-danger' : u.role === 'teacher' ? 'badge-success' : 'badge-info'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>{u.student_id || u.employee_id || '—'}</td>
                    <td>
                      {u.department
                        ? `${u.department}${u.semester ? ` • S${u.semester}-${u.section || 'A'}` : ''}`
                        : '—'}
                    </td>
                    <td>
                      <span className={`badge ${u.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td>
                      {u.id !== user?.id && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            handleAction(
                              () =>
                                updateAdminUserStatusApi(
                                  token,
                                  u.id,
                                  u.status === 'active' ? 'suspended' : 'active'
                                ),
                              'User status updated.'
                            )
                          }
                        >
                          {u.status === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={usersMeta.page}
            totalPages={usersMeta.totalPages}
            total={usersMeta.total}
            pageSize={usersMeta.limit}
            onPageChange={(nextPage) => setUserFilters((p) => ({ ...p, page: nextPage }))}
          />
        </section>
      )}

      {/* TEACHER ASSIGNMENTS */}
      {activeTab === 'assignments' && (
        <section className="panel-card">
          <div className="admin-toolbar">
            <div>
              <h2 className="panel-title">Teacher Subject Assignments</h2>
              <p className="panel-subtitle">Controls which classes each teacher can access and grade</p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() =>
                openModal('createAssignment', {
                  teacher_id: usersList[0]?.id || '',
                  subject_id: subjects[0]?.id || '',
                  department: subjects[0]?.department || 'Computer Science',
                  semester: subjects[0]?.semester || 5,
                  section: 'A',
                })
              }
            >
              <Plus size={15} />
              <span>Assign Teacher</span>
            </button>
          </div>
          <div className="table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Subject</th>
                  <th>Department</th>
                  <th>Semester / Sec</th>
                  <th>Year</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No teacher assignments yet. Create a teacher account first, then assign subjects here.
                    </td>
                  </tr>
                ) : (
                  assignments.map((a) => (
                    <tr key={a.id}>
                      <td><strong>{a.teacher_name}</strong></td>
                      <td>{a.subject_code} — {a.subject_name}</td>
                      <td>{a.department}</td>
                      <td>Sem {a.semester} - Sec {a.section}</td>
                      <td>{a.academic_year}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger-ghost btn-sm"
                          onClick={() =>
                            handleAction(
                              () => deleteAdminAssignmentApi(token, a.id),
                              'Assignment removed.'
                            )
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* EXAMINATIONS */}
      {activeTab === 'exams' && (() => {
        const filteredExams = exams.filter((ex) =>
          !listSearch.trim()
            ? true
            : `${ex.title} ${ex.department} ${ex.exam_type}`.toLowerCase().includes(listSearch.trim().toLowerCase())
        );
        const totalExamPages = Math.max(1, Math.ceil(filteredExams.length / CLIENT_PAGE_SIZE));
        const pagedExams = filteredExams.slice((listPage - 1) * CLIENT_PAGE_SIZE, listPage * CLIENT_PAGE_SIZE);
        return (
        <section className="panel-card">
          <div className="admin-toolbar">
            <div>
              <h2 className="panel-title">Examination Schedules ({filteredExams.length})</h2>
              <p className="panel-subtitle">Create, search, publish, or archive exam schedules</p>
            </div>
            <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="admin-search-box">
                <Search size={15} />
                <input
                  type="text"
                  placeholder="Search exams or department..."
                  value={listSearch}
                  onChange={(e) => { setListSearch(e.target.value); setListPage(1); }}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() =>
                  openModal('createExam', {
                    exam_type: 'internal_1',
                    department: departments[0]?.name || 'Computer Science',
                    semester: 5,
                    section: 'A',
                    status: 'published',
                    subject_id: subjects[0]?.id || '',
                    max_marks: 50,
                    passing_marks: 20,
                    start_time: '10:00',
                    end_time: '11:30',
                  })
                }
              >
                <Plus size={15} />
                <span>Create Examination</span>
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Class</th>
                  <th>Papers</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedExams.map((ex) => (
                  <tr key={ex.id}>
                    <td>
                      <strong>{ex.title}</strong>
                      {Boolean(ex.is_demo) && (
                        <span className="badge badge-warning" style={{ marginLeft: '0.45rem' }}>
                          DEMO DATA
                        </span>
                      )}
                    </td>
                    <td>{String(ex.exam_type).replace(/_/g, ' ')}</td>
                    <td>{ex.department} S{ex.semester}-{ex.section}</td>
                    <td>{(ex.subjects || []).length}</td>
                    <td>
                      <span className={`badge ${ex.status === 'published' ? 'badge-success' : ex.status === 'draft' ? 'badge-warning' : 'badge-neutral'}`}>
                        {ex.status}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        {ex.status !== 'published' && (
                          <button
                            type="button"
                            className="btn btn-soft btn-sm"
                            onClick={() =>
                              handleAction(
                                () => updateAdminExamStatusApi(token, ex.id, 'published'),
                                'Exam published.'
                              )
                            }
                          >
                            Publish
                          </button>
                        )}
                        {ex.status !== 'archived' && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              handleAction(
                                () => updateAdminExamStatusApi(token, ex.id, 'archived'),
                                'Exam archived.'
                              )
                            }
                          >
                            Archive
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-danger-ghost btn-sm"
                          onClick={() =>
                            handleAction(() => deleteAdminExamApi(token, ex.id), 'Exam deleted.')
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={listPage}
            totalPages={totalExamPages}
            total={filteredExams.length}
            pageSize={CLIENT_PAGE_SIZE}
            onPageChange={setListPage}
          />
        </section>
        );
      })()}

      {/* MARKS APPROVALS & RESULTS PUBLICATION */}
      {activeTab === 'approvals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <section className="panel-card">
            <div className="admin-toolbar">
              <div>
                <h2 className="panel-title">Marks Submissions ({subMeta.total})</h2>
                <p className="panel-subtitle">Approve submitted marks, then publish official results</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="admin-search-box">
                  <Search size={15} />
                  <input
                    type="text"
                    placeholder="Search student, ID, exam..."
                    value={subFilters.search}
                    onChange={(e) => setSubFilters((p) => ({ ...p, search: e.target.value, page: 1 }))}
                  />
                </div>
                <select
                  className="form-input"
                  style={{ width: 'auto', padding: '0.42rem 0.7rem', fontSize: '0.84rem' }}
                  value={subFilters.status}
                  onChange={(e) => setSubFilters((p) => ({ ...p, status: e.target.value, page: 1 }))}
                >
                  <option value="all">All Statuses</option>
                  <option value="submitted">Submitted (Pending)</option>
                  <option value="approved">Approved</option>
                  <option value="draft">Draft</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
            <div className="table-wrap">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Exam &amp; Subject</th>
                    <th>Marks</th>
                    <th>Teacher</th>
                    <th>Status</th>
                    <th>Review Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No marks match this filter.
                      </td>
                    </tr>
                  ) : (
                    submissions.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <strong>{m.student_name}</strong> ({m.roll_number})
                          {Boolean(m.is_demo) && (
                            <span className="badge badge-warning" style={{ marginLeft: '0.4rem' }}>DEMO DATA</span>
                          )}
                        </td>
                        <td>
                          {m.exam_title} &bull; {m.subject_code}
                        </td>
                        <td>
                          <strong>{m.obtained_marks}</strong> / {m.max_marks}
                        </td>
                        <td>{m.teacher_name || '—'}</td>
                        <td>
                          <span
                            className={`badge ${
                              m.submission_status === 'approved'
                                ? 'badge-success'
                                : m.submission_status === 'submitted'
                                ? 'badge-info'
                                : m.submission_status === 'rejected'
                                ? 'badge-danger'
                                : 'badge-neutral'
                            }`}
                          >
                            {m.submission_status}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            {m.submission_status !== 'approved' && (
                              <button
                                type="button"
                                className="btn btn-soft btn-sm"
                                onClick={() =>
                                  handleAction(() =>
                                    reviewAdminMarkApi(token, m.id, 'approve')
                                  )
                                }
                              >
                                Approve
                              </button>
                            )}
                            {m.submission_status === 'submitted' && (
                              <button
                                type="button"
                                className="btn btn-danger-ghost btn-sm"
                                onClick={() =>
                                  handleAction(() =>
                                    reviewAdminMarkApi(
                                      token,
                                      m.id,
                                      'reject',
                                      'Please verify entered marks.'
                                    )
                                  )
                                }
                              >
                                Reject
                              </button>
                            )}
                            {m.submission_status === 'approved' && m.publish_status !== 'published' && (
                              <button
                                type="button"
                                className="btn btn-success btn-sm"
                                onClick={() =>
                                  handleAction(() =>
                                    publishExamResultsApi(token, m.exam_id)
                                  )
                                }
                              >
                                Publish Exam Results
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <PaginationBar
              page={subMeta.page}
              totalPages={subMeta.totalPages}
              total={subMeta.total}
              pageSize={subMeta.limit}
              onPageChange={(nextPage) => setSubFilters((p) => ({ ...p, page: nextPage }))}
            />
          </section>

          <section className="panel-card">
            <div className="admin-toolbar">
              <div>
                <h2 className="panel-title">Published Results Ledger ({resMeta.total})</h2>
                <p className="panel-subtitle">Search published student results &amp; filter Pass/Fail</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="admin-search-box">
                  <Search size={15} />
                  <input
                    type="text"
                    placeholder="Search student, ID, exam..."
                    value={resFilters.search}
                    onChange={(e) => setResFilters((p) => ({ ...p, search: e.target.value, page: 1 }))}
                  />
                </div>
                <select
                  className="form-input"
                  style={{ width: 'auto', padding: '0.42rem 0.7rem', fontSize: '0.84rem' }}
                  value={resFilters.pass_status}
                  onChange={(e) => setResFilters((p) => ({ ...p, pass_status: e.target.value, page: 1 }))}
                >
                  <option value="all">Pass &amp; Fail</option>
                  <option value="pass">Pass Only</option>
                  <option value="fail">Fail Only</option>
                </select>
              </div>
            </div>
            <div className="table-wrap">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Examination</th>
                    <th>Total</th>
                    <th>Percentage</th>
                    <th>Grade</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {results.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No results match this filter.
                      </td>
                    </tr>
                  ) : (
                    results.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <strong>{r.student_name}</strong> ({r.roll_number})
                          {Boolean(r.is_demo) && (
                            <span className="badge badge-warning" style={{ marginLeft: '0.4rem' }}>DEMO DATA</span>
                          )}
                        </td>
                        <td>{r.exam_title}</td>
                        <td>{r.total_obtained} / {r.total_max}</td>
                        <td>{r.percentage}%</td>
                        <td><strong>{r.grade}</strong></td>
                        <td>
                          <span className={`badge ${r.pass_status === 'pass' ? 'badge-success' : 'badge-danger'}`}>
                            {r.pass_status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <PaginationBar
              page={resMeta.page}
              totalPages={resMeta.totalPages}
              total={resMeta.total}
              pageSize={resMeta.limit}
              onPageChange={(nextPage) => setResFilters((p) => ({ ...p, page: nextPage }))}
            />
          </section>
        </div>
      )}

      {/* NOTICES */}
      {activeTab === 'notices' && (
        <section className="panel-card">
          <div className="admin-toolbar">
            <div>
              <h2 className="panel-title">Notices &amp; Circulars</h2>
              <p className="panel-subtitle">Approve, publish, archive, or create notices</p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() =>
                openModal('createNotice', {
                  category: 'academic',
                  target_department: 'All',
                  priority: 'normal',
                  status: 'published',
                })
              }
            >
              <Plus size={15} />
              <span>Create Notice</span>
            </button>
          </div>
          <div className="table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Dept</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {notices.map((n) => (
                  <tr key={n.id}>
                    <td>
                      <strong>{n.title}</strong>
                      {Boolean(n.is_demo) && (
                        <span className="badge badge-warning" style={{ marginLeft: '0.4rem' }}>DEMO</span>
                      )}
                    </td>
                    <td>{n.target_department}</td>
                    <td><span className="badge badge-info">{n.priority}</span></td>
                    <td>
                      <span className={`badge ${n.status === 'published' ? 'badge-success' : n.status === 'draft' ? 'badge-warning' : 'badge-neutral'}`}>
                        {n.status}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        {n.status !== 'published' && (
                          <button
                            type="button"
                            className="btn btn-soft btn-sm"
                            onClick={() => handleAction(() => updateAdminNoticeStatusApi(token, n.id, 'published'))}
                          >
                            Publish
                          </button>
                        )}
                        {n.status !== 'archived' && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleAction(() => updateAdminNoticeStatusApi(token, n.id, 'archived'))}
                          >
                            Archive
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-danger-ghost btn-sm"
                          onClick={() => handleAction(() => deleteAdminNoticeApi(token, n.id))}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* EVENTS */}
      {activeTab === 'events' && (
        <section className="panel-card">
          <div className="admin-toolbar">
            <div>
              <h2 className="panel-title">Campus Events</h2>
              <p className="panel-subtitle">Review drafts, publish, or add new campus events</p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() =>
                openModal('createEvent', {
                  category: 'technical_workshop',
                  target_department: 'All',
                  semester_eligibility: 'All Semesters',
                  status: 'published',
                  image_url: '/images/event-tech-workshop.svg',
                })
              }
            >
              <Plus size={15} />
              <span>Create Event</span>
            </button>
          </div>
          <div className="table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Event Title</th>
                  <th>Category</th>
                  <th>Date &amp; Venue</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td>
                      <strong>{ev.title}</strong>
                      {Boolean(ev.is_demo) && (
                        <span className="badge badge-warning" style={{ marginLeft: '0.4rem' }}>DEMO</span>
                      )}
                    </td>
                    <td>{String(ev.category || 'general').replace(/_/g, ' ')}</td>
                    <td>{String(ev.event_date).slice(0, 10)} &bull; {ev.venue}</td>
                    <td>
                      <span className={`badge ${ev.status === 'published' ? 'badge-success' : ev.status === 'draft' ? 'badge-warning' : 'badge-neutral'}`}>
                        {ev.status}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        {ev.status !== 'published' && (
                          <button
                            type="button"
                            className="btn btn-soft btn-sm"
                            onClick={() => handleAction(() => updateAdminEventStatusApi(token, ev.id, 'published'))}
                          >
                            Publish
                          </button>
                        )}
                        {ev.status !== 'archived' && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleAction(() => updateAdminEventStatusApi(token, ev.id, 'archived'))}
                          >
                            Archive
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-danger-ghost btn-sm"
                          onClick={() => handleAction(() => deleteAdminEventApi(token, ev.id))}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* DEPARTMENTS & SUBJECTS */}
      {activeTab === 'academics' && (
        <div className="dashboard-two-col">
          <section className="panel-card">
            <div className="admin-toolbar">
              <h2 className="panel-title">Departments ({departments.length})</h2>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => openModal('createDept', {})}
              >
                <Plus size={14} /> Add Dept
              </button>
            </div>
            <div className="table-wrap">
              <table className="portal-table">
                <thead>
                  <tr><th>Code</th><th>Name</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {departments.map((d) => (
                    <tr key={d.id}>
                      <td><strong>{d.code}</strong></td>
                      <td>{d.name}</td>
                      <td><span className="badge badge-success">{d.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel-card">
            <div className="admin-toolbar">
              <h2 className="panel-title">Subjects ({subjects.length})</h2>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() =>
                  openModal('createSubject', {
                    department_id: departments[0]?.id || '',
                    semester: 5,
                    credits: 4,
                  })
                }
              >
                <Plus size={14} /> Add Subject
              </button>
            </div>
            <div className="table-wrap">
              <table className="portal-table">
                <thead>
                  <tr><th>Code</th><th>Subject</th><th>Sem</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {subjects.slice(0, 20).map((s) => (
                    <tr key={s.id}>
                      <td><strong>{s.code}</strong></td>
                      <td>{s.name}</td>
                      <td>S{s.semester}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            handleAction(() =>
                              updateAdminSubjectStatusApi(
                                token,
                                s.id,
                                s.status === 'published' ? 'archived' : 'published'
                              )
                            )
                          }
                        >
                          <span className={`badge ${s.status === 'published' ? 'badge-success' : 'badge-warning'}`}>
                            {s.status}
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TIMETABLE */}
      {activeTab === 'timetable' && (
        <section className="panel-card">
          <div className="admin-toolbar">
            <h2 className="panel-title">Timetable Slots ({timetable.length})</h2>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() =>
                openModal('createTimetable', {
                  department: departments[0]?.name || 'Computer Science',
                  semester: 5,
                  section: 'A',
                  day_of_week: 'Monday',
                  start_time: '09:00',
                  end_time: '10:00',
                  status: 'published',
                })
              }
            >
              <Plus size={15} /> Add Slot
            </button>
          </div>
          <div className="table-wrap">
            <table className="portal-table">
              <thead>
                <tr><th>Day &amp; Time</th><th>Class</th><th>Subject</th><th>Room</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {timetable.slice(0, 30).map((t) => (
                  <tr key={t.id}>
                    <td>{t.day_of_week} &bull; {t.start_time}-{t.end_time}</td>
                    <td>{t.department} S{t.semester}-{t.section}</td>
                    <td><strong>{t.subject}</strong></td>
                    <td>{t.classroom}</td>
                    <td><span className={`badge ${t.status === 'published' ? 'badge-success' : 'badge-warning'}`}>{t.status}</span></td>
                    <td>
                      <div className="table-actions">
                        {t.status !== 'published' && (
                          <button type="button" className="btn btn-soft btn-sm" onClick={() => handleAction(() => updateAdminTimetableStatusApi(token, t.id, 'published'))}>
                            Publish
                          </button>
                        )}
                        <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => handleAction(() => deleteAdminTimetableApi(token, t.id))}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* FACULTY & FACILITIES */}
      {activeTab === 'facilities' && (
        <div className="dashboard-two-col">
          <section className="panel-card">
            <div className="admin-toolbar">
              <h2 className="panel-title">Faculty Directory ({faculty.length})</h2>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => openModal('createFaculty', { department: departments[0]?.name || 'Computer Science' })}
              >
                <Plus size={14} /> Add Faculty
              </button>
            </div>
            <div className="table-wrap">
              <table className="portal-table">
                <thead>
                  <tr><th>Name</th><th>Department</th><th>Office</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {faculty.map((f) => (
                    <tr key={f.id}>
                      <td><strong>{f.name}</strong></td>
                      <td>{f.department}</td>
                      <td>{f.office_location}</td>
                      <td>
                        <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => handleAction(() => deleteAdminFacultyApi(token, f.id))}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel-card">
            <div className="admin-toolbar">
              <h2 className="panel-title">Campus Facilities ({facilities.length})</h2>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => openModal('createFacility', { category: 'lab', status: 'open' })}
              >
                <Plus size={14} /> Add Facility
              </button>
            </div>
            <div className="table-wrap">
              <table className="portal-table">
                <thead>
                  <tr><th>Facility</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {facilities.map((fc) => (
                    <tr key={fc.id}>
                      <td><strong>{fc.name}</strong></td>
                      <td><span className={`badge ${fc.status === 'open' ? 'badge-success' : 'badge-warning'}`}>{fc.status}</span></td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              handleAction(() =>
                                updateAdminFacilityStatusApi(
                                  token,
                                  fc.id,
                                  fc.status === 'open' ? 'maintenance' : 'open'
                                )
                              )
                            }
                          >
                            Toggle
                          </button>
                          <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => handleAction(() => deleteAdminFacilityApi(token, fc.id))}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* REUSABLE ADMIN MODALS */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal('')}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {modal === 'createUser' && `Create ${form.role === 'teacher' ? 'Teacher' : 'Student'} Account`}
                {modal === 'createAssignment' && 'Assign Teacher to Subject'}
                {modal === 'createExam' && 'Create Examination Schedule'}
                {modal === 'createNotice' && 'Create Official Notice'}
                {modal === 'createEvent' && 'Create Campus Event'}
                {modal === 'createDept' && 'Add Academic Department'}
                {modal === 'createSubject' && 'Add Academic Subject'}
                {modal === 'createTimetable' && 'Add Timetable Slot'}
                {modal === 'createFaculty' && 'Add Faculty Member'}
                {modal === 'createFacility' && 'Add Campus Facility'}
              </h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal('')}>
                <X size={16} />
              </button>
            </div>

            <form
              className="admin-form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                if (modal === 'createUser') {
                  handleAction(() => createAdminUserApi(token, form));
                } else if (modal === 'createAssignment') {
                  handleAction(() => createAdminAssignmentApi(token, form));
                } else if (modal === 'createExam') {
                  const payload = {
                    title: form.title,
                    exam_type: form.exam_type,
                    department: form.department,
                    semester: Number(form.semester),
                    section: form.section || 'A',
                    instructions: form.instructions,
                    status: form.status || 'published',
                    subjects: form.subject_id
                      ? [
                          {
                            subject_id: Number(form.subject_id),
                            exam_date: form.exam_date,
                            start_time: `${form.start_time}:00`,
                            end_time: `${form.end_time}:00`,
                            max_marks: Number(form.max_marks),
                            passing_marks: Number(form.passing_marks),
                            room: form.room,
                          },
                        ]
                      : [],
                  };
                  handleAction(() => createAdminExamApi(token, payload));
                } else if (modal === 'createNotice') {
                  handleAction(() => createAdminNoticeApi(token, form));
                } else if (modal === 'createEvent') {
                  handleAction(() => createAdminEventApi(token, form));
                } else if (modal === 'createDept') {
                  handleAction(() => createAdminDepartmentApi(token, form));
                } else if (modal === 'createSubject') {
                  handleAction(() => createAdminSubjectApi(token, form));
                } else if (modal === 'createTimetable') {
                  handleAction(() => createAdminTimetableApi(token, form));
                } else if (modal === 'createFaculty') {
                  handleAction(() => createAdminFacultyApi(token, form));
                } else if (modal === 'createFacility') {
                  handleAction(() => createAdminFacilityApi(token, form));
                }
              }}
            >
              {modal === 'createUser' && (
                <>
                  <div className="form-field admin-form-full">
                    <label>Full Name</label>
                    <input className="form-input" required onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Email</label>
                    <input type="email" className="form-input" required onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Temporary Password (min 8)</label>
                    <input type="password" className="form-input" required minLength={8} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Department</label>
                    <select className="form-input" value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                      {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                  </div>
                  {form.role === 'teacher' ? (
                    <div className="form-field">
                      <label>Employee ID</label>
                      <input className="form-input" placeholder="e.g., EMP-CS-01" onChange={(e) => setForm({ ...form, employee_id: e.target.value })} />
                    </div>
                  ) : (
                    <>
                      <div className="form-field">
                        <label>Student ID</label>
                        <input className="form-input" required onChange={(e) => setForm({ ...form, student_id: e.target.value })} />
                      </div>
                      <div className="form-field">
                        <label>Semester</label>
                        <input type="number" min={1} max={8} className="form-input" value={form.semester || 1} onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })} />
                      </div>
                      <div className="form-field">
                        <label>Section</label>
                        <input className="form-input" value={form.section || 'A'} onChange={(e) => setForm({ ...form, section: e.target.value })} />
                      </div>
                    </>
                  )}
                </>
              )}

              {modal === 'createAssignment' && (
                <>
                  <div className="form-field admin-form-full">
                    <label>Teacher</label>
                    <select className="form-input" value={form.teacher_id || ''} onChange={(e) => setForm({ ...form, teacher_id: Number(e.target.value) })}>
                      <option value="">Select Teacher</option>
                      {usersList.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.email})</option>)}
                    </select>
                  </div>
                  <div className="form-field admin-form-full">
                    <label>Subject</label>
                    <select
                      className="form-input"
                      value={form.subject_id || ''}
                      onChange={(e) => {
                        const subj = subjects.find((s) => s.id === Number(e.target.value));
                        setForm({
                          ...form,
                          subject_id: Number(e.target.value),
                          department: subj?.department || form.department,
                          semester: subj?.semester || form.semester,
                        });
                      }}
                    >
                      <option value="">Select Subject</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} — {s.name} ({s.department} S{s.semester})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Section</label>
                    <input className="form-input" value={form.section || 'A'} onChange={(e) => setForm({ ...form, section: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Semester</label>
                    <input type="number" className="form-input" value={form.semester || 5} onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })} />
                  </div>
                </>
              )}

              {modal === 'createExam' && (
                <>
                  <div className="form-field admin-form-full">
                    <label>Examination Title</label>
                    <input className="form-input" required placeholder="e.g., CS Sem 5 Mid-Semester Exam" onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Exam Type</label>
                    <select className="form-input" value={form.exam_type || 'internal_1'} onChange={(e) => setForm({ ...form, exam_type: e.target.value })}>
                      <option value="internal_1">Internal Assessment 1</option>
                      <option value="internal_2">Internal Assessment 2</option>
                      <option value="mid_semester">Mid-Semester Exam</option>
                      <option value="end_semester">End-Semester Exam</option>
                      <option value="practical">Practical Exam</option>
                      <option value="assignment">Assignment</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Department</label>
                    <select className="form-input" value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                      {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Semester</label>
                    <input type="number" min={1} max={8} className="form-input" value={form.semester || 5} onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })} />
                  </div>
                  <div className="form-field">
                    <label>Section</label>
                    <input className="form-input" value={form.section || 'A'} onChange={(e) => setForm({ ...form, section: e.target.value })} />
                  </div>
                  <div className="form-field admin-form-full">
                    <label>Initial Subject Paper</label>
                    <select className="form-input" value={form.subject_id || ''} onChange={(e) => setForm({ ...form, subject_id: Number(e.target.value) })}>
                      {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name} ({s.department} S{s.semester})</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Exam Date</label>
                    <input type="date" className="form-input" required onChange={(e) => setForm({ ...form, exam_date: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Room</label>
                    <input className="form-input" placeholder="e.g., Hall A-201" onChange={(e) => setForm({ ...form, room: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Start Time</label>
                    <input type="time" className="form-input" value={form.start_time || '10:00'} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>End Time</label>
                    <input type="time" className="form-input" value={form.end_time || '11:30'} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Max Marks</label>
                    <input type="number" className="form-input" value={form.max_marks || 50} onChange={(e) => setForm({ ...form, max_marks: Number(e.target.value) })} />
                  </div>
                  <div className="form-field">
                    <label>Passing Marks</label>
                    <input type="number" className="form-input" value={form.passing_marks || 20} onChange={(e) => setForm({ ...form, passing_marks: Number(e.target.value) })} />
                  </div>
                </>
              )}

              {modal === 'createNotice' && (
                <>
                  <div className="form-field admin-form-full">
                    <label>Title</label>
                    <input className="form-input" required onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  </div>
                  <div className="form-field admin-form-full">
                    <label>Description</label>
                    <textarea className="form-input" rows={3} required onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Category</label>
                    <select className="form-input" value={form.category || 'academic'} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                      {['academic', 'exam', 'event', 'placement', 'holiday', 'general'].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Priority</label>
                    <select className="form-input" value={form.priority || 'normal'} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                      {['normal', 'important', 'urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Target Department</label>
                    <select className="form-input" value={form.target_department || 'All'} onChange={(e) => setForm({ ...form, target_department: e.target.value })}>
                      <option value="All">All</option>
                      {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Status</label>
                    <select className="form-input" value={form.status || 'published'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>
                </>
              )}

              {modal === 'createEvent' && (
                <>
                  <div className="form-field admin-form-full">
                    <label>Event Title</label>
                    <input className="form-input" required onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  </div>
                  <div className="form-field admin-form-full">
                    <label>Description</label>
                    <textarea className="form-input" rows={2} required onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Category</label>
                    <select className="form-input" value={form.category || 'technical_workshop'} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                      {['technical_workshop', 'hackathon', 'coding_competition', 'cultural', 'sports', 'seminar', 'guest_lecture', 'entrepreneurship', 'placement', 'career_guidance', 'club'].map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Date</label>
                    <input type="date" className="form-input" required onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Time</label>
                    <input type="time" className="form-input" required onChange={(e) => setForm({ ...form, event_time: `${e.target.value}:00` })} />
                  </div>
                  <div className="form-field">
                    <label>Venue</label>
                    <input className="form-input" required onChange={(e) => setForm({ ...form, venue: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Organizer</label>
                    <input className="form-input" required onChange={(e) => setForm({ ...form, organizer: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Registration Details</label>
                    <input className="form-input" onChange={(e) => setForm({ ...form, registration_details: e.target.value })} />
                  </div>
                </>
              )}

              {modal === 'createDept' && (
                <>
                  <div className="form-field">
                    <label>Code</label>
                    <input className="form-input" required placeholder="e.g., BIO" onChange={(e) => setForm({ ...form, code: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Name</label>
                    <input className="form-input" required placeholder="Biotechnology" onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                </>
              )}

              {modal === 'createSubject' && (
                <>
                  <div className="form-field">
                    <label>Code</label>
                    <input className="form-input" required placeholder="CS509" onChange={(e) => setForm({ ...form, code: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Subject Name</label>
                    <input className="form-input" required onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Department</label>
                    <select className="form-input" value={form.department_id || ''} onChange={(e) => setForm({ ...form, department_id: Number(e.target.value) })}>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Semester</label>
                    <input type="number" min={1} max={8} className="form-input" value={form.semester || 5} onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })} />
                  </div>
                </>
              )}

              {modal === 'createTimetable' && (
                <>
                  <div className="form-field">
                    <label>Department</label>
                    <select className="form-input" value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                      {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Semester</label>
                    <input type="number" min={1} max={8} className="form-input" value={form.semester || 5} onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })} />
                  </div>
                  <div className="form-field">
                    <label>Subject</label>
                    <input className="form-input" required onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Day</label>
                    <select className="form-input" value={form.day_of_week || 'Monday'} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}>
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Start Time</label>
                    <input type="time" className="form-input" value={form.start_time || '09:00'} onChange={(e) => setForm({ ...form, start_time: `${e.target.value}:00` })} />
                  </div>
                  <div className="form-field">
                    <label>End Time</label>
                    <input type="time" className="form-input" value={form.end_time || '10:00'} onChange={(e) => setForm({ ...form, end_time: `${e.target.value}:00` })} />
                  </div>
                  <div className="form-field">
                    <label>Classroom</label>
                    <input className="form-input" required onChange={(e) => setForm({ ...form, classroom: e.target.value })} />
                  </div>
                </>
              )}

              {modal === 'createFaculty' && (
                <>
                  <div className="form-field">
                    <label>Full Name</label>
                    <input className="form-input" required onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Email</label>
                    <input type="email" className="form-input" required onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Department</label>
                    <select className="form-input" value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                      {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Designation</label>
                    <input className="form-input" required placeholder="Associate Professor" onChange={(e) => setForm({ ...form, designation: e.target.value })} />
                  </div>
                  <div className="form-field admin-form-full">
                    <label>Office Location</label>
                    <input className="form-input" required placeholder="Block B, Room 210" onChange={(e) => setForm({ ...form, office_location: e.target.value })} />
                  </div>
                </>
              )}

              {modal === 'createFacility' && (
                <>
                  <div className="form-field admin-form-full">
                    <label>Facility Name</label>
                    <input className="form-input" required onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="form-field admin-form-full">
                    <label>Description</label>
                    <textarea className="form-input" rows={2} required onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Location</label>
                    <input className="form-input" required onChange={(e) => setForm({ ...form, location: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Opening Hours</label>
                    <input className="form-input" required placeholder="Mon-Sat: 8 AM - 8 PM" onChange={(e) => setForm({ ...form, opening_hours: e.target.value })} />
                  </div>
                </>
              )}

              <div className="admin-form-full" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModal('')}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}

export default AdminPortal;
