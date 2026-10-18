import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { patientSupabase } from '../lib/supabase';
import {
  fetchPatientNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  saveStoredNotifications,
  getStoredNotifications,
} from '../lib/notificationService';
import { formatQueueNumber } from '../components/QueueCard';

const NotificationContext = createContext({});

export const useNotification = () => useContext(NotificationContext);

// Gentle pleasant audio chime using Web Audio API
const playNotificationChime = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second note
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.18); // A5
    gain2.gain.setValueAtTime(0.18, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.65);
  } catch (e) {
    // Audio autoplay might be restricted before interaction; safe to ignore
  }
};

export const NotificationProvider = ({ children }) => {
  const { user, profile, isAdmin } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [activeToast, setActiveToast] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Set to avoid duplicate processing across multiple realtime channels
  const processedKeysRef = useRef(new Set());

  // Load notifications for authenticated patient
  const loadNotifications = useCallback(async () => {
    if (!user || isAdmin) {
      setNotifications([]);
      return;
    }

    try {
      const items = await fetchPatientNotifications(user.id);
      setNotifications(items);

      // Check if there is an unread call notification to display as active banner
      const unreadCall = items.find(
        (n) => !n.is_read && n.title?.toLowerCase().includes('your turn')
      );
      if (unreadCall && !activeToast) {
        setActiveToast(unreadCall);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }, [user, isAdmin, activeToast]);

  // Handle incoming notification payload
  const handleIncomingNotification = useCallback(
    (notif) => {
      if (!user) return;
      const targetPatientId = notif.patient_id || notif.patientId;
      if (targetPatientId !== user.id) return; // STRICT FILTER: only for this patient

      const dedupeKey = notif.id || `notif_${notif.queue_id || notif.queueId}_${notif.created_at || notif.createdAt}`;
      if (processedKeysRef.current.has(dedupeKey)) return;
      processedKeysRef.current.add(dedupeKey);

      const normalized = {
        id: notif.id || `gen_${Date.now()}`,
        patient_id: user.id,
        queue_id: notif.queue_id || notif.queueId,
        queue_number: notif.queue_number || notif.queueNumber,
        patient_name: notif.patient_name || notif.patientName || profile?.full_name || 'Patient',
        title: notif.title || 'Your Turn!',
        message:
          notif.message ||
          `Hello, ${profile?.full_name || 'Patient'}! Your queue number has been called. Please proceed to the dental clinic.`,
        is_read: false,
        created_at: notif.created_at || notif.createdAt || new Date().toISOString(),
      };

      setNotifications((prev) => {
        // Prevent duplicate IDs in state
        if (prev.some((p) => p.id === normalized.id)) return prev;
        const updated = [normalized, ...prev];
        saveStoredNotifications(user.id, updated);
        return updated;
      });

      // Show immediate visible banner/toast
      setActiveToast(normalized);
      playNotificationChime();
    },
    [user, profile?.full_name]
  );

  // Subscribe to Realtime events
  useEffect(() => {
    if (!user || isAdmin) return;

    loadNotifications();

    // 1. Listen to broadcast channel 'dentalcare_notifications_channel'
    const broadcastChannel = patientSupabase
      .channel('dentalcare_notifications_channel')
      .on('broadcast', { event: 'patient_called' }, (event) => {
        if (event?.payload) {
          handleIncomingNotification(event.payload);
        }
      })
      .subscribe();

    // 2. Listen to postgres_changes on 'notifications' table for this patient
    const dbNotifChannel = patientSupabase
      .channel(`patient_notifications_db_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `patient_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload?.new) {
            handleIncomingNotification(payload.new);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `patient_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload?.new) {
            setNotifications((prev) =>
              prev.map((n) => (n.id === payload.new.id ? { ...n, ...payload.new } : n))
            );
          }
        }
      )
      .subscribe();

    // 3. Listen to postgres_changes on 'queue' table for status changes to 'serving'
    const queueChannel = patientSupabase
      .channel(`patient_queue_listener_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'queue',
          filter: `patient_id=eq.${user.id}`,
        },
        (payload) => {
          const newRow = payload?.new;
          const oldRow = payload?.old;

          if (newRow && newRow.status === 'serving' && (!oldRow || oldRow.status !== 'serving')) {
            const queueNum = formatQueueNumber(newRow.queue_number);
            const patientName = profile?.full_name || 'Patient';
            const dedupeKey = `queue_serving_${newRow.id}_${newRow.called_at || ''}`;

            if (!processedKeysRef.current.has(dedupeKey)) {
              processedKeysRef.current.add(dedupeKey);
              handleIncomingNotification({
                id: `queue_notif_${newRow.id}`,
                patient_id: user.id,
                queue_id: newRow.id,
                queue_number: newRow.queue_number,
                patient_name: patientName,
                title: 'Your Turn!',
                message: `Hello, ${patientName}! Your queue number ${queueNum} has been called. Please proceed to the dental clinic.`,
                is_read: false,
                created_at: newRow.called_at || new Date().toISOString(),
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      patientSupabase.removeChannel(broadcastChannel);
      patientSupabase.removeChannel(dbNotifChannel);
      patientSupabase.removeChannel(queueChannel);
    };
  }, [user, isAdmin, handleIncomingNotification, loadNotifications]);

  const markAsRead = async (id) => {
    if (!id || !user) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    if (activeToast?.id === id) {
      setActiveToast((prev) => (prev ? { ...prev, is_read: true } : null));
    }
    await markNotificationAsRead(id, user.id);
  };

  const markAllAsRead = async () => {
    if (!user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    if (activeToast) {
      setActiveToast((prev) => (prev ? { ...prev, is_read: true } : null));
    }
    await markAllNotificationsAsRead(user.id);
  };

  const openDetailModal = (notification) => {
    setSelectedNotification(notification);
    setIsDetailModalOpen(true);
    if (notification && !notification.is_read) {
      markAsRead(notification.id);
    }
  };

  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedNotification(null);
  };

  const dismissToast = () => {
    setActiveToast(null);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        activeToast,
        dismissToast,
        selectedNotification,
        isDetailModalOpen,
        openDetailModal,
        closeDetailModal,
        markAsRead,
        markAllAsRead,
        refreshNotifications: loadNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
