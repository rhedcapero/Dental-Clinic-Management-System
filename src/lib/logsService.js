import { supabase } from './supabase';

export const STORAGE_KEY_LOGS = 'dentalcare_patient_logs';
export const STORAGE_KEY_LEGACY_HISTORY = 'dentalcare_patient_history';

/**
 * Standard date and time formatter across the application.
 * Formats ISO timestamps into human-readable format e.g. "Oct 15, 2026, 09:30 AM".
 */
export const formatDateTime = (isoString) => {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Standard date formatter e.g. "Oct 15, 2026".
 */
export const formatDateOnly = (dateString) => {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Reads logs from localStorage fallback.
 */
export const getLocalLogs = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOGS);
    if (raw) return JSON.parse(raw);
    // Legacy migration fallback if available
    const legacy = localStorage.getItem(STORAGE_KEY_LEGACY_HISTORY);
    if (legacy) {
      const parsedLegacy = JSON.parse(legacy);
      return parsedLegacy.map((item) => ({
        id: item.id,
        patient_id: item.patient_id || item.id,
        patient_name: item.full_name || item.patient_name || 'Unknown Patient',
        patient_email: item.email || item.patient_email || '',
        patient_phone: item.phone || item.patient_phone || '',
        status: item.status || 'Not Started',
        checkup_start_time: item.checkup_start_time || null,
        checkup_completed_time: item.checkup_completed_time || null,
        archived_at: item.archived_at || item.created_at || new Date().toISOString(),
        archived_by: item.archived_by || null,
        service_name: item.service_name || null,
        appointment_date: item.appointment_date || null,
        appointment_time: item.appointment_time || null,
      }));
    }
    return [];
  } catch (err) {
    console.warn('Could not read logs from localStorage:', err);
    return [];
  }
};

/**
 * Saves logs to localStorage fallback.
 */
export const saveLocalLogs = (logs) => {
  try {
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
  } catch (err) {
    console.warn('Could not write logs to localStorage:', err);
  }
};

/**
 * Fetch all archived patient logs.
 * Combines Supabase patient_logs, patient_history, and local storage fallback.
 */
export const fetchPatientLogs = async () => {
  let dbLogs = [];
  let dbLogsFound = false;

  // 1. Try querying public.patient_logs
  try {
    const { data, error } = await supabase
      .from('patient_logs')
      .select('*')
      .order('archived_at', { ascending: false });

    if (!error && data) {
      dbLogs = data;
      dbLogsFound = true;
    }
  } catch (err) {
    console.warn('Notice querying patient_logs table:', err);
  }

  // 2. If patient_logs table is missing or empty, check legacy patient_history
  if (!dbLogsFound || dbLogs.length === 0) {
    try {
      const { data: hData, error: hErr } = await supabase
        .from('patient_history')
        .select('*')
        .order('archived_at', { ascending: false });

      if (!hErr && hData && hData.length > 0) {
        const normalizedHistory = hData.map((h) => ({
          id: h.id,
          patient_id: h.patient_id || h.id,
          patient_name: h.full_name || 'Unknown Patient',
          patient_email: h.email || '',
          patient_phone: h.phone || '',
          status: h.status || 'Not Started',
          checkup_start_time: h.checkup_start_time || null,
          checkup_completed_time: h.checkup_completed_time || null,
          archived_at: h.archived_at || h.created_at || new Date().toISOString(),
          archived_by: h.archived_by || null,
        }));
        if (dbLogs.length === 0) {
          dbLogs = normalizedHistory;
        }
      }
    } catch (err) {
      console.warn('Notice querying patient_history table:', err);
    }
  }

  // 3. Merge with local storage fallback
  const localLogs = getLocalLogs();
  const logsMap = new Map();

  // Local logs first
  localLogs.forEach((item) => {
    const key = item.id || item.patient_id;
    if (key) logsMap.set(key, item);
  });

  // Supabase records override / augment
  dbLogs.forEach((item) => {
    const key = item.id || item.patient_id;
    if (key) {
      const existing = logsMap.get(key);
      logsMap.set(key, { ...existing, ...item });
    }
  });

  const merged = Array.from(logsMap.values()).sort(
    (a, b) => new Date(b.archived_at || 0) - new Date(a.archived_at || 0)
  );

  // Sync back to local storage
  if (merged.length > 0) {
    saveLocalLogs(merged);
  }

  return merged;
};

