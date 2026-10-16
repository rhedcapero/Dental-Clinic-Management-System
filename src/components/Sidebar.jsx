import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNav } from '../context/NavContext';
import {
  LayoutDashboard,
  Ticket,
  Calendar,
  History,
  User,
  Users,
  Briefcase,
  ClipboardList,
  X,
  LogOut,
  Activity,
} from 'lucide-react';

export const Sidebar = ({ type = 'patient' }) => {
  const { profile, isAdmin, logout } = useAuth();
  const { isMobileNavOpen, closeMobileNav } = useNav();

  const patientLinks = [
    { to: '/patient/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/patient/queue', label: 'My Queue', icon: Ticket },
    { to: '/patient/appointments', label: 'Appointments', icon: Calendar },
    { to: '/patient/history', label: 'History', icon: History },
    { to: '/patient/profile', label: 'Profile', icon: User },
  ];

  const adminLinks = [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/queue', label: 'Live Queue', icon: Ticket },
    { to: '/admin/appointments', label: 'Appointments', icon: Calendar },
    { to: '/admin/patients', label: 'Patients', icon: Users },
    { to: '/admin/logs', label: 'Logs', icon: ClipboardList },
    { to: '/admin/services', label: 'Dental Services', icon: Briefcase },
  ];

  const isEffectiveAdmin = isAdmin || type === 'admin' || type === 'staff';
  const links = isEffectiveAdmin ? adminLinks : patientLinks;

  const renderNavLinks = () => (
    <nav className="sidebar-nav-links">
      {links.map((link) => {
        const Icon = link.icon;
        return (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/admin' || link.to === '/patient/dashboard'}
            onClick={closeMobileNav}
            className={({ isActive }) =>
              `sidebar-nav-link ${isActive ? 'active' : ''}`
            }
          >
            <Icon size={18} className="sidebar-nav-icon" />
            <span className="sidebar-nav-label">{link.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );

  const renderProfileHeader = (isDrawer = false) => (
    <div className={`sidebar-profile-header ${isDrawer ? 'drawer-profile-header' : ''}`}>
      <div className="sidebar-portal-badge">
        {isEffectiveAdmin ? 'Administrator Portal' : 'Patient Portal'}
      </div>
      <div className="sidebar-user-name">
        {isEffectiveAdmin
          ? (profile?.full_name && profile.full_name !== 'Patient' ? profile.full_name : 'Administrator')
          : (profile?.full_name || 'Active User')}
      </div>
      <div className="sidebar-role-badge-row">
        <span className={`sidebar-role-badge ${isEffectiveAdmin ? 'role-admin' : 'role-patient'}`}>
          {isEffectiveAdmin ? 'ADMIN' : (profile?.role ? profile.role.toUpperCase() : 'PATIENT')}
        </span>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Permanent Sidebar (Visible on screens > 1024px) */}
      <aside className="app-sidebar desktop-sidebar">
        {renderProfileHeader(false)}
        {renderNavLinks()}
      </aside>

      {/* 2. Mobile Responsive Drawer Backdrop (Visible on screens <= 1024px when open) */}
      <div
        className={`mobile-nav-backdrop ${isMobileNavOpen ? 'active' : ''}`}
        onClick={closeMobileNav}
        aria-hidden="true"
      />

      {/* 3. Mobile Responsive Drawer Container (Visible on screens <= 1024px when open) */}
      <aside
        className={`mobile-nav-drawer ${isMobileNavOpen ? 'open' : ''}`}
        aria-label="Mobile Navigation"
      >
        <div className="mobile-drawer-top-bar">
          <div className="mobile-drawer-brand">
            <div className="brand-icon-wrap-sm">
              <Activity size={18} />
            </div>
            <span className="mobile-drawer-brand-text">
              Dental<span style={{ color: '#15803d' }}>Care</span>
            </span>
          </div>
          <button
            onClick={closeMobileNav}
            className="mobile-drawer-close-btn"
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        {renderProfileHeader(true)}
        <div className="mobile-drawer-scroll-body">
          {renderNavLinks()}
        </div>

        <div className="mobile-drawer-footer">
          <button
            onClick={async () => {
              closeMobileNav();
              await logout();
            }}
            className="btn btn-secondary btn-sm mobile-drawer-logout-btn"
          >
            <LogOut size={16} />
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
