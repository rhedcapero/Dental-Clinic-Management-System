import { adminSupabase, patientSupabase } from './supabase';
import { formatQueueNumber } from '../components/QueueCard';

const LOCAL_STORAGE_KEY_PREFIX = 'dentalcare_notifications_';

export const getStoredNotifications = (patientId) => {
  if (typeof window === 'undefined' || !patientId) return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${patientId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to parse cached notifications:', err);
    return [];
  }
};

export const saveStoredNotifications = (patientId, notifications) => {
  if (typeof window === 'undefined' || !patientId) return;
  try {
    localStorage.setItem(
      `${LOCAL_STORAGE_KEY_PREFIX}${patientId}`,
      JSON.stringify(notifications.slice(0, 50))
    );
  } catch (err) {
    console.error('Failed to save notifications in local cache:', err);
  }
};

/**
 * Admin triggers when calling a patient (via "Call Next Patient" or "Call This Patient").
 * Saves to Supabase notifications table and broadcasts a Realtime event.
 */
export const sendCallNotification = async ({
  patientId,
  queueId,
  queueNumber,
  patientName = 'Patient',
}) => {
  if (!patientId) {
    console.warn('sendCallNotification: Missing patientId');
    return null;
  }

  const formattedQueueNum = formatQueueNumber(queueNumber);
  const title = 'Your Turn!';
  const message = `Hello, ${patientName}! Your queue number ${formattedQueueNum} has been called. Please proceed to the dental clinic.`;
  const now = new Date().toISOString();

  let createdNotification = null;

  try {
    // 1. Attempt to persist into Supabase notifications table
    const { data, error } = await adminSupabase
      .from('notifications')
      .insert({
        patient_id: patientId,
        queue_id: queueId,
        title,
        message,
        is_read: false,
        created_at: now,
      })
      .select()
      .maybeSingle();

    if (error) {
      console.warn('Supabase notifications insert notice:', error.message);
    } else if (data) {
      createdNotification = data;
    }
  } catch (err) {
    console.warn('Could not insert notification into DB (table might not exist yet):', err);
  }

  const notificationPayload = {
    id: createdNotification?.id || `notif_${Date.now()}_${queueNumber}`,
    patient_id: patientId,
    queue_id: queueId,
    queue_number: queueNumber,
    patient_name: patientName,
    title,
    message,
    is_read: false,
    created_at: createdNotification?.created_at || now,
  };

  // 2. Broadcast via Supabase Realtime channel so active patient tabs receive instant alert
  try {
    const channel = adminSupabase.channel('dentalcare_notifications_channel');
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'patient_called',
          payload: notificationPayload,
        });
      }
    });

    // In case already subscribed
    channel.send({
      type: 'broadcast',
      event: 'patient_called',
      payload: notificationPayload,
    });
  } catch (broadErr) {
    console.warn('Realtime broadcast notice:', broadErr);
  }

  return notificationPayload;
};

/**
 * Fetch notifications for the authenticated patient
 */
export const fetchPatientNotifications = async (patientId) => {
  if (!patientId) return [];

  let dbNotifications = [];
  try {
    const { data, error } = await patientSupabase
      .from('notifications')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (!error && Array.isArray(data)) {
      dbNotifications = data;
    }
  } catch (err) {
    console.warn('Notice querying DB notifications:', err);
  }

  // Merge with locally cached notifications to ensure no loss
  const cached = getStoredNotifications(patientId);
  const map = new Map();

  // DB takes precedence
  dbNotifications.forEach((item) => {
    map.set(item.id, item);
  });

  // Cached items that are not in DB
  cached.forEach((item) => {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  });

  const merged = Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  saveStoredNotifications(patientId, merged);
  return merged;
};

/**
 * Mark a single notification as read
 */
export const markNotificationAsRead = async (notificationId, patientId) => {
  if (!notificationId) return;

  // 1. Update in Supabase
  try {
    await patientSupabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
  } catch (err) {
    console.warn('Notice updating notification is_read:', err);
  }

  // 2. Update local storage
  if (patientId) {
    const cached = getStoredNotifications(patientId);
    const updated = cached.map((n) =>
      n.id === notificationId ? { ...n, is_read: true } : n
    );
    saveStoredNotifications(patientId, updated);
  }
};

/**
 * Mark all notifications as read for patient
 */
export const markAllNotificationsAsRead = async (patientId) => {
  if (!patientId) return;

  // 1. Update in Supabase
  try {
    await patientSupabase
      .from('notifications')
      .update({ is_read: true })
      .eq('patient_id', patientId)
      .eq('is_read', false);
  } catch (err) {
    console.warn('Notice marking all notifications as read:', err);
  }

  // 2. Update local storage
  const cached = getStoredNotifications(patientId);
  const updated = cached.map((n) => ({ ...n, is_read: true }));
  saveStoredNotifications(patientId, updated);
};
