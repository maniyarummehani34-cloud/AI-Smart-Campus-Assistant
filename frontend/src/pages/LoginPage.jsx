import { useEffect, useState } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Info,
  LogIn,
  ShieldCheck,
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { getRoleHomePath } from '../components/ProtectedRoute';
import { useAuth } from '../context/AuthContext';
import './AuthPages.css';

const PORTAL_COPY = {
  student: {
    badge: 'Student Portal Access',
    heading: 'Welcome Back, Student',
    desc: 'Sign in with your university email to access notices, examination schedules, published results, personal timetables, campus events, and the AI Campus Assistant.',
    formTitle: 'Student Sign In',
    formSub: 'Enter your registered email and password to continue.',
    icon: GraduationCap,
  },
  teacher: {
    badge: 'Faculty & Teacher Portal',
    heading: 'Teacher Workspace Sign In',
    desc: 'Access your assigned subjects, class rosters, marks entry sheets, performance summaries, and personal timetable with role-isolated permissions.',
    formTitle: 'Teacher Portal Login',
    formSub: 'Sign in using the teacher account created by your campus administrator.',
    icon: BookOpenCheck,
  },
  admin: {
    badge: 'Campus Administration',
    heading: 'Administrator Sign In',
    desc: 'Manage student and teacher accounts, subject assignments, notices, events, examination schedules, marks approvals, and official result publication.',
    formTitle: 'Admin Portal Login',
    formSub: 'Enter your administrator credentials to manage the campus platform.',
    icon: ShieldCheck,
  },
};

function LoginPage() {
  const { login, isAuthenticated, user, authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const portalParam = searchParams.get('portal');
  const activePortal = ['student', 'teacher', 'admin'].includes(portalParam)
    ? portalParam
    : 'student';
  const copy = PORTAL_COPY[activePortal];
  const BadgeIcon = copy.icon;

  const redirectNotice = location.state?.message || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      navigate(getRoleHomePath(user.role), { replace: true });
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    setSubmitting(true);
    try {
      // Role is ALWAYS verified on the Express backend from MySQL
      const authenticatedUser = await login(trimmedEmail, password);
      navigate(getRoleHomePath(authenticatedUser.role), { replace: true });
    } catch (err) {
      setError(
        err.message || 'Unable to sign in. Please check your credentials.'
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
                <BadgeIcon size={14} />
                <span>{copy.badge}</span>
              </span>
              <h1>{copy.heading}</h1>
              <p>{copy.desc}</p>

              <ul className="auth-feature-list">
                <li>
                  <CheckCircle2 size={16} />
                  <span>bcrypt-hashed credentials &amp; JWT session security</span>
                </li>
                <li>
                  <CheckCircle2 size={16} />
                  <span>Strict backend role verification (Student, Teacher, Admin)</span>
                </li>
                <li>
                  <CheckCircle2 size={16} />
                  <span>Automatic redirect to your authorized portal</span>
                </li>
              </ul>
            </div>

            <div className="auth-info-footnote">
              Teacher and Admin accounts cannot be self-registered online and are
              provisioned securely by authorized campus administrators.
            </div>
          </aside>

          <section className="auth-form-panel">
            {/* Contextual Role Switcher (Visual only — backend always determines real role) */}
            <div
              style={{
                display: 'flex',
                gap: '0.45rem',
                marginBottom: '1.35rem',
                flexWrap: 'wrap',
              }}
            >
              {[
                { key: 'student', label: 'Student' },
                { key: 'teacher', label: 'Teacher' },
                { key: 'admin', label: 'Admin' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`btn btn-sm ${
                    activePortal === tab.key ? 'btn-primary' : 'btn-secondary'
                  }`}
                  onClick={() => setSearchParams({ portal: tab.key })}
                >
                  {tab.label} Login
                </button>
              ))}
            </div>

            <h2 className="auth-form-title">{copy.formTitle}</h2>
            <p className="auth-form-subtitle">{copy.formSub}</p>

            {redirectNotice && !error && (
              <div className="auth-alert auth-alert-info" role="status">
                <Info size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{redirectNotice}</span>
              </div>
            )}

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
                <label htmlFor="login-email">Email Address</label>
                <input
                  id="login-email"
                  type="email"
                  className="form-input"
                  placeholder="name@college.edu"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="login-password">Password</label>
                <div className="form-input-wrap">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input form-input-with-btn"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary auth-submit-btn"
                disabled={submitting}
              >
                <LogIn size={17} />
                <span>{submitting ? 'Signing In...' : 'Sign In'}</span>
              </button>
            </form>

            <div className="auth-footer-switch">
              New student?{' '}
              <Link to="/register">Create a Student Account</Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default LoginPage;
