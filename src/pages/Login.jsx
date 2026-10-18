import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Lock, Mail, AlertCircle, ArrowRight, Activity } from 'lucide-react';

export const Login = () => {
  const { login, refreshProfile, logout, checkAdminStatus } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both your email and password.');
      return;
    }

    setLoading(true);
    try {
      const authData = await login(email.trim(), password);
      const currentUserId = authData?.user?.id;

      // Verify admin status directly from public.admins table using auth.uid()
      let isUserAdmin = false;
      if (currentUserId) {
        if (checkAdminStatus) {
          isUserAdmin = await checkAdminStatus(currentUserId);
        } else {
          const { data: adminRecord } = await supabase
            .from('admins')
            .select('user_id')
            .eq('user_id', currentUserId)
            .maybeSingle();
          isUserAdmin = Boolean(adminRecord?.user_id);
        }
      }

      const userProfile = await refreshProfile();
      
      // If user exists in public.admins or profile is admin, disallow patient portal login
      if (isUserAdmin || userProfile?.role === 'admin') {
        await logout();
        setError('This account is registered as an administrator. Please log in using the Administrator Portal at /admin/login.');
        return;
      }

      // Clinic staff accounts are disallowed login access across the system
      if (userProfile?.role === 'staff') {
        await logout();
        setError('Access denied. Only system administrators can access this portal.');
        return;
      }

      // Patient accounts route to patient dashboard
      const redirectPath = location.state?.from?.pathname || '/patient/dashboard';
      navigate(redirectPath);
    } catch (err) {
      console.error('Login error:', err);
      if (err.message?.includes('Invalid login credentials') || err.message?.includes('invalid_grant')) {
        setError('Invalid email or password.');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 80px)', padding: 'clamp(1rem, 4vw, 2rem) 1rem', background: '#f8fafc' }}>
      <div className="card" style={{ maxWidth: '440px', width: '100%', padding: 'clamp(1.5rem, 5vw, 2.5rem) clamp(1rem, 4vw, 2rem)', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#dcfce7', color: '#15803d', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
            <Activity size={26} />
          </div>
          <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 1.75rem)', fontWeight: 800, color: '#0f172a' }}>Patient Login</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Access your dental queue tickets & appointments
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                className="form-input"
                placeholder="juan@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.75rem', padding: '0.85rem' }}
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '1.75rem', textAlign: 'center', fontSize: '0.9rem', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
          Don't have an account yet?{' '}
          <Link to="/register" style={{ color: '#15803d', fontWeight: 600 }}>
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
};
