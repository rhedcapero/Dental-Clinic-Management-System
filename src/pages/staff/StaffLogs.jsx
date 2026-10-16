import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchPatientLogs,
  restoreArchivedPatient,
  formatDateTime,
  formatDateOnly,
} from '../../lib/logsService';
import { formatQueueNumber } from '../../components/QueueCard';
import {
  ClipboardList,
  Search,
  Calendar,
  X,
  Phone,
  Mail,
  User,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Activity,
  History as HistoryIcon,
} from 'lucide-react';

export const StaffLogs = () => {

  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Load logs
  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const records = await fetchPatientLogs();
      setLogs(records || []);
    } catch (err) {
      console.error('Failed to load patient logs:', err);
      setFeedback({
        type: 'error',
        text: 'Failed to load archived logs. Please refresh.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Restore patient action
  const handleRestore = async (log) => {
    if (!log) return;
    setActionLoading(true);
    try {
      await restoreArchivedPatient(log.id, log.patient_id);
      setLogs((prev) => prev.filter((item) => item.id !== log.id && item.patient_id !== log.patient_id));
      if (selectedLog && (selectedLog.id === log.id || selectedLog.patient_id === log.patient_id)) {
        setSelectedLog(null);
      }
      setFeedback({
        type: 'success',
        text: `Patient "${log.patient_name}" has been restored to the active Patient Directory.`,
      });
    } catch (err) {
      console.error('Error restoring patient from log:', err);
      setFeedback({
        type: 'error',
        text: 'Failed to restore patient. Please try again.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Filter logs by search term (name or patient ID) and status filter
  const filteredLogs = logs.filter((log) => {
    const term = searchTerm.toLowerCase().trim();
    const nameMatch = log.patient_name?.toLowerCase().includes(term);
    const idMatch = log.patient_id ? String(log.patient_id).toLowerCase().includes(term) : false;
    const emailMatch = log.patient_email ? log.patient_email.toLowerCase().includes(term) : false;
    const matchesSearch = !term || nameMatch || idMatch || emailMatch;

    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    return log.status?.toLowerCase() === statusFilter.toLowerCase();
  });

  // Calculate status summary stats
  const stats = {
    total: logs.length,
    completed: logs.filter((l) => l.status === 'Completed').length,
    inProgress: logs.filter((l) => l.status === 'In Progress').length,
    notStarted: logs.filter((l) => l.status === 'Not Started').length,
  };

  // Helper for Status Badge styling
  const renderStatusBadge = (status) => {
    const norm = (status || 'Unknown').toLowerCase();
    if (norm === 'completed') {
      return (
        <span
          className="badge"
          style={{
            backgroundColor: '#dcfce7',
            color: '#15803d',
            border: '1px solid #86efac',
            fontWeight: 700,
          }}
        >
          Completed
        </span>
      );
    }
    if (norm === 'in progress' || norm === 'serving') {
      return (
        <span
          className="badge"
          style={{
            backgroundColor: '#e0f2fe',
            color: '#0369a1',
            border: '1px solid #7dd3fc',
            fontWeight: 700,
          }}
        >
          In Progress
        </span>
      );
    }
    if (norm === 'not started' || norm === 'waiting') {
      return (
        <span
          className="badge"
          style={{
            backgroundColor: '#fef3c7',
            color: '#b45309',
            border: '1px solid #fde68a',
            fontWeight: 700,
          }}
        >
          Not Started
        </span>
      );
    }
    return (
      <span
        className="badge"
        style={{
          backgroundColor: '#f1f5f9',
          color: '#475569',
          border: '1px solid #cbd5e1',
          fontWeight: 600,
        }}
      >
        {status || 'Unknown'}
      </span>
    );
  };

  // Render Checkup Start Time column
  const renderStartTime = (log) => {
    if (log.status === 'Not Started') {
      return <span style={{ color: '#64748b' }}>Not Started</span>;
    }
    if (log.checkup_start_time) {
      return (
        <span style={{ fontWeight: 600, color: '#0f172a' }}>
          {formatDateTime(log.checkup_start_time)}
        </span>
      );
    }
    return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Not Recorded</span>;
  };

  // Render Checkup Done Time column
  const renderDoneTime = (log) => {
    if (log.status === 'In Progress') {
      return <span style={{ color: '#94a3b8' }}>—</span>;
    }
    if (log.status === 'Not Started') {
      return <span style={{ color: '#94a3b8' }}>—</span>;
    }
    if (log.checkup_completed_time) {
      return (
        <span style={{ fontWeight: 600, color: '#0f172a' }}>
          {formatDateTime(log.checkup_completed_time)}
        </span>
      );
    }
    if (log.status === 'Completed') {
      return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Not Recorded</span>;
    }
    return <span style={{ color: '#94a3b8' }}>—</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Patient Logs
            </h1>
            <span
              style={{
                backgroundColor: '#dcfce7',
                color: '#15803d',
                fontSize: '0.85rem',
                fontWeight: 700,
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                border: '1px solid #86efac',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <ClipboardList size={14} />
              <span>
                {logs.length} Archived {logs.length === 1 ? 'Patient' : 'Patients'}
              </span>
            </span>
          </div>
          <p style={{ color: '#64748b', marginTop: '0.35rem', fontSize: '0.98rem' }}>
            View archived patient records and their checkup history.
          </p>
        </div>

        <button
          onClick={loadLogs}
          disabled={loading}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <RefreshCw size={15} className={loading ? 'spinning' : ''} />
          <span>Refresh Logs</span>
        </button>
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
          <button
            onClick={() => setFeedback({ type: '', text: '' })}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        <div
          className="card"
          style={{
            padding: '1.25rem',
            backgroundColor: '#ffffff',
            borderLeft: '4px solid #166534',
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Total Archived
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>
            {stats.total}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#166534', marginTop: '0.25rem' }}>
            All preserved patient logs
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '1.25rem',
            backgroundColor: '#ffffff',
            borderLeft: '4px solid #15803d',
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Completed Checkups
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#15803d', marginTop: '0.25rem' }}>
            {stats.completed}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
            Finished checkup visits
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '1.25rem',
            backgroundColor: '#ffffff',
            borderLeft: '4px solid #0284c7',
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            In Progress
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0284c7', marginTop: '0.25rem' }}>
            {stats.inProgress}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
            Archived during treatment
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '1.25rem',
            backgroundColor: '#ffffff',
            borderLeft: '4px solid #d97706',
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Not Started
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#d97706', marginTop: '0.25rem' }}>
            {stats.notStarted}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
            Prior to checkup start
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        {/* Search bar for Patient Name or Patient ID */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '440px' }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
            }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.6rem', width: '100%' }}
            placeholder="Search by patient name or patient ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '2px',
              }}
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Status Filter buttons */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setStatusFilter('all')}
            className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              textTransform: 'capitalize',
              fontSize: '0.85rem',
              padding: '0.4rem 0.85rem',
            }}
          >
            All
          </button>
        </div>
      </div>

      {/* Patient Logs Table */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
          <RefreshCw size={28} className="spinning" style={{ color: '#166534', margin: '0 auto 1rem' }} />
          <p style={{ color: '#64748b', fontWeight: 600 }}>Loading patient logs...</p>
        </div>
      ) : filteredLogs.length > 0 ? (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Patient Name</th>
                <th>Patient ID</th>
                <th>Checkup Start Time</th>
                <th>Checkup Done Time</th>
                <th>Date Deleted</th>
                <th>Status</th>
                <th style={{ textAlign: 'center', width: '150px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id || log.patient_id}>
                  {/* Patient Name */}
                  <td>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{log.patient_name}</div>
                    {log.patient_email && (
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{log.patient_email}</div>
                    )}
                  </td>

                  {/* Patient ID */}
                  <td>
                    {log.patient_id ? (
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.85rem',
                          backgroundColor: '#f1f5f9',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          color: '#334155',
                          border: '1px solid #e2e8f0',
                        }}
                        title={log.patient_id}
                      >
                        {log.patient_id.length > 12
                          ? `${log.patient_id.slice(0, 8)}...`
                          : log.patient_id}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>—</span>
                    )}
                  </td>

                  {/* Checkup Start Time */}
                  <td style={{ fontSize: '0.88rem' }}>{renderStartTime(log)}</td>

                  {/* Checkup Done Time */}
                  <td style={{ fontSize: '0.88rem' }}>{renderDoneTime(log)}</td>

                  {/* Date Deleted */}
                  <td style={{ fontSize: '0.85rem', color: '#475569' }}>
                    {formatDateTime(log.archived_at) || formatDateOnly(log.archived_at)}
                  </td>

                  {/* Status */}
                  <td>{renderStatusBadge(log.status)}</td>

                  {/* View Details Action */}
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                      >
                        View Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : logs.length === 0 ? (
        /* Empty State: No logs in system */
        <div className="card">
          <div className="empty-state" style={{ padding: '3.5rem 1rem' }}>
            <div
              className="empty-state-icon"
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#f0fdf4',
                color: '#166534',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}
            >
              <ClipboardList size={32} />
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
              No patient logs available
            </h3>
            <p style={{ color: '#64748b', maxWidth: '440px', margin: '0 auto', lineHeight: 1.5 }}>
              Archived patient records, checkup start timestamps, and visit histories will automatically appear here whenever a patient is deleted from the Patient Directory.
            </p>
          </div>
        </div>
      ) : (
        /* Empty State: Filter or Search yielded 0 results */
        <div className="card">
          <div className="empty-state" style={{ padding: '3rem 1rem' }}>
            <div className="empty-state-icon">
              <Search size={36} />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: '#0f172a' }}>
              No matching records found
            </h3>
            <p style={{ color: '#64748b' }}>
              No archived patients match "{searchTerm}". Try checking your spelling or clearing search filters.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
              }}
              className="btn btn-secondary btn-sm"
              style={{ marginTop: '1rem' }}
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* Patient Log Details Modal */}
      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    {selectedLog.patient_name}
                  </h2>
                  {renderStatusBadge(selectedLog.status)}
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '1rem',
                    marginTop: '0.5rem',
                    fontSize: '0.85rem',
                    color: '#64748b',
                    flexWrap: 'wrap',
                  }}
                >
                  {selectedLog.patient_email && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Mail size={14} /> {selectedLog.patient_email}
                    </span>
                  )}
                  {selectedLog.patient_phone && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Phone size={14} /> {selectedLog.patient_phone}
                    </span>
                  )}
                  {selectedLog.patient_id && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <User size={14} /> ID: <code style={{ fontSize: '0.8rem' }}>{selectedLog.patient_id}</code>
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Checkup & Visit Details Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '1.15rem',
                }}
              >
                <h3
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    marginBottom: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <Activity size={17} color="#166534" />
                  <span>Checkup & Visit Record</span>
                </h3>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '0.85rem',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                      Final Checkup Status
                    </div>
                    <div style={{ marginTop: '0.2rem' }}>{renderStatusBadge(selectedLog.status)}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                      Checkup Start Time
                    </div>
                    <div style={{ marginTop: '0.2rem', fontSize: '0.9rem' }}>
                      {renderStartTime(selectedLog)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                      Checkup Completion Time
                    </div>
                    <div style={{ marginTop: '0.2rem', fontSize: '0.9rem' }}>
                      {renderDoneTime(selectedLog)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                      Date & Time Archived
                    </div>
                    <div style={{ marginTop: '0.2rem', fontSize: '0.9rem', color: '#0f172a', fontWeight: 600 }}>
                      {formatDateTime(selectedLog.archived_at) || formatDateOnly(selectedLog.archived_at)}
                    </div>
                  </div>
                </div>

                {/* Service & Appointment info if available */}
                {(selectedLog.service_name || selectedLog.appointment_date) && (
                  <div
                    style={{
                      marginTop: '0.85rem',
                      paddingTop: '0.85rem',
                      borderTop: '1px solid #e2e8f0',
                      display: 'flex',
                      gap: '1.5rem',
                      flexWrap: 'wrap',
                      fontSize: '0.85rem',
                    }}
                  >
                    {selectedLog.service_name && (
                      <div>
                        <span style={{ color: '#64748b' }}>Dental Service: </span>
                        <strong>{selectedLog.service_name}</strong>
                      </div>
                    )}
                    {selectedLog.appointment_date && (
                      <div>
                        <span style={{ color: '#64748b' }}>Appointment: </span>
                        <strong>
                          {selectedLog.appointment_date}
                          {selectedLog.appointment_time ? ` at ${selectedLog.appointment_time.slice(0, 5)}` : ''}
                        </strong>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Historical Appointments */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.75rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    fontSize: '0.95rem',
                  }}
                >
                  <Calendar size={17} color="#0284c7" />
                  <span>
                    Preserved Appointment History (
                    {selectedLog.appointment_details?.length || 0})
                  </span>
                </div>

                {selectedLog.appointment_details && selectedLog.appointment_details.length > 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      maxHeight: '160px',
                      overflowY: 'auto',
                    }}
                  >
                    {selectedLog.appointment_details.map((a) => (
                      <div
                        key={a.id}
                        style={{
                          background: '#f8fafc',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '8px',
                          border: '1px solid #f1f5f9',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.88rem',
                        }}
                      >
                        <div>
                          <strong>{a.dental_services?.name || 'Treatment Visit'}</strong>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            {a.appointment_date} {a.appointment_time ? `at ${a.appointment_time.slice(0, 5)}` : ''}
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
                  <p style={{ color: '#94a3b8', fontSize: '0.88rem', fontStyle: 'italic', margin: 0 }}>
                    No prior appointment entries recorded for this patient.
                  </p>
                )}
              </div>

              {/* Historical Queue Tickets */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.75rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    fontSize: '0.95rem',
                  }}
                >
                  <HistoryIcon size={17} color="#166534" />
                  <span>
                    Preserved Queue History ({selectedLog.queue_details?.length || 0})
                  </span>
                </div>

                {selectedLog.queue_details && selectedLog.queue_details.length > 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      maxHeight: '160px',
                      overflowY: 'auto',
                    }}
                  >
                    {selectedLog.queue_details.map((q) => (
                      <div
                        key={q.id}
                        style={{
                          background: '#f8fafc',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '8px',
                          border: '1px solid #f1f5f9',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.88rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span
                            className="mono-number"
                            style={{ fontWeight: 800, color: '#166534', fontSize: '0.9rem' }}
                          >
                            {formatQueueNumber(q.queue_number)}
                          </span>
                          <div>
                            <div>{q.dental_services?.name || 'Clinic Visit'}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {q.queue_date}
                              {q.called_at ? ` • Started: ${formatDateTime(q.called_at)}` : ''}
                              {q.completed_at ? ` • Done: ${formatDateTime(q.completed_at)}` : ''}
                            </div>
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
                  <p style={{ color: '#94a3b8', fontSize: '0.88rem', fontStyle: 'italic', margin: 0 }}>
                    No queue ticket records found for this patient.
                  </p>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '1.75rem',
                borderTop: '1px solid #e2e8f0',
                paddingTop: '1rem',
              }}
            >
              <button
                onClick={() => handleRestore(selectedLog)}
                disabled={actionLoading}
                className="btn btn-secondary btn-sm"
                style={{
                  color: '#15803d',
                  borderColor: '#86efac',
                  backgroundColor: '#f0fdf4',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
                title="Restore patient back to the active Patient Directory"
              >
                <RotateCcw size={15} />
                <span>Restore Patient</span>
              </button>

              <button
                onClick={() => setSelectedLog(null)}
                className="btn btn-secondary"
                style={{ padding: '0.45rem 1.25rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
