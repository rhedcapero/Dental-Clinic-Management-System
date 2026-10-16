import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatQueueNumber } from '../../components/QueueCard';
import { History, Calendar, Clock, Ticket } from 'lucide-react';

export const PatientHistory = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('queue')
          .select('*, dental_services(name)')
          .eq('patient_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setHistory(data || []);
      } catch (err) {
        console.error('Error fetching queue history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="badge badge-completed">Completed</span>;
      case 'serving':
        return <span className="badge badge-serving">Serving</span>;
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
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Queue History</h1>
        <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
          Review all your past queue tickets and clinic visits.
        </p>
      </div>

      {history.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))', gap: '1.25rem' }}>
          {history.map((item) => (
            <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="mono-number" style={{ fontSize: '1.6rem', fontWeight: 800, color: '#15803d' }}>
                  {formatQueueNumber(item.queue_number)}
                </span>
                {getStatusBadge(item.status)}
              </div>

              <div>
                <h3 style={{ fontSize: '1.1rem', margin: '0.25rem 0' }}>
                  {item.dental_services?.name || 'Dental Service'}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#64748b' }}>
                  <Calendar size={14} />
                  <span>
                    {new Date(item.created_at).toLocaleDateString(undefined, {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8' }}>
                <span>Issued: {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {item.completed_at && (
                  <span>Done: {new Date(item.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <History size={48} />
            </div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No queue history yet</h3>
            <p style={{ fontSize: '0.95rem', color: '#64748b' }}>
              When you get tickets and visit the clinic, your visit history will appear here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
