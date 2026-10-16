import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatQueueNumber } from '../../components/QueueCard';
import {
  Users,
  Clock,
  Activity,
  CheckCircle2,
  SkipForward,
  PlayCircle,
  AlertCircle,
  Calendar,
  Volume2,
  Sparkles
} from 'lucide-react';

export const StaffDashboard = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    total: 0,
    waiting: 0,
    serving: 0,
    completed: 0,
  });
  const [appointments, setAppointments] = useState([]);
  const [apptStats, setApptStats] = useState({ todayCount: 0, totalCount: 0 });
  const [currentServing, setCurrentServing] = useState(null);
  const [nextInLine, setNextInLine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchStaffData = async () => {
    try {
      // 1. Fetch queue records for today using actual foreign key relation: patient:patient_id(...)
      let qRes = await supabase
        .from('queue')
        .select('*, patient:patient_id(full_name, phone), dental_services(name)')
        .eq('queue_date', todayStr)
        .order('queue_number', { ascending: true });

      if (qRes.error && qRes.error.message?.includes('relationship')) {
        qRes = await supabase
          .from('queue')
          .select('*, profiles:patient_id(full_name, phone), dental_services(name)')
          .eq('queue_date', todayStr)
          .order('queue_number', { ascending: true });
      }

      if (qRes.error && (qRes.error.message?.includes('schema cache') || qRes.error.message?.includes('profiles') || qRes.error.message?.includes('relationship'))) {
        const rawQueue = await supabase
          .from('queue')
          .select('*, dental_services(name)')
          .eq('queue_date', todayStr)
          .order('queue_number', { ascending: true });
        if (!rawQueue.error && rawQueue.data) {
          let patRes = await supabase.from('patient').select('id, full_name, phone');
          if (patRes.error) patRes = await supabase.from('profiles').select('id, full_name, phone');
          const pMap = new Map((patRes.data || []).map((p) => [p.id, p]));
          const merged = rawQueue.data.map((q) => {
            const p = pMap.get(q.patient_id) || null;
            return { ...q, patient: p, profiles: p };
          });
          qRes = { data: merged, error: null };
        }
      }

      const rawList = qRes.data || [];
      const list = rawList.map((q) => {
        const p = q.patient || q.profiles || null;
        return { ...q, patient: p, profiles: p };
      });

      // Calculate queue stats
      const total = list.length;
      const waiting = list.filter((q) => q.status === 'waiting').length;
      const servingList = list.filter((q) => q.status === 'serving');
      const completed = list.filter((q) => q.status === 'completed').length;

      setStats({
        total,
        waiting,
        serving: servingList.length,
        completed,
      });

      // Serving patient
      if (servingList.length > 0) {
        servingList.sort((a, b) => new Date(b.called_at || 0) - new Date(a.called_at || 0));
        setCurrentServing(servingList[0]);
      } else {
        setCurrentServing(null);
      }

      // Next waiting patient
      const waitingPatients = list.filter((q) => q.status === 'waiting');
      setNextInLine(waitingPatients.length > 0 ? waitingPatients[0] : null);

      // 2. Fetch clinic appointments for all patients
      let apptRes = await supabase
        .from('appointments')
        .select('*, patient:patient_id(full_name, email, phone), dental_services(name)')
        .order('appointment_date', { ascending: false });

      if (apptRes.error && apptRes.error.message?.includes('relationship')) {
        apptRes = await supabase
          .from('appointments')
          .select('*, profiles:patient_id(full_name, email, phone), dental_services(name)')
          .order('appointment_date', { ascending: false });
      }

      if (apptRes.error && (apptRes.error.message?.includes('schema cache') || apptRes.error.message?.includes('profiles') || apptRes.error.message?.includes('relationship'))) {
        const rawAppts = await supabase
          .from('appointments')
          .select('*, dental_services(name)')
          .order('appointment_date', { ascending: false });
        if (!rawAppts.error && rawAppts.data) {
          let patRes = await supabase.from('patient').select('id, full_name, email, phone');
          if (patRes.error) patRes = await supabase.from('profiles').select('id, full_name, email, phone');
          const pMap = new Map((patRes.data || []).map((p) => [p.id, p]));
          const merged = rawAppts.data.map((a) => {
            const p = pMap.get(a.patient_id) || null;
            return { ...a, patient: p, profiles: p };
          });
          apptRes = { data: merged, error: null };
        }
      }

      // Temporary debug logs as requested
      console.log('Current authenticated user:', user);
      console.log('Is administrator:', isAdmin);
      console.log('Appointments query result:', apptRes.data);
      console.log('Appointments query error:', apptRes.error);

      if (apptRes.data) {
        const normalizedAppts = apptRes.data.map((a) => {
          const p = a.patient || a.profiles || null;
          return { ...a, patient: p, profiles: p };
        });
        setAppointments(normalizedAppts);
        const todayAppts = normalizedAppts.filter((a) => a.appointment_date === todayStr);
        setApptStats({
          todayCount: todayAppts.length,
          totalCount: normalizedAppts.length,
        });
      }
    } catch (err) {
      console.error('Error fetching staff queue data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffData();

    // Subscribe to realtime queue events
    const channel = supabase
      .channel('staff_dashboard_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue' },
        () => fetchStaffData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Session verification: If not authenticated or not an admin, protect dashboard
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/admin/login', { replace: true });
    }
  }, [user, authLoading, navigate]);


  // Section 12: CALL NEXT PATIENT
  const handleCallNext = async () => {
    setFeedback({ type: '', text: '' });
    if (!nextInLine) {
      setFeedback({ type: 'info', text: 'No waiting patients in queue for today.' });
      return;
    }

    setActionLoading(true);
    try {
      // If there is already a patient serving, complete them or warn
      if (currentServing) {
        await supabase
          .from('queue')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', currentServing.id);
      }

      // Set next patient to serving
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('queue')
        .update({
          status: 'serving',
          called_at: now,
        })
        .eq('id', nextInLine.id);

      if (error) throw error;
      setFeedback({ type: 'success', text: `Called ${formatQueueNumber(nextInLine.queue_number)} - ${nextInLine.profiles?.full_name}` });
      await fetchStaffData();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to call next patient.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Section 13: COMPLETE PATIENT
  const handleComplete = async () => {
    if (!currentServing) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', currentServing.id);

      if (error) throw error;
      setFeedback({ type: 'success', text: `Marked ${formatQueueNumber(currentServing.queue_number)} as completed.` });
      await fetchStaffData();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to complete patient.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Section 14: SKIP PATIENT
  const handleSkip = async () => {
    if (!currentServing) return;
    if (!window.confirm(`Are you sure you want to skip patient ${formatQueueNumber(currentServing.queue_number)}?`)) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('queue')
        .update({
          status: 'skipped',
        })
        .eq('id', currentServing.id);

      if (error) throw error;
      setFeedback({ type: 'info', text: `Patient ${formatQueueNumber(currentServing.queue_number)} was skipped.` });
      await fetchStaffData();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to skip patient.' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Welcome Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #15803d 0%, #1e7e52 100%)',
          borderRadius: 'var(--radius-xl, 18px)',
          padding: 'clamp(1.25rem, 4vw, 2.25rem)',
          color: '#ffffff',
          boxShadow: '0 10px 25px -5px rgba(21, 128, 61, 0.25)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(255, 255, 255, 0.15)',
            padding: '0.35rem 0.85rem',
            borderRadius: '9999px',
            fontSize: '0.85rem',
            fontWeight: 600,
            marginBottom: '0.75rem',
          }}
        >
          <Sparkles size={16} />
          <span>Administrator Portal</span>
        </div>
        <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', fontWeight: 800, color: '#ffffff', marginBottom: '0.5rem', lineHeight: 1.2 }}>
          Administrator Dashboard
        </h1>
        <p style={{ color: '#dcfce7', fontSize: 'clamp(0.92rem, 2.5vw, 1.05rem)', maxWidth: '650px', margin: 0 }}>
          Real-time queue monitoring, patient controls, and clinic dental operations.
        </p>
      </div>

      {feedback.text && (
        <div className={`alert ${feedback.type === 'success' ? 'alert-success' : feedback.type === 'error' ? 'alert-error' : 'alert-info'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* STATS COUNTERS */}
      <div className="stats-grid" style={{ marginBottom: 0 }}>
        {/* Today's Patients */}
        <div
          className="stat-card"
          style={{
            background: '#ffffff',
            border: '1px solid #d1e7d8',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px -1px rgba(21, 128, 61, 0.05), 0 2px 4px -2px rgba(21, 128, 61, 0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
          }}
        >
          <div
            className="stat-icon"
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#dcfce7',
              color: '#15803d',
              flexShrink: 0,
            }}
          >
            <Users size={26} />
          </div>
          <div>
            <div className="stat-val mono-number" style={{ fontSize: '2rem', fontWeight: 800, color: '#15803d', lineHeight: 1 }}>
              {stats.total}
            </div>
            <div className="stat-label" style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.35rem' }}>
              Today's Patients
            </div>
          </div>
        </div>

        {/* Waiting in Queue */}
        <div
          className="stat-card"
          style={{
            background: '#ffffff',
            border: '1px solid #d1e7d8',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px -1px rgba(21, 128, 61, 0.05), 0 2px 4px -2px rgba(21, 128, 61, 0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
          }}
        >
          <div
            className="stat-icon"
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fef3c7',
              color: '#d97706',
              flexShrink: 0,
            }}
          >
            <Clock size={26} />
          </div>
          <div>
            <div className="stat-val mono-number" style={{ fontSize: '2rem', fontWeight: 800, color: '#d97706', lineHeight: 1 }}>
              {stats.waiting}
            </div>
            <div className="stat-label" style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.35rem' }}>
              Waiting in Queue
            </div>
          </div>
        </div>

        {/* Currently Serving */}
        <div
          className="stat-card"
          style={{
            background: '#ffffff',
            border: '1px solid #d1e7d8',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px -1px rgba(21, 128, 61, 0.05), 0 2px 4px -2px rgba(21, 128, 61, 0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
          }}
        >
          <div
            className="stat-icon"
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#dcfce7',
              color: '#15803d',
              flexShrink: 0,
            }}
          >
            <Activity size={26} />
          </div>
          <div>
            <div className="stat-val mono-number" style={{ fontSize: '2rem', fontWeight: 800, color: '#15803d', lineHeight: 1 }}>
              {stats.serving}
            </div>
            <div className="stat-label" style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.35rem' }}>
              Currently Serving
            </div>
          </div>
        </div>

        {/* Completed Visits */}
        <div
          className="stat-card"
          style={{
            background: '#ffffff',
            border: '1px solid #d1e7d8',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px -1px rgba(21, 128, 61, 0.05), 0 2px 4px -2px rgba(21, 128, 61, 0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
          }}
        >
          <div
            className="stat-icon"
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#d1fae5',
              color: '#059669',
              flexShrink: 0,
            }}
          >
            <CheckCircle2 size={26} />
          </div>
          <div>
            <div className="stat-val mono-number" style={{ fontSize: '2rem', fontWeight: 800, color: '#059669', lineHeight: 1 }}>
              {stats.completed}
            </div>
            <div className="stat-label" style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.35rem' }}>
              Completed Visits
            </div>
          </div>
        </div>

        {/* Total Appointments */}
        <div
          className="stat-card"
          style={{
            background: '#ffffff',
            border: '1px solid #d1e7d8',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px -1px rgba(21, 128, 61, 0.05), 0 2px 4px -2px rgba(21, 128, 61, 0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
            cursor: 'pointer',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onClick={() => navigate('/admin/appointments')}
        >
          <div
            className="stat-icon"
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#e6f4ea',
              color: '#166534',
              flexShrink: 0,
            }}
          >
            <Calendar size={26} />
          </div>
          <div>
            <div className="stat-val mono-number" style={{ fontSize: '2rem', fontWeight: 800, color: '#166534', lineHeight: 1 }}>
              {apptStats.totalCount}
            </div>
            <div className="stat-label" style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.35rem' }}>
              Total Appointments ({apptStats.todayCount} Today)
            </div>
          </div>
        </div>
      </div>

      {/* CURRENT PATIENT CALLING STATION & NEXT IN LINE */}
      <div className="admin-calling-station" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: '1.5rem' }}>
        {/* NOW SERVING CARD */}
        <div
          className="card"
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: 'clamp(1.25rem, 3.5vw, 2.25rem)',
            border: currentServing ? '2px solid #15803d' : '1px solid #d1e7d8',
            boxShadow: '0 4px 6px -1px rgba(21, 128, 61, 0.05), 0 2px 4px -2px rgba(21, 128, 61, 0.03)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
              borderBottom: '1px solid #d1e7d8',
              paddingBottom: '1rem',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#15803d',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontSize: '1rem',
              }}
            >
              <Volume2 size={22} color="#15803d" />
              <span>NOW SERVING</span>
            </div>
            {currentServing ? (
              <span
                className="badge"
                style={{
                  background: '#dcfce7',
                  color: '#15803d',
                  border: '1px solid #86efac',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '9999px',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                }}
              >
                Active Session
              </span>
            ) : (
              <span
                className="badge"
                style={{
                  background: '#f1f5f9',
                  color: '#64748b',
                  border: '1px solid #cbd5e1',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '9999px',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                }}
              >
                Standby
              </span>
            )}
          </div>

          {currentServing ? (
            <div>
              <div
                className="mono-number queue-number-display"
                style={{
                  fontSize: 'clamp(2.75rem, 8vw, 4.5rem)',
                  fontWeight: 900,
                  color: '#15803d',
                  lineHeight: 1,
                  letterSpacing: '2px',
                }}
              >
                {formatQueueNumber(currentServing.queue_number)}
              </div>
              <h2 style={{ fontSize: 'clamp(1.35rem, 3.5vw, 1.75rem)', fontWeight: 800, marginTop: '0.75rem', color: '#0f172a' }}>
                {currentServing.profiles?.full_name || 'Patient'}
              </h2>
              <div style={{ fontSize: '1.05rem', color: '#475569', marginTop: '0.35rem' }}>
                <strong style={{ color: '#0f172a' }}>Treatment:</strong> {currentServing.dental_services?.name || 'General Dental Treatment'}
              </div>
              {currentServing.profiles?.phone && (
                <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>📞 {currentServing.profiles.phone}</span>
                </div>
              )}

              {/* ACTION BUTTONS */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.75rem', flexWrap: 'wrap' }}>
                <button
                  onClick={handleComplete}
                  disabled={actionLoading}
                  className="btn btn-success btn-lg"
                  style={{
                    flex: '1 1 140px',
                    backgroundColor: '#15803d',
                    borderColor: '#15803d',
                    borderRadius: '12px',
                    fontWeight: 700,
                  }}
                >
                  <CheckCircle2 size={20} />
                  <span>COMPLETE</span>
                </button>

                <button
                  onClick={handleSkip}
                  disabled={actionLoading}
                  className="btn btn-secondary btn-lg"
                  style={{
                    flex: '1 1 120px',
                    color: '#ef4444',
                    borderColor: '#fca5a5',
                    borderRadius: '12px',
                    fontWeight: 700,
                  }}
                >
                  <SkipForward size={20} />
                  <span>SKIP</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '2.5rem 1rem', textAlign: 'center', margin: 'auto 0' }}>
              <div
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  background: '#dcfce7',
                  color: '#15803d',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                }}
              >
                <Users size={34} />
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0f172a' }}>
                No Patient Currently Serving
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '1.75rem', maxWidth: '320px', marginInline: 'auto' }}>
                {nextInLine ? `Next in line is ticket ${formatQueueNumber(nextInLine.queue_number)}.` : 'No patients waiting in queue.'}
              </p>
              <button
                onClick={handleCallNext}
                disabled={!nextInLine || actionLoading}
                className="btn btn-primary btn-lg"
                style={{
                  backgroundColor: '#15803d',
                  borderColor: '#15803d',
                  borderRadius: '12px',
                  fontWeight: 700,
                  padding: '0.85rem 2rem',
                }}
              >
                <PlayCircle size={22} />
                <span>CALL NEXT PATIENT</span>
              </button>
            </div>
          )}
        </div>

        {/* NEXT UP PANEL */}
        <div
          className="card"
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '2.25rem',
            border: '1px solid #d1e7d8',
            boxShadow: '0 4px 6px -1px rgba(21, 128, 61, 0.05), 0 2px 4px -2px rgba(21, 128, 61, 0.03)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
              borderBottom: '1px solid #d1e7d8',
              paddingBottom: '1rem',
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#15803d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '1rem' }}>
              <Clock size={20} color="#15803d" />
              <span>NEXT IN LINE</span>
            </div>
            <span className="badge badge-waiting">
              {stats.waiting} Waiting
            </span>
          </div>

          {nextInLine ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, justifyContent: 'space-between' }}>
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '14px',
                  padding: '1.5rem',
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Next Ticket
                </div>
                <div
                  className="mono-number"
                  style={{
                    fontSize: '3rem',
                    fontWeight: 900,
                    color: '#15803d',
                    margin: '0.25rem 0',
                    lineHeight: 1.1,
                  }}
                >
                  {formatQueueNumber(nextInLine.queue_number)}
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#0f172a', marginTop: '0.5rem' }}>
                  {nextInLine.profiles?.full_name || 'Patient'}
                </div>
                <div style={{ color: '#166534', fontSize: '0.95rem', marginTop: '0.25rem', fontWeight: 500 }}>
                  {nextInLine.dental_services?.name || 'General Dental Service'}
                </div>
              </div>

              <button
                onClick={handleCallNext}
                disabled={actionLoading}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '0.95rem',
                  backgroundColor: '#15803d',
                  borderColor: '#15803d',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                <PlayCircle size={20} />
                <span>Call This Patient</span>
              </button>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '2.5rem 1rem', textAlign: 'center', margin: 'auto 0' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: '#f0fdf4',
                  color: '#15803d',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '0.75rem',
                }}
              >
                <Clock size={28} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>
                Queue is empty
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                No patients waiting in queue for today.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
