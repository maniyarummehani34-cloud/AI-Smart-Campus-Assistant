import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpenCheck,
  Bot,
  Calendar,
  LogOut,
  Menu,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import BrandLogo from './BrandLogo';
import { useAuth } from '../context/AuthContext';
import './PortalLayout.css';

function getInitials(name, fallback = 'SC') {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function PortalLayout({
  roleLabel,
  roleName,
  userLabel,
  userInitials,
  pageTitle,
  pageSubtitle,
  navItems,
  activeItem,
  onSelectItem,
  quickSwitch,
  children,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const resolvedUserLabel = user?.name || userLabel;
  const resolvedInitials = user?.name
    ? getInitials(user.name, userInitials)
    : userInitials;

  const handleNavSelect = (id) => {
    if (onSelectItem) {
      onSelectItem(id);
    }
    setSidebarOpen(false);
  };

  const handleLogout = async () => {
    setSidebarOpen(false);
    await logout();
    navigate('/login', {
      replace: true,
      state: { message: 'You have been signed out successfully.' },
    });
  };

  return (
    <div className="portal-shell">
      <div
        className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <aside className={`portal-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="portal-sidebar-header">
          <Link to="/" onClick={() => setSidebarOpen(false)}>
            <BrandLogo compact light />
          </Link>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="portal-role-box">
          <div className="portal-role-label">{roleLabel}</div>
          <div className="portal-role-name">{roleName}</div>
        </div>

        <nav className="portal-nav" aria-label={`${roleName} Navigation`}>
          <div className="portal-nav-section">Workspace</div>
          {navItems.map((item) => {
            const Icon = item.icon;

            if (item.to) {
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  className={`portal-nav-item ${
                    activeItem === item.id ? 'active' : ''
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                className={`portal-nav-item ${
                  activeItem === item.id ? 'active' : ''
                }`}
                onClick={() => handleNavSelect(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="portal-nav-section">Campus Links</div>
          {user?.role === 'student' && (
            <Link
              to="/student"
              className={`portal-nav-item ${
                quickSwitch === 'student' ? 'active' : ''
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <User size={18} />
              <span>Student Portal</span>
            </Link>
          )}
          {user?.role === 'teacher' && (
            <Link
              to="/teacher"
              className={`portal-nav-item ${
                quickSwitch === 'teacher' ? 'active' : ''
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <BookOpenCheck size={18} />
              <span>Teacher Portal</span>
            </Link>
          )}
          {user?.role === 'admin' && (
            <Link
              to="/admin"
              className={`portal-nav-item ${
                quickSwitch === 'admin' ? 'active' : ''
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <ShieldCheck size={18} />
              <span>Admin Portal</span>
            </Link>
          )}
          <Link
            to="/events"
            className={`portal-nav-item ${
              quickSwitch === 'events' ? 'active' : ''
            }`}
            onClick={() => setSidebarOpen(false)}
          >
            <Calendar size={18} />
            <span>Campus Events</span>
          </Link>
          <Link
            to="/chatbot"
            className={`portal-nav-item ${
              quickSwitch === 'chatbot' ? 'active' : ''
            }`}
            onClick={() => setSidebarOpen(false)}
          >
            <Bot size={18} />
            <span>AI Campus Assistant</span>
          </Link>
        </nav>

        <div className="portal-sidebar-footer">
          <Link
            to="/"
            className="portal-nav-item"
            onClick={() => setSidebarOpen(false)}
          >
            <ArrowLeft size={18} />
            <span>Back to Home</span>
          </Link>
          <button
            type="button"
            className="portal-nav-item"
            onClick={handleLogout}
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <div className="portal-main">
        <header className="portal-topbar">
          <div className="portal-topbar-left">
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="portal-page-title">{pageTitle}</h1>
              {pageSubtitle && (
                <p className="portal-page-subtitle">{pageSubtitle}</p>
              )}
            </div>
          </div>

          <div className="portal-topbar-actions">
            {quickSwitch !== 'chatbot' && (
              <Link to="/chatbot" className="btn btn-soft btn-sm">
                <Bot size={15} />
                <span>Ask AI Assistant</span>
              </Link>
            )}
            <div className="portal-user-chip">
              <span className="portal-user-avatar">{resolvedInitials}</span>
              <span>{resolvedUserLabel}</span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleLogout}
            >
              <LogOut size={15} />
              <span>Logout</span>
            </button>
          </div>
        </header>

        <main className="portal-content animate-fade-up">{children}</main>
      </div>
    </div>
  );
}

export default PortalLayout;
