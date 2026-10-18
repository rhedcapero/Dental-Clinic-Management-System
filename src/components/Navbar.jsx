import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNav } from '../context/NavContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { NotificationDropdown } from './NotificationDropdown';
import { Activity, LogOut, AlertTriangle, User, Menu, X } from 'lucide-react';

export const Navbar = () => {
  const { user, profile, logout, isAdmin, isAdminPortal } = useAuth();
  const { isMobileNavOpen, toggleMobileNav } = useNav();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdminPortalActive = location.pathname.startsWith('/staff') || location.pathname.startsWith('/admin') || isAdminPortal;
  const isPortalRoute = location.pathname.startsWith('/patient') || location.pathname.startsWith('/admin') || location.pathname.startsWith('/staff');

  const handleLogout = async () => {
    await logout();
    if (isAdminPortalActive) {
      navigate('/admin/login');
    } else {
      navigate('/');
    }
  };

  const homeLink = isAdminPortalActive ? '/admin' : '/';

  return (
    <header className="app-navbar">
      {!isSupabaseConfigured && (
        <div className="config-warning-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} />
            <span>
              <strong>Supabase Setup Required:</strong> Please add your <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to the <code>.env</code> file.
            </span>
          </div>
        </div>
      )}

      <div className="navbar-container">
        <div className="navbar-left-group">
          {/* Hamburger Menu Toggle (Only rendered if user is logged in or in portal on mobile/tablet) */}
          {user && (
            <button
              onClick={toggleMobileNav}
              className="navbar-hamburger-btn"
              aria-label={isMobileNavOpen ? 'Close Menu' : 'Open Menu'}
              aria-expanded={isMobileNavOpen}
            >
              {isMobileNavOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          )}

          {/* Clinic Brand & Logo */}
          <Link to={homeLink} className="navbar-brand-link">
            <div className="navbar-brand-icon">
              <Activity size={22} />
            </div>
            <div className="navbar-brand-info">
              <div className="navbar-brand-title">
                Dental<span style={{ color: '#15803d' }}>Care</span>
              </div>
              <div className="navbar-brand-subtitle">
                Queue Management
              </div>
            </div>
          </Link>
        </div>

        {/* Right Action Group */}
        {user && (
          <div className="navbar-user-actions">
            {!isAdminPortalActive && !isAdmin && <NotificationDropdown />}

            <div className="navbar-user-badge-container">
              <div className="navbar-user-row">
                <User size={17} color="#334155" style={{ flexShrink: 0 }} />
                <span className="navbar-user-display-name">
                  {isAdmin
                    ? (profile?.full_name && profile.full_name !== 'Patient' ? profile.full_name : 'Administrator')
                    : (profile?.full_name || user.email)}
                </span>
              </div>
              <span className={`navbar-role-pill ${isAdmin ? 'role-admin' : 'role-patient'}`}>
                {isAdmin ? 'ADMIN' : (profile?.role ? profile.role.toUpperCase() : 'PATIENT')}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="btn btn-secondary btn-sm navbar-logout-btn"
              title="Log Out"
            >
              <LogOut size={16} />
              <span className="navbar-logout-text">Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
