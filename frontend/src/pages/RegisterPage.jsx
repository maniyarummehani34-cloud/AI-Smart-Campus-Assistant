import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  UserPlus,
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { getRoleHomePath } from '../components/ProtectedRoute';
import { useAuth } from '../context/AuthContext';
import './AuthPages.css';

const DEPARTMENTS = [
  'Computer Science',
  'Information Technology',
  'Electronics & Communication',
  'Mechanical Engineering',
  'Civil Engineering',
  'Artificial Intelligence & Data Science',
];

function RegisterPage() {
  const { register, isAuthenticated, user, authLoading } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    student_id: '',
    department: 'Computer Science',
    semester: '1',
    section: 'A',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      navigate(getRoleHomePath(user.role), { replace: true });
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (
      !form.name.trim() ||
      !form.email.trim() ||
      !form.password ||
      !form.student_id.trim() ||
      !form.department.trim() ||
      !form.semester
    ) {
      setError('Please fill in all required registration fields.');
      return;
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match. Please re-enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        student_id: form.student_id.trim(),
        department: form.department.trim(),
        semester: Number(form.semester),
        section: form.section,
      });
      navigate('/student', { replace: true });
    } catch (err) {
      setError(
        err.message || 'Unable to complete registration. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <header className="auth-header">
        <div className="container auth-header-inner">
          <Link to="/">
            <BrandLogo />
          </Link>
          <Link to="/" className="btn btn-ghost btn-sm">
            <ArrowLeft size={15} />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      <main className="auth-main">
        <div className="auth-grid animate-fade-up">
          <aside className="auth-info-panel">
            <div>
              <span className="auth-info-badge">
                <GraduationCap size={14} />
                <span>Student Registration</span>
              </span>
              <h1>Create Your Student Account</h1>
              <p>
                Register with your official college details to access notices,
                examination schedules, published results, timetables, events,
                and the AI Campus Assistant.
              </p>

              <ul className="auth-feature-list">
                <li>
                  <CheckCircle2 size={16} />
                  <span>Department, semester &amp; section-scoped academic feed</span>
                </li>
                <li>
                  <CheckCircle2 size={16} />
                  <span>Private access to your own verified examination results</span>
                </li>
                <li>
                  <CheckCircle2 size={16} />
                  <span>Instant Student Portal access after sign-up</span>
                </li>
              </ul>
            </div>

            <div className="auth-info-footnote">
              Public registration creates standard Student accounts only.
              Teachers and Admins are created by authorized administrators.
            </div>
          </aside>

          <section className="auth-form-panel">
            <h2 className="auth-form-title">Student Sign Up</h2>
            <p className="auth-form-subtitle">
              Fill in your details below to register as a student.
            </p>

            {error && (
              <div className="auth-alert auth-alert-error" role="alert">
                <AlertCircle
                  size={17}
                  style={{ flexShrink: 0, marginTop: '2px' }}
                />
                <span>{error}</span>
              </div>
            )}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="form-field">
                <label htmlFor="reg-name">Full Name</label>
                <input
                  id="reg-name"
                  name="name"
                  type="text"
                  className="form-input"
                  placeholder="e.g., Aarav Sharma"
                  autoComplete="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="reg-email">University Email</label>
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  className="form-input"
                  placeholder="student@college.edu"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="auth-form-row">
                <div className="form-field">
                  <label htmlFor="reg-student-id">Student ID</label>
                  <input
                    id="reg-student-id"
                    name="student_id"
                    type="text"
                    className="form-input"
                    placeholder="e.g., CS2026001"
                    value={form.student_id}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="reg-department">Department</label>
                  <select
                    id="reg-department"
                    name="department"
                    className="form-input"
                    value={form.department}
                    onChange={handleChange}
                    required
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="auth-form-row">
                <div className="form-field">
                  <label htmlFor="reg-semester">Semester</label>
                  <select
                    id="reg-semester"
                    name="semester"
                    className="form-input"
                    value={form.semester}
                    onChange={handleChange}
                    required
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                      <option key={sem} value={sem}>
                        Semester {sem}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="reg-section">Section</label>
                  <select
                    id="reg-section"
                    name="section"
                    className="form-input"
                    value={form.section}
                    onChange={handleChange}
                  >
                    {['A', 'B', 'C'].map((sec) => (
                      <option key={sec} value={sec}>
                        Section {sec}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="auth-form-row">
                <div className="form-field">
                  <label htmlFor="reg-password">Password</label>
                  <div className="form-input-wrap">
                    <input
                      id="reg-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      className="form-input form-input-with-btn"
                      placeholder="Min 8 characters"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={handleChange}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="reg-confirm">Confirm Password</label>
                  <input
                    id="reg-confirm"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary auth-submit-btn"
                disabled={submitting}
              >
                <UserPlus size={17} />
                <span>
                  {submitting ? 'Creating Account...' : 'Create Student Account'}
                </span>
              </button>
            </form>

            <div className="auth-footer-switch">
              Already have an account? <Link to="/login">Sign In</Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default RegisterPage;
