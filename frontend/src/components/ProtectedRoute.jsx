import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function getRoleHomePath(role) {
  if (role === 'admin') return '/admin';
  if (role === 'teacher') return '/teacher';
  return '/student';
}

function ProtectedRoute({ allowedRoles, children }) {
  const { user, isAuthenticated, authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-page)',
          color: 'var(--navy-900)',
          fontWeight: 600,
          fontSize: '0.95rem',
        }}
      >
        Verifying your Smart Campus session...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
          message: 'Please sign in to access this page.',
        }}
      />
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const fallbackPath = getRoleHomePath(user.role);
    return (
      <Navigate
        to={fallbackPath}
        replace
        state={{
          accessNotice:
            'Access restricted: You were redirected to your authorized Smart Campus workspace.',
        }}
      />
    );
  }

  return children;
}

export default ProtectedRoute;
