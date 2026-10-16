import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { AlertCircle, Eye, EyeOff, Lock, Mail, Shield, HelpCircle } from 'lucide-react';

export const StaffLogin = () => {
  const { user, isAdmin, loading: authLoading, loginAdmin } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);

  // If already authenticated as administrator, redirect directly to admin dashboard
  useEffect(() => {
    if (!authLoading && user && isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [user, isAdmin, authLoading, navigate]);

  // Ensure non-scrollable viewport layout on desktop for Administrator Login page
  useEffect(() => {
    document.documentElement.classList.add('admin-login-page');
    document.body.classList.add('admin-login-page');
    return () => {
      document.documentElement.classList.remove('admin-login-page');
      document.body.classList.remove('admin-login-page');
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please provide your administrator email and password.');
      return;
    }

    setLoading(true);
    try {
      await loginAdmin(email.trim(), password);
      navigate('/admin');
    } catch (err) {
      console.error('Administrator authentication error:', err);
      const msg = err.message || '';
      if (msg.includes('Access denied') || msg.includes('Administrator account required')) {
        setError('Access denied. Administrator account required.');
      } else if (msg.includes('Invalid login credentials') || msg.includes('invalid_grant')) {
        setError('Invalid administrator email or password.');
      } else {
        setError(msg || 'Invalid administrator email or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="admin-login-container"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100dvh - 66px)',
        padding: '1rem 1.5rem',
        backgroundColor: '#f8fafc',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="card admin-login-card"
        style={{
          maxWidth: '450px',
          width: '100%',
          padding: 'clamp(1.25rem, 4vw, 1.75rem) clamp(1rem, 3.5vw, 2rem)',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.06), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
          position: 'relative',
          boxSizing: 'border-box',
        }}
      >
        {/* Top Administrator Shield Icon */}
        <div style={{ textAlign: 'center', marginBottom: '1.15rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              backgroundColor: '#dcfce7',
              color: '#15803d',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '0.65rem',
              boxShadow: '0 2px 8px rgba(21, 128, 61, 0.15)',
            }}
          >
            <Shield size={26} strokeWidth={2.2} />
          </div>

          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              marginBottom: '0.25rem',
              lineHeight: 1.2,
            }}
          >
            Administrator Portal
          </h1>
          <p
            style={{
              color: '#64748b',
              fontSize: '0.84rem',
              lineHeight: 1.4,
              maxWidth: '380px',
              margin: '0 auto',
            }}
          >
            Access clinic queue control, patient records, and appointment management.
          </p>
        </div>

        {/* Alert Notification */}
        {error && (
          <div
            className="alert alert-error"
            style={{
              marginBottom: '0.85rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
              fontSize: '0.84rem',
              lineHeight: 1.4,
              padding: '0.65rem 0.85rem',
            }}
          >
            <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          {/* Administrator Email Input */}
          <div className="form-group" style={{ marginBottom: '0.85rem' }}>
            <label
              className="form-label"
              htmlFor="admin-email"
              style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '0.35rem',
                display: 'block',
              }}
            >
              Administrator Email
            </label>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Mail size={17} />
              </div>
              <input
                id="admin-email"
                type="email"
                className="form-input"
                placeholder="admin@dentalcare.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username email"
                style={{
                  paddingLeft: '38px',
                  paddingTop: '0.55rem',
                  paddingBottom: '0.55rem',
                  borderRadius: '10px',
                  borderColor: '#cbd5e1',
                  fontSize: '0.9rem',
                }}
              />
            </div>
          </div>

          {/* Password Input with Visibility Toggle */}
          <div className="form-group" style={{ marginBottom: '1.05rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.35rem',
              }}
            >
              <label
                className="form-label"
                htmlFor="admin-password"
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: 0,
                }}
              >
                Password
              </label>
            </div>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Lock size={17} />
              </div>
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{
                  paddingLeft: '38px',
                  paddingRight: '40px',
                  paddingTop: '0.55rem',
                  paddingBottom: '0.55rem',
                  borderRadius: '10px',
                  borderColor: '#cbd5e1',
                  fontSize: '0.9rem',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '4px',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn"
            style={{
              width: '100%',
              backgroundColor: '#15803D',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.92rem',
              padding: '0.72rem 1rem',
              borderRadius: '10px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s ease, transform 0.1s ease',
              boxShadow: '0 2px 8px rgba(21, 128, 61, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
            onMouseOver={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = '#16a34a';
            }}
            onMouseOut={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = '#15803D';
            }}
          >
            {loading ? (
              <>
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    border: '2px solid rgba(255,255,255,0.4)',
                    borderTopColor: '#ffffff',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                <span>Authenticating Administrator Access...</span>
              </>
            ) : (
              <span>Sign In as Administrator</span>
            )}
          </button>
        </form>

        {/* Footer Navigation & Support Links */}
        <div
          style={{
            marginTop: '1.15rem',
            paddingTop: '0.85rem',
            borderTop: '1px solid #f1f5f9',
            textAlign: 'center',
            fontSize: '0.84rem',
          }}
        >
          <div style={{ marginBottom: '0.45rem' }}>
            <span style={{ color: '#64748b' }}>Are you a patient? </span>
            <Link
              to="/login"
              style={{
                color: '#15803d',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Log in here &rarr;
            </Link>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowSupervisorModal(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
              }}
            >
              <HelpCircle size={13} />
              Need administrator access or password reset? Contact system supervisor
            </button>
          </div>
        </div>

        {/* Modal for Supervisor Contact Assistance */}
        {showSupervisorModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.45)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1rem',
            }}
            onClick={() => setShowSupervisorModal(false)}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '14px',
                padding: '1.75rem',
                maxWidth: '400px',
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                border: '1px solid #e2e8f0',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#15803d', marginBottom: '0.75rem' }}>
                <Shield size={22} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>System Supervisor Help</h3>
              </div>
              <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5, marginBottom: '1rem' }}>
                Clinic system administrator credentials and access keys are managed and provisioned by the clinic system supervisor.
              </p>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  fontSize: '0.83rem',
                  color: '#334155',
                  marginBottom: '1.25rem',
                }}
              >
                <div><strong>IT &amp; Admin Desk:</strong> support@dentalcare.com</div>
                <div style={{ marginTop: '0.25rem' }}><strong>Clinic Extension:</strong> +1 (555) 019-4820</div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowSupervisorModal(false)}
                style={{ width: '100%' }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
