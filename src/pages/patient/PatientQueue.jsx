import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatQueueNumber } from '../../components/QueueCard';
import { Ticket, AlertCircle, CheckCircle2, Clock, Sparkles, XCircle } from 'lucide-react';

export const PatientQueue = () => {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [activeQueue, setActiveQueue] = useState(null);
  const [servingQueue, setServingQueue] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchQueueInfo = async () => {
    if (!user) return;

    try {
      // 1. Fetch patient's active queue today
      const { data: myQueue } = await supabase
        .from('queue')
        .select('*, dental_services(name, estimated_minutes)')
        .eq('patient_id', user.id)
        .eq('queue_date', todayStr)
        .in('status', ['waiting', 'serving'])
        .maybeSingle();

      setActiveQueue(myQueue || null);

      // 2. Fetch currently serving queue
      const { data: serving } = await supabase
        .from('queue')
        .select('*, dental_services(name)')
        .eq('queue_date', todayStr)
        .eq('status', 'serving')
        .order('called_at', { ascending: false })
        .limit(1);

      setServingQueue(serving && serving.length > 0 ? serving[0] : null);
    } catch (err) {
      console.error('Error fetching queue status:', err);
    }
  };

  useEffect(() => {
    // Fetch active services
    const loadServices = async () => {
      const { data } = await supabase
        .from('dental_services')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (data && data.length > 0) {
        setServices(data);
        setSelectedServiceId(data[0].id);
      }
    };

    loadServices();
    fetchQueueInfo();

    // Subscribe to realtime queue changes
    const channel = supabase
      .channel('patient_queue_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue' },
        () => fetchQueueInfo()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleGetQueueNumber = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (activeQueue) {
      setError('You already have an active queue number today.');
      return;
    }

    if (!selectedServiceId) {
      setError('Please select a dental service.');
      return;
    }

    setLoading(true);

    try {
      // First try the concurrency-safe PostgreSQL function
      const { data, error: rpcError } = await supabase.rpc('generate_queue_ticket', {
        p_service_id: selectedServiceId,
      });

      if (rpcError) {
        // Fallback to direct client-side query if RPC not present yet
        const { data: maxRow } = await supabase
          .from('queue')
          .select('queue_number')
          .eq('queue_date', todayStr)
          .order('queue_number', { ascending: false })
          .limit(1);

        const nextNum = (maxRow && maxRow[0]?.queue_number ? maxRow[0].queue_number : 0) + 1;

        const { data: newRow, error: insertError } = await supabase
          .from('queue')
          .insert({
            patient_id: user.id,
            service_id: selectedServiceId,
            queue_number: nextNum,
            queue_date: todayStr,
            status: 'waiting',
          })
          .select('*, dental_services(name)')
          .single();

        if (insertError) throw insertError;
        setSuccessMsg(`Your queue number ${formatQueueNumber(nextNum)} has been issued!`);
      } else {
        setSuccessMsg(`Your queue number has been issued!`);
      }

      await fetchQueueInfo();
    } catch (err) {
      console.error('Error generating queue:', err);
      setError(err.message || 'Failed to issue queue ticket.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelTicket = async () => {
    if (!activeQueue) return;
    if (!window.confirm('Are you sure you want to cancel your active queue ticket?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('queue')
        .update({ status: 'cancelled' })
        .eq('id', activeQueue.id);

      if (error) throw error;
      setActiveQueue(null);
      setSuccessMsg('Your queue ticket has been cancelled.');
    } catch (err) {
      setError(err.message || 'Failed to cancel queue ticket.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Dental Clinic Queue</h1>
        <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
          Select a dental service to join today's clinic line and receive your digital ticket.
        </p>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ACTIVE QUEUE DISPLAY (If already queued) */}
      {activeQueue ? (
        <div className="card" style={{ textAlign: 'center', padding: 'clamp(1.5rem, 4vw, 3rem) clamp(1rem, 3vw, 2rem)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#dcfce7', color: '#15803d', padding: '0.4rem 1rem', borderRadius: '9999px', fontSize: '0.85rem', fontWeight: 700, marginBottom: '1.5rem' }}>
            <Sparkles size={16} />
            <span>Active Clinic Ticket</span>
          </div>

          <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Your Queue Number
          </div>

          <div className="queue-number-display mono-number">
            {formatQueueNumber(activeQueue.queue_number)}
          </div>

          <h2 style={{ fontSize: 'clamp(1.2rem, 3vw, 1.5rem)', color: '#0f172a', marginBottom: '0.5rem' }}>
            {activeQueue.dental_services?.name}
          </h2>

          <p style={{ color: '#64748b', fontSize: 'clamp(0.9rem, 2vw, 1.05rem)', marginBottom: '1.75rem' }}>
            Please wait for your turn. You can monitor this screen or check the clinic TV display.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '1.25rem 1rem', borderRadius: '16px', maxWidth: '400px', margin: '0 auto 1.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 120px', minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Currently Serving
              </div>
              <div className="mono-number" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#15803d', marginTop: '0.25rem' }}>
                {servingQueue ? formatQueueNumber(servingQueue.queue_number) : '---'}
              </div>
            </div>

            <div style={{ flex: '1 1 120px', minWidth: 0, borderLeft: '1px solid #e2e8f0', paddingLeft: '1rem' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Ticket Status
              </div>
              <div style={{ marginTop: '0.35rem' }}>
                <span className={`badge ${activeQueue.status === 'serving' ? 'badge-serving' : 'badge-waiting'}`}>
                  {activeQueue.status === 'serving' ? 'Now Serving!' : 'Waiting'}
                </span>
              </div>
            </div>
          </div>

          {activeQueue.status === 'waiting' && (
            <button onClick={handleCancelTicket} disabled={loading} className="btn btn-secondary btn-sm" style={{ color: '#ef4444' }}>
              <XCircle size={16} />
              <span>Cancel My Ticket</span>
            </button>
          )}
        </div>
      ) : (
        /* GET QUEUE NUMBER FORM (Section 10) */
        <div className="card" style={{ padding: 'clamp(1.25rem, 4vw, 2.5rem)' }}>
          <div className="card-header" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Ticket size={22} color="#15803d" />
              <h2 style={{ fontSize: '1.35rem', margin: 0 }}>Get a Queue Ticket</h2>
            </div>
          </div>

          <form onSubmit={handleGetQueueNumber} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '1rem' }}>Select Dental Service</label>
              <select
                className="form-select"
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                style={{ padding: '0.9rem 1.25rem', fontSize: '1rem' }}
                required
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (~{s.estimated_minutes} mins)
                  </option>
                ))}
              </select>
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: '10px', fontSize: '0.9rem', color: '#64748b' }}>
              ℹ️ Queue numbers are sequential and reset every day. Each patient is allowed one active queue ticket per day.
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg"
              style={{ padding: '1rem', fontWeight: 700 }}
            >
              {loading ? 'Issuing Ticket...' : 'GET QUEUE NUMBER'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
