import React from 'react';
import { useNotification } from '../context/NotificationContext';
import { formatQueueNumber } from './QueueCard';
import { Bell, X, Check, Eye, Clock, Calendar } from 'lucide-react';

export const NotificationBanner = () => {
  const { activeToast, dismissToast, openDetailModal, markAsRead } = useNotification();

  if (!activeToast) return null;

  const queueNum = activeToast.queue_number
    ? formatQueueNumber(activeToast.queue_number)
    : null;

  const dateObj = activeToast.created_at
    ? new Date(activeToast.created_at)
    : new Date();

  const formattedDate = dateObj.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = dateObj.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className="patient-notification-banner"
      style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
        border: '2px solid #86efac',
        borderRadius: '16px',
        padding: '1.25rem 1.5rem',
        boxShadow: '0 10px 25px -5px rgba(21, 128, 61, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.9rem',
        position: 'relative',
        animation: 'bannerSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      {/* Top Row: Icon + Title + Status + Dismiss */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(21, 128, 61, 0.3)',
              flexShrink: 0,
              animation: 'bellRing 1.5s ease infinite',
            }}
          >
            <Bell size={22} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span>🔔</span>
                <span>{activeToast.title || 'Your Turn!'}</span>
              </h3>

              <span
                className={`badge ${activeToast.is_read ? 'badge-completed' : 'badge-serving'}`}
                style={{ fontSize: '0.75rem', fontWeight: 800 }}
              >
                {activeToast.is_read ? 'Read' : 'Unread'}
              </span>

              {queueNum && (
                <span
                  className="mono-number"
                  style={{
                    backgroundColor: '#15803d',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    fontWeight: 900,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '8px',
                    letterSpacing: '0.05em',
                  }}
                >
                  {queueNum}
                </span>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '0.78rem',
                color: '#64748b',
                marginTop: '0.2rem',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <Calendar size={13} color="#16a34a" />
                {formattedDate}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <Clock size={13} color="#16a34a" />
                {formattedTime}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={dismissToast}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: '0.35rem',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s',
          }}
          title="Dismiss notification"
          aria-label="Dismiss notification"
        >
          <X size={18} />
        </button>
      </div>

      {/* Main Notification Message */}
      <div
        style={{
          color: '#1e293b',
          fontSize: '1rem',
          lineHeight: 1.5,
          fontWeight: 500,
        }}
      >
        {activeToast.message}
      </div>

      {/* Action Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          flexWrap: 'wrap',
          paddingTop: '0.25rem',
        }}
      >
        <button
          onClick={() => openDetailModal(activeToast)}
          className="btn btn-primary btn-sm"
          style={{
            backgroundColor: '#15803d',
            borderColor: '#15803d',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.45rem 0.95rem',
            fontWeight: 700,
          }}
        >
          <Eye size={15} />
          <span>View Details</span>
        </button>

        {!activeToast.is_read && (
          <button
            onClick={() => markAsRead(activeToast.id)}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.95rem',
              fontWeight: 600,
              backgroundColor: '#ffffff',
            }}
          >
            <Check size={15} />
            <span>Mark as Read</span>
          </button>
        )}
      </div>
    </div>
  );
};
