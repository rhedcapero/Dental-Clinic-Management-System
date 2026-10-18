import React from 'react';
import { useNotification } from '../context/NotificationContext';
import { formatQueueNumber } from './QueueCard';
import { Bell, X, Check, Calendar, Clock, User, CheckCircle2 } from 'lucide-react';

export const NotificationModal = () => {
  const { isDetailModalOpen, selectedNotification, closeDetailModal, markAsRead } =
    useNotification();

  if (!isDetailModalOpen || !selectedNotification) return null;

  const queueNum = selectedNotification.queue_number
    ? formatQueueNumber(selectedNotification.queue_number)
    : null;

  const dateObj = selectedNotification.created_at
    ? new Date(selectedNotification.created_at)
    : new Date();

  const formattedDate = dateObj.toLocaleDateString(undefined, {
    weekday: 'short',
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
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={closeDetailModal}
    >
      <div
        className="modal-container"
        style={{
          background: '#ffffff',
          borderRadius: '18px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #d1e7d8',
          animation: 'modalSlideIn 0.2s ease-out forwards',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #15803d 0%, #1e7e52 100%)',
            padding: '1.25rem 1.5rem',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bell size={20} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                Notification Details
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#dcfce7' }}>
                DentalCare Queue Calling System
              </p>
            </div>
          </div>

          <button
            onClick={closeDetailModal}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '0.35rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.85,
            }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Status Badge & Title Banner */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🔔</span>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#15803d' }}>
                {selectedNotification.title || 'Your Turn!'}
              </span>
            </div>
            <span
              className={`badge ${selectedNotification.is_read ? 'badge-completed' : 'badge-serving'}`}
              style={{
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 700,
              }}
            >
              {selectedNotification.is_read ? 'Read' : 'Unread'}
            </span>
          </div>

          {/* Queue Number Callout Card */}
          {queueNum && (
            <div
              style={{
                background: '#f0fdf4',
                border: '2px dashed #86efac',
                borderRadius: '14px',
                padding: '1.25rem',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#166534',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: '0.25rem',
                }}
              >
                Called Queue Number
              </div>
              <div
                className="mono-number"
                style={{
                  fontSize: '2.5rem',
                  fontWeight: 900,
                  color: '#15803d',
                  lineHeight: 1.1,
                }}
              >
                {queueNum}
              </div>
            </div>
          )}

          {/* Message Content */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              color: '#1e293b',
              fontSize: '0.98rem',
              lineHeight: 1.6,
              fontWeight: 500,
            }}
          >
            {selectedNotification.message}
          </div>

          {/* Details Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem',
              background: '#f8fafc',
              padding: '0.85rem 1rem',
              borderRadius: '12px',
              fontSize: '0.85rem',
            }}
          >
            {selectedNotification.patient_name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#475569' }}>
                <User size={15} color="#15803d" />
                <span>
                  <strong>Patient:</strong> {selectedNotification.patient_name}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#475569' }}>
              <Calendar size={15} color="#15803d" />
              <span>{formattedDate}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#475569' }}>
              <Clock size={15} color="#15803d" />
              <span>{formattedTime}</span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div
          style={{
            padding: '1rem 1.5rem',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
          }}
        >
          {!selectedNotification.is_read && (
            <button
              onClick={() => markAsRead(selectedNotification.id)}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Check size={16} />
              <span>Mark as Read</span>
            </button>
          )}

          <button
            onClick={closeDetailModal}
            className="btn btn-primary btn-sm"
            style={{ minWidth: '90px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
