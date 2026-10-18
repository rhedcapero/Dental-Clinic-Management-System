import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { formatQueueNumber } from '../../components/QueueCard';
import { sendCallNotification } from '../../lib/notificationService';
import { Ticket, PlayCircle, CheckCircle2, SkipForward, RefreshCw, Filter } from 'lucide-react';

export const StaffQueue = () => {
  const [queue, setQueue] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchQueue = async () => {
    setLoading(true);
    try {
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

      let data = qRes.data || [];
      if (filter !== 'all') {
        data = data.filter((q) => q.status === filter);
      }

      const normalized = data.map((item) => {
        const pat = item.patient || item.profiles || null;
        return {
          ...item,
          patient: pat,
          profiles: pat,
        };
      });

      setQueue(normalized);
    } catch (err) {
      console.error('Error fetching queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('staff_queue_list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue' },
        () => fetchQueue()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter]);

  const updateStatus = async (id, newStatus) => {
    try {
      const updates = { status: newStatus };
      if (newStatus === 'serving') updates.called_at = new Date().toISOString();
      if (newStatus === 'completed') updates.completed_at = new Date().toISOString();

      await supabase.from('queue').update(updates).eq('id', id);

      if (newStatus === 'serving') {
        const item = queue.find((q) => q.id === id);
        if (item) {
          try {
            await sendCallNotification({
              patientId: item.patient_id,
              queueId: item.id,
              queueNumber: item.queue_number,
              patientName: item.profiles?.full_name || item.patient?.full_name || 'Patient',
            });
          } catch (notifErr) {
            console.warn('Real-time notification notice:', notifErr);
          }
        }
      }

      fetchQueue();
    } catch (err) {
      console.error('Failed to update queue record:', err);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'serving':
        return <span className="badge badge-serving">Serving</span>;
      case 'completed':
        return <span className="badge badge-completed">Completed</span>;
      case 'skipped':
        return <span className="badge badge-skipped">Skipped</span>;
      case 'cancelled':
        return <span className="badge badge-cancelled">Cancelled</span>;
      default:
        return <span className="badge badge-waiting">Waiting</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Today's Queue Roster</h1>
          <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
            Complete list of patients registered for treatment today ({todayStr}).
          </p>
        </div>

        <button onClick={fetchQueue} className="btn btn-secondary btn-sm">
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {['all', 'waiting', 'serving', 'completed', 'skipped'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`btn btn-sm ${filter === tab ? 'btn-primary' : 'btn-secondary'}`}
            style={{ textTransform: 'capitalize' }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Queue Table */}
      {queue.length > 0 ? (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Patient Name</th>
                <th>Phone</th>
                <th>Service</th>
                <th>Status</th>
                <th>Registered</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((item) => (
                <tr key={item.id} style={{ background: item.status === 'serving' ? '#f0f9ff' : 'transparent' }}>
                  <td>
                    <span className="mono-number" style={{ fontWeight: 800, fontSize: '1.2rem', color: '#0284c7' }}>
                      {formatQueueNumber(item.queue_number)}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700 }}>{item.profiles?.full_name || 'Patient'}</td>
                  <td style={{ color: '#64748b' }}>{item.profiles?.phone || '—'}</td>
                  <td>{item.dental_services?.name || 'General'}</td>
                  <td>{getStatusBadge(item.status)}</td>
                  <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                      {item.status === 'waiting' && (
                        <button
                          onClick={() => updateStatus(item.id, 'serving')}
                          className="btn btn-primary btn-sm"
                          title="Call Patient"
                        >
                          <PlayCircle size={14} />
                          <span>Call</span>
                        </button>
                      )}
                      {item.status === 'serving' && (
                        <>
                          <button
                            onClick={() => updateStatus(item.id, 'completed')}
                            className="btn btn-success btn-sm"
                            title="Complete Treatment"
                          >
                            <CheckCircle2 size={14} />
                            <span>Done</span>
                          </button>
                          <button
                            onClick={() => updateStatus(item.id, 'skipped')}
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#ef4444' }}
                            title="Skip Patient"
                          >
                            <SkipForward size={14} />
                            <span>Skip</span>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <Ticket size={48} />
            </div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No queue tickets found</h3>
            <p style={{ color: '#64748b' }}>
              No queue records match the selected status filter for today.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
