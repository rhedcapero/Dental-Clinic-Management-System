import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, LogIn, ArrowLeft } from 'lucide-react';

export const ProtectedRoute = ({ children, requireAdmin = false, requireStaff = false }) => {
  const { user, loading, isAdmin, logout } = useAuth();
  const location = useLocation();

  const needsAdmin = requireAdmin || requireStaff;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ width: '42px', height: '42px', border: '3px solid #e2e8f0', borderTopColor: '#15803d', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#64748b', fontWeight: 600, fontSize: '0.95rem' }}>
          {needsAdmin ? 'Verifying Administrator Session...' : 'Verifying Patient Session...'}
        </p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // 1. Not logged in -> redirect to /admin/login for admin routes, /login for patient routes
  if (!user) {
    return <Navigate to={needsAdmin ? "/admin/login" : "/login"} state={{ from: location }} replace />;
  }

  // 2. Administrator route protection: Check whether user exists in public.admins
  if (needsAdmin) {
    if (!isAdmin) {
      // Authenticated, but not in public.admins table -> Access Denied
      return (
        <div
          style={{
            minHeight: '80vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem 1.5rem',
            backgroundColor: '#f8fafc',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '500px',
              width: '100%',
              padding: '2.5rem 2rem',
              textAlign: 'center',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #fecaca',
              boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.08)',
            }}
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.25rem',
              }}
            >
              <ShieldAlert size={32} />
            </div>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
              Access Denied
            </h2>

            <p style={{ color: '#64748b', fontSize: '0.92rem', lineHeight: 1.55, marginBottom: '1.75rem' }}>
              Access denied. Administrator account required. The logged-in account (<strong>{user?.email || 'Unknown'}</strong>) is not registered in the system administrator records.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  window.location.href = '/admin/login';
                }}
                className="btn btn-primary"
                style={{
                  backgroundColor: '#15803d',
                  color: '#ffffff',
                  fontWeight: 700,
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                <LogIn size={18} />
                <span>Sign In with Administrator Account</span>
              </button>

              <Link
                to="/"
                className="btn btn-secondary"
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                <ArrowLeft size={16} />
                <span>Return to Patient Portal</span>
              </Link>
            </div>
          </div>
        </div>
      );
    }
  }

  return children;
};

