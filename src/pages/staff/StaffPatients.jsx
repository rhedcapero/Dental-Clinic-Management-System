import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatQueueNumber } from '../../components/QueueCard';
import {
  archivePatient,
  fetchPatientLogs,
} from '../../lib/logsService';
import {
  Users,
  Search,
  Calendar,
  History,
  X,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ClipboardList
} from 'lucide-react';

export const StaffPatients = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Data states
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('active');

  // Loading states
  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals & interaction states
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientAppts, setPatientAppts] = useState([]);
  const [patientQueueHistory, setPatientQueueHistory] = useState([]);
  const [patientToDelete, setPatientToDelete] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Fetch all patients and load history/archive status
  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch patients from public.patient or public.profiles
      let res = await supabase
        .from('patient')
        .select('*')
        .order('created_at', { ascending: false });

      if (
        (res.error || !res.data || res.data.length === 0) &&
        (res.error?.message?.includes('patient') ||
          res.error?.message?.includes('relation') ||
          !res.data ||
          res.data.length === 0)
      ) {
        const profRes = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });
        if (!profRes.error && profRes.data && profRes.data.length > 0) {
          res = profRes;
        }
      }

      const allRecords = res.data || [];
      const patientOnly = allRecords.filter((p) => !p.role || p.role === 'patient');

      // 2. Fetch history records from Supabase / logsService
      const allLogs = await fetchPatientLogs();

      // Filter active patients: exclude any patient currently in logs
      const archivedIds = new Set(allLogs.map((h) => h.patient_id || h.id));
      const activeList = patientOnly.filter((p) => !archivedIds.has(p.id));

      setPatients(activeList);
    } catch (err) {
      console.error('Error fetching patients:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Open Details Modal and fetch records
  const openPatientDetails = async (patient) => {
    setSelectedPatient(patient);
    setModalLoading(true);
    try {
      // 1. Fetch appointments for this patient
      const { data: appts } = await supabase
        .from('appointments')
        .select('*, dental_services(name)')
        .eq('patient_id', patient.id)
        .order('appointment_date', { ascending: false });

      // 2. Fetch queue history for this patient
      const { data: queues } = await supabase
        .from('queue')
        .select('*, dental_services(name)')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false });

      setPatientAppts(appts || []);
      setPatientQueueHistory(queues || []);
    } catch (err) {
      console.error('Error fetching patient records:', err);
    } finally {
      setModalLoading(false);
    }
  };

  // Trigger Delete confirmation dialog
  const handleInitiateDelete = (patient) => {
    setFeedback({ type: '', text: '' });
    setPatientToDelete(patient);
  };

  // Close Delete confirmation dialog without changing any data
  const handleCancelDelete = () => {
    setPatientToDelete(null);
  };

  // Confirm delete: move patient to Logs
  const handleConfirmDelete = async () => {
    if (!patientToDelete || actionLoading) return;
    setActionLoading(true);

    try {
      // Archive patient with actual checkup start/done timestamps
      await archivePatient(patientToDelete, user);

      // Immediately update UI state without page reload
      setPatients((prev) => prev.filter((p) => p.id !== patientToDelete.id));

      setFeedback({
        type: 'success',
        text: `Patient "${patientToDelete.full_name}" has been removed from Active Patients and safely archived to Logs.`,
      });
      setPatientToDelete(null);
    } catch (err) {
      console.error('Error moving patient to logs:', err);
      setFeedback({
        type: 'error',
        text: 'Failed to delete patient. The patient remains active.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Filter Active Patients
  const filteredActivePatients = patients.filter((p) => {
    const term = searchTerm.toLowerCase();
    const name = p.full_name?.toLowerCase() || '';
    const email = p.email?.toLowerCase() || '';
    const phone = p.phone?.toLowerCase() || '';
    return name.includes(term) || email.includes(term) || phone.includes(term);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Patient Directory</h1>
        <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
          Search patient records and view treatment and visit history.
        </p>
      </div>

      {/* Operation Feedback Message */}
      {feedback.text && (
        <div
          className={`alert alert-${feedback.type}`}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            margin: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{feedback.text}</span>
          </div>
          {feedback.type === 'success' && (
            <button
              onClick={() => {
                navigate('/admin/logs');
              }}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.3rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <ClipboardList size={14} />
              <span>View in Logs</span>
            </button>
          )}
        </div>
      )}

      {/* Directory & History View Toggle */}
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          borderBottom: '1px solid #d1e7d8',
          paddingBottom: '0.75rem',
        }}
      >
        <button
          onClick={() => {
            setActiveTab('active');
            setFeedback({ type: '', text: '' });
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.55rem 1.15rem',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeTab === 'active' ? '#dcfce7' : 'transparent',
            color: activeTab === 'active' ? '#15803d' : '#64748b',
            fontWeight: activeTab === 'active' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.95rem',
            transition: 'all 0.15s ease',
          }}
        >
          <Users size={17} />
          <span>Active Patients ({patients.length})</span>
        </button>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', width: '100%', maxWidth: '420px' }}>
        <Search
          size={18}
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#94a3b8',
          }}
        />
        <input
          type="text"
          className="form-input"
          style={{ paddingLeft: '2.5rem' }}
          placeholder="Search active patients by name, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* ACTIVE PATIENTS TAB */}
      {activeTab === 'active' && (
        <>
          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <p style={{ color: '#64748b' }}>Loading patient records...</p>
            </div>
          ) : filteredActivePatients.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Patient Name</th>
                    <th>Email</th>
                    <th>Phone Number</th>
                    <th>Date Registered</th>
                    <th style={{ textAlign: 'center', width: '140px' }}>View Details</th>
                    <th style={{ textAlign: 'center', width: '130px' }}>Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivePatients.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>{p.full_name}</td>
                      <td style={{ color: '#475569' }}>{p.email}</td>
                      <td>{p.phone || '—'}</td>
                      <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        {new Date(p.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      {/* Red circled area: View Details Button */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => openPatientDetails(p)}
                          className="btn btn-secondary btn-sm"
                        >
                          View Details
                        </button>
                      </td>
                      {/* Yellow circled area: Delete Button */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => handleInitiateDelete(p)}
                          className="btn btn-outline-danger btn-sm"
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
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
                  <Users size={48} />
                </div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No patients found</h3>
                <p style={{ color: '#64748b' }}>
                  {searchTerm
                    ? 'Try typing a different name, email, or phone number.'
                    : 'There are currently no active patients registered.'}
                </p>
              </div>
            </div>
          )}
        </>
      )}



      {/* CONFIRMATION DIALOG: DELETE PATIENT */}
      {patientToDelete && (
        <div className="modal-overlay" onClick={handleCancelDelete}>
          <div
            className="modal-content"
            style={{ maxWidth: '480px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={24} color="#dc2626" />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Delete Patient
                </h2>
                <p style={{ color: '#475569', marginTop: '0.5rem', fontSize: '0.95rem', lineHeight: 1.5 }}>
                  Are you sure you want to delete this patient? This action will remove the patient from Active Patients and safely archive their record in the Patient Logs section.
                </p>

                {/* Patient Summary Card */}
                <div
                  style={{
                    marginTop: '0.85rem',
                    padding: '0.75rem 1rem',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.88rem',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{patientToDelete.full_name}</div>
                  <div style={{ color: '#64748b', fontSize: '0.82rem' }}>{patientToDelete.email}</div>
                  {patientToDelete.phone && (
                    <div style={{ color: '#64748b', fontSize: '0.82rem' }}>{patientToDelete.phone}</div>
                  )}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem',
                marginTop: '1.5rem',
                borderTop: '1px solid #f1f5f9',
                paddingTop: '1rem',
              }}
            >
              <button
                onClick={handleCancelDelete}
                className="btn btn-secondary"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="btn btn-danger"
                disabled={actionLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {actionLoading ? (
                  'Deleting...'
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient Details Modal */}
      {selectedPatient && (
        <div className="modal-overlay" onClick={() => setSelectedPatient(null)}>
          <div className="modal-content" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid #f1f5f9',
                paddingBottom: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  {selectedPatient.full_name}
                </h2>
                <div
                  style={{
                    display: 'flex',
                    gap: '1rem',
                    marginTop: '0.35rem',
                    fontSize: '0.85rem',
                    color: '#64748b',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>📧 {selectedPatient.email}</span>
                  {selectedPatient.phone && <span>📞 {selectedPatient.phone}</span>}
                  <span>
                    📅 Registered:{' '}
                    {new Date(selectedPatient.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedPatient(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            {modalLoading ? (
              <p style={{ textAlign: 'center', padding: '2rem 0', color: '#64748b' }}>Loading records...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Appointment History */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.75rem',
                      fontWeight: 700,
                      color: '#0f172a',
                    }}
                  >
                    <Calendar size={18} color="#0284c7" />
                    <span>Appointment History ({patientAppts.length})</span>
                  </div>

                  {patientAppts.length > 0 ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        maxHeight: '200px',
                        overflowY: 'auto',
                      }}
                    >
                      {patientAppts.map((a) => (
                        <div
                          key={a.id}
                          style={{
                            background: '#f8fafc',
                            padding: '0.75rem 1rem',
                            borderRadius: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.9rem',
                          }}
                        >
                          <div>
                            <strong>{a.dental_services?.name || 'Treatment'}</strong>
                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                              {a.appointment_date} at {a.appointment_time?.slice(0, 5)}
                            </div>
                          </div>
                          <span
                            className={`badge ${
                              a.status === 'confirmed'
                                ? 'badge-completed'
                                : a.status === 'completed'
                                ? 'badge-serving'
                                : 'badge-waiting'
                            }`}
                            style={{ fontSize: '0.7rem' }}
                          >
                            {a.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                      No appointment records for this patient.
                    </p>
                  )}
                </div>

                {/* Queue History */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.75rem',
                      fontWeight: 700,
                      color: '#0f172a',
                    }}
                  >
                    <History size={18} color="#0284c7" />
                    <span>Queue Ticket History ({patientQueueHistory.length})</span>
                  </div>

                  {patientQueueHistory.length > 0 ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        maxHeight: '200px',
                        overflowY: 'auto',
                      }}
                    >
                      {patientQueueHistory.map((q) => (
                        <div
                          key={q.id}
                          style={{
                            background: '#f8fafc',
                            padding: '0.75rem 1rem',
                            borderRadius: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.9rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span
                              className="mono-number"
                              style={{ fontWeight: 800, color: '#0284c7' }}
                            >
                              {formatQueueNumber(q.queue_number)}
                            </span>
                            <div>
                              <div>{q.dental_services?.name}</div>
                              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{q.queue_date}</div>
                            </div>
                          </div>
                          <span
                            className={`badge ${
                              q.status === 'completed'
                                ? 'badge-completed'
                                : q.status === 'serving'
                                ? 'badge-serving'
                                : 'badge-waiting'
                            }`}
                            style={{ fontSize: '0.7rem' }}
                          >
                            {q.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                      No queue tickets found for this patient.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