/**
 * Returns a Set of patient IDs that are currently archived in Logs.
 */
export const getArchivedPatientIds = async () => {
  const allLogs = await fetchPatientLogs();
  return new Set(allLogs.map((l) => l.patient_id || l.id).filter(Boolean));
};

/**
 * Archive a patient record when the administrator deletes them.
 * Captures real checkup start & completed timestamps from Queue / Appointments.
 * Prevents duplicate log entries.
 */
export const archivePatient = async (patient, currentUser) => {
  if (!patient || !patient.id) {
    throw new Error('Valid patient record is required for archiving.');
  }

  // 1. Check if patient is already in logs to prevent duplicates
  const existingLogs = getLocalLogs();
  const alreadyLogged = existingLogs.find(
    (l) => l.patient_id === patient.id || l.id === patient.id
  );

  if (alreadyLogged) {
    console.warn(`Patient ${patient.id} is already in logs. Skipping duplicate entry.`);
    return alreadyLogged;
  }

  // 2. Fetch real appointment history for this patient
  let appointments = [];
  try {
    const { data: apptData } = await supabase
      .from('appointments')
      .select('*, dental_services(name)')
      .eq('patient_id', patient.id)
      .order('appointment_date', { ascending: false });
    if (apptData) appointments = apptData;
  } catch (err) {
    console.warn('Could not query appointments for patient archive:', err);
  }

  // 3. Fetch real queue history for this patient
  let queueRecords = [];
  try {
    const { data: queueData } = await supabase
      .from('queue')
      .select('*, dental_services(name)')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false });
    if (queueData) queueRecords = queueData;
  } catch (err) {
    console.warn('Could not query queue for patient archive:', err);
  }

  // 4. Identify latest queue record and latest appointment
  const latestQueue = queueRecords.length > 0 ? queueRecords[0] : null;
  const latestAppt = appointments.length > 0 ? appointments[0] : null;

  // 5. Determine actual checkup timestamps from system data (no fake times!)
  let checkupStartTime = null;
  let checkupDoneTime = null;
  let status = 'Not Started';

  if (latestQueue) {
    // If patient had a queue ticket
    if (latestQueue.called_at) {
      checkupStartTime = latestQueue.called_at;
    }
    if (latestQueue.completed_at) {
      checkupDoneTime = latestQueue.completed_at;
    }

    if (latestQueue.status === 'completed') {
      status = 'Completed';
    } else if (latestQueue.status === 'serving') {
      status = 'In Progress';
      checkupDoneTime = null; // Completion time must remain empty if in progress
    } else if (latestQueue.status === 'waiting') {
      status = 'Not Started';
      checkupStartTime = null;
      checkupDoneTime = null;
    } else {
      status = latestQueue.status === 'skipped' ? 'Skipped' : 'Cancelled';
    }
  } else if (latestAppt) {
    // Patient only had appointment
    if (latestAppt.status === 'completed') {
      status = 'Completed';
      // If appointment was marked completed but no specific queue called_at exists,
      // we leave checkupStartTime and checkupDoneTime as null so UI displays "Not Recorded"
    } else if (latestAppt.status === 'confirmed' || latestAppt.status === 'pending') {
      status = 'Not Started';
    } else if (latestAppt.status === 'cancelled') {
      status = 'Cancelled';
    } else {
      status = 'Not Started';
    }
  } else {
    // No prior records found
    status = 'Not Started';
  }

  const nowIso = new Date().toISOString();
  const logId = crypto.randomUUID ? crypto.randomUUID() : `${patient.id}_${Date.now()}`;

  const logRecord = {
    id: logId,
    patient_id: patient.id,
    patient_name: patient.full_name || 'Unknown Patient',
    patient_email: patient.email || '',
    patient_phone: patient.phone || '',
    appointment_id: latestAppt?.id || null,
    queue_id: latestQueue?.id || null,
    service_name: latestQueue?.dental_services?.name || latestAppt?.dental_services?.name || null,
    appointment_date: latestAppt?.appointment_date || null,
    appointment_time: latestAppt?.appointment_time || null,
    checkup_start_time: checkupStartTime,
    checkup_completed_time: checkupDoneTime,
    status: status,
    archived_at: nowIso,
    archived_by: currentUser?.id || null,
    appointment_details: appointments,
    queue_details: queueRecords,
    created_at: patient.created_at || nowIso,
  };

  // 6. Persist to Supabase patient_logs table
  try {
    const { error: dbErr } = await supabase
      .from('patient_logs')
      .upsert(logRecord, { onConflict: 'id' });

    if (dbErr) {
      console.warn('Note: Supabase patient_logs write:', dbErr.message);
    }
  } catch (err) {
    console.warn('Exception persisting to patient_logs:', err);
  }

  // 7. Backward compatibility: also upsert to patient_history
  try {
    await supabase.from('patient_history').upsert({
      id: patient.id,
      patient_id: patient.id,
      full_name: patient.full_name,
      email: patient.email,
      phone: patient.phone || '',
      role: patient.role || 'patient',
      created_at: patient.created_at,
      archived_at: nowIso,
      archived_by: currentUser?.id || null,
    }, { onConflict: 'id' });
  } catch (err) {
    // Silently continue
  }

  // 8. Update local storage
  const updatedLogs = [logRecord, ...existingLogs.filter((l) => l.patient_id !== patient.id && l.id !== logId)];
  saveLocalLogs(updatedLogs);

  // Also update legacy history local storage
  try {
    const currentLegacy = localStorage.getItem(STORAGE_KEY_LEGACY_HISTORY);
    const parsedLegacy = currentLegacy ? JSON.parse(currentLegacy) : [];
    const updatedLegacy = [
      {
        id: patient.id,
        patient_id: patient.id,
        full_name: patient.full_name,
        email: patient.email,
        phone: patient.phone || '',
        created_at: patient.created_at,
        archived_at: nowIso,
      },
      ...parsedLegacy.filter((i) => i.id !== patient.id),
    ];
    localStorage.setItem(STORAGE_KEY_LEGACY_HISTORY, JSON.stringify(updatedLegacy));
  } catch (e) {
    // Ignore
  }

  return logRecord;
};

/**
 * Restore an archived patient back to active patients directory.
 */
export const restoreArchivedPatient = async (logId, patientId) => {
  const targetPatientId = patientId || logId;

  // 1. Delete from Supabase patient_logs
  try {
    await supabase.from('patient_logs').delete().or(`id.eq.${logId},patient_id.eq.${targetPatientId}`);
  } catch (err) {
    console.warn('Notice deleting from patient_logs:', err);
  }

  // 2. Delete from Supabase patient_history
  try {
    await supabase.from('patient_history').delete().eq('id', targetPatientId);
  } catch (err) {
    console.warn('Notice deleting from patient_history:', err);
  }

  // 3. Remove from local storage
  const currentLogs = getLocalLogs();
  const updatedLogs = currentLogs.filter(
    (l) => l.id !== logId && l.patient_id !== targetPatientId
  );
  saveLocalLogs(updatedLogs);

  // Remove from legacy local storage
  try {
    const legacy = localStorage.getItem(STORAGE_KEY_LEGACY_HISTORY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      localStorage.setItem(
        STORAGE_KEY_LEGACY_HISTORY,
        JSON.stringify(parsed.filter((item) => item.id !== targetPatientId))
      );
    }
  } catch (e) {
    // Ignore
  }

  return true;
};
