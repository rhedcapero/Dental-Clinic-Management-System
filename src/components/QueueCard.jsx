import React from 'react';
import { Clock, CheckCircle2, AlertCircle, PlayCircle, SkipForward } from 'lucide-react';

export const formatQueueNumber = (num) => {
  if (!num) return 'Q---';
  return `Q${String(num).padStart(3, '0')}`;
};

export const QueueCard = ({ queue, onCall, onComplete, onSkip, isStaffView = false }) => {
  if (!queue) return null;

  const serviceName = queue.dental_services?.name || 'General Dental Service';
  const patientName = queue.profiles?.full_name || 'Patient';
  const status = queue.status || 'waiting';

  const getStatusBadge = (st) => {
    switch (st) {
      case 'serving':
        return <span className="badge badge-serving">Serving Now</span>;
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
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: status === 'serving' ? '4px solid #15803d' : '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TICKET</span>
          <div className="mono-number" style={{ fontSize: '2rem', fontWeight: 800, color: '#15803d', lineHeight: 1.1 }}>
            {formatQueueNumber(queue.queue_number)}
          </div>
        </div>
        <div>{getStatusBadge(status)}</div>
      </div>

      <div style={{ padding: '0.5rem 0', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
        {isStaffView && (
          <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a' }}>
            {patientName}
          </div>
        )}
        <div style={{ fontSize: '0.9rem', color: '#475569', marginTop: '0.2rem' }}>
          <strong>Service:</strong> {serviceName}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.4rem' }}>
          <Clock size={14} />
          <span>Issued: {new Date(queue.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {isStaffView && status === 'waiting' && onCall && (
        <button onClick={() => onCall(queue)} className="btn btn-primary btn-sm" style={{ width: '100%' }}>
          <PlayCircle size={16} />
          <span>Call Patient</span>
        </button>
      )}

      {isStaffView && status === 'serving' && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {onComplete && (
            <button onClick={() => onComplete(queue)} className="btn btn-success btn-sm" style={{ flex: 1 }}>
              <CheckCircle2 size={16} />
              <span>Complete</span>
            </button>
          )}
          {onSkip && (
            <button onClick={() => onSkip(queue)} className="btn btn-secondary btn-sm" style={{ flex: 1, color: '#ef4444' }}>
              <SkipForward size={16} />
              <span>Skip</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
