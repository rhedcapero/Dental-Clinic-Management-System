import React, { useState, useRef, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import { formatQueueNumber } from './QueueCard';
import { Bell, CheckCheck, Clock } from 'lucide-react';

export const NotificationDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const {
    notifications,
    unreadCount,
    openDetailModal,
    markAllAsRead,
  } = useNotification();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
  };

  const handleNotificationClick = (item) => {
    setIsOpen(false);
    openDetailModal(item);
  };

  return (
    <div className="notification-bell-wrapper" ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Bell Trigger Button */}
      <button
        onClick={toggleDropdown}
        className="notification-bell-btn"
        aria-label="View Notifications"
        title="Notifications"
        style={{
          position: 'relative',
          background: isOpen ? '#f0fdf4' : '#ffffff',
          border: '1px solid #d1e7d8',
          borderRadius: '10px',
          width: '38px',
          height: '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: unreadCount > 0 ? '#15803d' : '#475569',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          padding: 0,
        }}
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span
            className="notification-unread-badge"
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: '#15803d',
              color: '#ffffff',
              fontSize: '0.68rem',
              fontWeight: 800,
              minWidth: '18px',
              height: '18px',
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '2px solid #ffffff',
              boxShadow: '0 2px 4px rgba(21, 128, 61, 0.3)',
              animation: 'pulseBadge 2s infinite',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="notification-dropdown-panel"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 'min(380px, 90vw)',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #d1e7d8',
            boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'dropdownFadeIn 0.15s ease-out',
          }}
        >
          {/* Dropdown Header */}
          <div
            style={{
              padding: '0.85rem 1.15rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    backgroundColor: '#dcfce7',
                    color: '#15803d',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '9999px',
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#15803d',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.2rem 0.4rem',
                  borderRadius: '6px',
                }}
              >
                <CheckCheck size={14} />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Notification List */}
          <div
            style={{
              maxHeight: '340px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {notifications.length > 0 ? (
              notifications.map((item) => {
                const isUnread = !item.is_read;
                const formattedDate = new Date(item.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    style={{
                      padding: '0.85rem 1.15rem',
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: isUnread ? '#f0fdf4' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                      display: 'flex',
                      gap: '0.75rem',
                      alignItems: 'flex-start',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isUnread ? '#dcfce7' : '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isUnread ? '#f0fdf4' : '#ffffff';
                    }}
                  >
                    {/* Unread indicator / Icon */}
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: isUnread ? '#15803d' : '#e2e8f0',
                        color: isUnread ? '#ffffff' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '0.1rem',
                      }}
                    >
                      <Bell size={16} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          marginBottom: '0.2rem',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: isUnread ? 800 : 700,
                            fontSize: '0.88rem',
                            color: isUnread ? '#15803d' : '#1e293b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.title || 'Notification'}
                        </span>

                        {item.queue_number && (
                          <span
                            className="mono-number"
                            style={{
                              backgroundColor: '#e6f4ea',
                              color: '#15803d',
                              fontWeight: 800,
                              fontSize: '0.75rem',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              flexShrink: 0,
                            }}
                          >
                            {formatQueueNumber(item.queue_number)}
                          </span>
                        )}
                      </div>

                      <p
                        style={{
                          margin: 0,
                          fontSize: '0.82rem',
                          color: '#475569',
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {item.message}
                      </p>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          marginTop: '0.35rem',
                          fontSize: '0.72rem',
                          color: '#94a3b8',
                        }}
                      >
                        <Clock size={12} />
                        <span>{formattedDate}</span>
                        {isUnread && (
                          <span
                            style={{
                              marginLeft: 'auto',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              color: '#15803d',
                            }}
                          >
                            • Unread
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div
                style={{
                  padding: '2.5rem 1rem',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '0.88rem',
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    backgroundColor: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 0.65rem auto',
                    color: '#94a3b8',
                  }}
                >
                  <Bell size={20} />
                </div>
                <div>No notifications yet</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
