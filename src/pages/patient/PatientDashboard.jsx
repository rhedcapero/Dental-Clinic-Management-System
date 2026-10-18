import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { formatQueueNumber } from '../../components/QueueCard';
import {
  Ticket,
  Calendar,
  User,
  ArrowRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Sparkles
} from 'lucide-react';

export const PatientDashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [activeQueue, setActiveQueue] = useState(null);
  const [servingQueue, setServingQueue] = useState(null);
  const [patientsAhead, setPatientsAhead] = useState(0);
  const [upcomingAppointment, setUpcomingAppointment] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    if (!user) return;
    const todayStr = new Date().toISOString().split('T')[0];

    try {
      // 1. Fetch current active queue of logged-in patient today
      const { data: myQueueData } = await supabase
        .from('queue')
        .select('*, dental_services(name)')
        .eq('patient_id', user.id)
        .eq('queue_date', todayStr)
        .in('status', ['waiting', 'serving'])
        .maybeSingle();

      setActiveQueue(myQueueData || null);

      // 2. Fetch currently serving queue record for today
      const { data: servingData } = await supabase
        .from('queue')
        .select('*, dental_services(name)')
        .eq('queue_date', todayStr)
        .eq('status', 'serving')
        .order('called_at', { ascending: false })
        .limit(1);

      const currentServing = servingData && servingData.length > 0 ? servingData[0] : null;
      setServingQueue(currentServing);

      // 3. If patient has a waiting queue, calculate how many waiting patients are ahead of them
      if (myQueueData && myQueueData.status === 'waiting') {
        const { count, error: countErr } = await supabase
          .from('queue')
          .select('id', { count: 'exact', head: true })
          .eq('queue_date', todayStr)
          .eq('status', 'waiting')
          .lt('queue_number', myQueueData.queue_number);

        setPatientsAhead(count || 0);
      } else {
        setPatientsAhead(0);
      }

      // 4. Fetch next upcoming appointment
      const { data: apptData } = await supabase
        .from('appointments')
        .select('*, dental_services(name)')
        .eq('patient_id', user.id)
        .gte('appointment_date', todayStr)
        .in('status', ['pending', 'confirmed'])
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true })
        .limit(1);

      setUpcomingAppointment(apptData && apptData.length > 0 ? apptData[0] : null);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Setup realtime subscription
    const channel = supabase
      .channel('patient_dashboard_queue')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue' },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Welcome Banner */}
      <div style={{ background: 'linear-gradient(135deg, #15803d 0%, #1e7e52 100%)', borderRadius: 'var(--radius-xl)', padding: 'clamp(1.25rem, 4vw, 2.25rem)', color: '#ffffff', boxShadow: '0 10px 25px -5px rgba(21, 128, 61, 0.25)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.15)', padding: '0.35rem 0.85rem', borderRadius: '9999px', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem' }}>
          <Sparkles size={16} />
          <span>Patient Portal</span>
        </div>
        <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', fontWeight: 800, color: '#ffffff', marginBottom: '0.5rem' }}>
          Welcome, {profile?.full_name || 'Patient'}!
        </h1>
        <p style={{ color: '#dcfce7', fontSize: 'clamp(0.92rem, 2.5vw, 1.05rem)', maxWidth: '600px', margin: 0 }}>
          Track your queue in real time, view upcoming visits, or book your next appointment with ease.
        </p>
      </div>

      {/* Main Grid: Current Queue Status vs Next Appointment */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '1.5rem' }}>
        {/* CURRENT QUEUE CARD (Section 9 & 10) */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Ticket size={20} color="#15803d" />
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Today's Queue Status</h2>
            </div>
            {activeQueue && (
              <span className={`badge ${activeQueue.status === 'serving' ? 'badge-serving' : 'badge-waiting'}`}>
                {activeQueue.status === 'serving' ? 'Now Serving' : 'Waiting'}
              </span>
            )}
          </div>

          {activeQueue ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="queue-ticket">
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Your Queue Number
                </div>
                <div className="queue-number-display mono-number">
                  {formatQueueNumber(activeQueue.queue_number)}
                </div>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>
                  {activeQueue.dental_services?.name || 'Dental Service'}
                </div>
              </div>

              <div className="grid-2col" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Currently Serving
                  </div>
                  <div className="mono-number" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#15803d', marginTop: '0.2rem' }}>
                    {servingQueue ? formatQueueNumber(servingQueue.queue_number) : 'None'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Patients Ahead
                  </div>
                  <div className="mono-number" style={{ fontSize: '1.5rem', fontWeight: 800, color: patientsAhead === 0 ? '#10b981' : '#f59e0b', marginTop: '0.2rem' }}>
                    {activeQueue.status === 'serving' ? '0 (You are next!)' : patientsAhead}
                  </div>
                </div>
              </div>

              {activeQueue.status === 'serving' && (
                <div className="alert alert-info" style={{ margin: 0 }}>
                  <Sparkles size={18} />
                  <span><strong>It's your turn!</strong> Please proceed to the dental consultation room.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Ticket size={48} />
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>You don't have a queue number yet.</h3>
              <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem', maxWidth: '300px', marginInline: 'auto' }}>
                Join today's clinic line and receive your digital ticket instantly.
              </p>
              <Link to="/patient/queue" className="btn btn-primary">
                Get Queue Number
              </Link>
            </div>
          )}
        </div>

        {/* UPCOMING APPOINTMENT CARD */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={20} color="#15803d" />
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Next Scheduled Visit</h2>
            </div>
            {upcomingAppointment && (
              <span className={`badge ${upcomingAppointment.status === 'confirmed' ? 'badge-completed' : 'badge-waiting'}`}>
                {upcomingAppointment.status}
              </span>
            )}
          </div>

          {upcomingAppointment ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '1.5rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
                  Confirmed Appointment
                </div>
                <h3 style={{ fontSize: '1.4rem', color: '#0f172a', margin: '0.35rem 0' }}>
                  {upcomingAppointment.dental_services?.name || 'Dental Service'}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.75rem', color: '#334155', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Calendar size={16} color="#16a34a" />
                    <span>{new Date(upcomingAppointment.appointment_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Clock size={16} color="#16a34a" />
                    <span>{upcomingAppointment.appointment_time.slice(0, 5)}</span>
                  </div>
                </div>
              </div>

              {upcomingAppointment.notes && (
                <div style={{ fontSize: '0.9rem', color: '#64748b', background: '#f8fafc', padding: '1rem', borderRadius: '10px' }}>
                  <strong>Notes:</strong> {upcomingAppointment.notes}
                </div>
              )}

              <Link to="/patient/appointments" className="btn btn-secondary" style={{ marginTop: 'auto' }}>
                Manage All Appointments
              </Link>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Calendar size={48} />
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>No upcoming appointments</h3>
              <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem', maxWidth: '300px', marginInline: 'auto' }}>
                Schedule your next dental check-up or cleaning session in advance.
              </p>
              <Link to="/patient/appointments" className="btn btn-primary">
                Book Appointment
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
