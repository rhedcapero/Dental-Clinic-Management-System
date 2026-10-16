import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Calendar, Check, X, CheckCheck, UserX, Search, AlertCircle } from 'lucide-react';

export const StaffAppointments = () => {
  const { user, isAdmin } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [queryError, setQueryError] = useState(null);

  const fetchAppointments = async () => {
    setLoading(true);
    setQueryError(null);
    try {
      // Administrator retrieves appointments belonging to ALL patients without filtering by patient_id
      // Query uses the actual database foreign key: patient:patient_id(...) with fallback to profiles
      let res = await supabase
        .from('appointments')
        .select('*, patient:patient_id(full_name, email, phone), dental_services(name)')
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false });

      // Fallback: If PostgREST schema cache looks for profiles instead
      if (res.error && res.error.message?.includes('relationship')) {
        console.warn('Attempting relationship fallback to profiles...');
        res = await supabase
          .from('appointments')
          .select('*, profiles:patient_id(full_name, email, phone), dental_services(name)')
          .order('appointment_date', { ascending: false })
          .order('appointment_time', { ascending: false });
      }

      // Resilient fallback: If relationship embedding encounters schema cache errors, query & merge cleanly
      if (res.error && (res.error.message?.includes('schema cache') || res.error.message?.includes('relationship') || res.error.message?.includes('profiles'))) {
        console.warn('Resolving appointments and patients via decoupled query...');
        const rawAppts = await supabase
          .from('appointments')
          .select('*, dental_services(name)')
          .order('appointment_date', { ascending: false })
          .order('appointment_time', { ascending: false });

        if (!rawAppts.error && rawAppts.data) {
          let patRes = await supabase.from('patient').select('id, full_name, email, phone');
          if (patRes.error) {
            patRes = await supabase.from('profiles').select('id, full_name, email, phone');
          }
          const patientMap = new Map((patRes.data || []).map((p) => [p.id, p]));
          const merged = rawAppts.data.map((a) => {
            const pat = patientMap.get(a.patient_id) || null;
            return {
              ...a,
              patient: pat,
              profiles: pat,
            };
          });
          res = { data: merged, error: null };
        }
      }

      let { data, error } = res;

      // Apply status filter if selected
      if (statusFilter !== 'all' && data) {
        data = data.filter((a) => a.status === statusFilter);
      }

      // Debugging logs as requested (sensitive credentials are not logged)
      console.log('Current authenticated user:', user);
      console.log('Is administrator:', isAdmin);
      console.log('Appointments query result:', data);
      console.log('Appointments query error:', error);

      if (error) {
        setQueryError(error);
        throw error;
      }

      // Normalize so appt.patient and appt.profiles are always available
      const normalizedData = (data || []).map((appt) => {
        const patientData = appt.patient || appt.profiles || null;
        return {
          ...appt,
          patient: patientData,
          profiles: patientData,
        };
      });

      setAppointments(normalizedData);
    } catch (err) {
      console.error('Error fetching appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [statusFilter]);

  const updateStatus = async (id, newStatus) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      fetchAppointments();
    } catch (err) {
      console.error('Error updating appointment:', err);
    }
  };

  const filteredAppointments = appointments.filter((appt) => {
    const patientInfo = appt.patient || appt.profiles || {};
    const patientName = patientInfo.full_name?.toLowerCase() || '';
    const email = patientInfo.email?.toLowerCase() || '';
    const service = appt.dental_services?.name?.toLowerCase() || '';
    const term = searchTerm.toLowerCase();
    return patientName.includes(term) || email.includes(term) || service.includes(term);
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'confirmed':
        return <span className="badge badge-completed">Confirmed</span>;
      case 'completed':
        return <span className="badge badge-serving">Completed</span>;
      case 'cancelled':
        return <span className="badge badge-cancelled">Cancelled</span>;
      case 'no_show':
        return <span className="badge badge-skipped">No Show</span>;
      default:
        return <span className="badge badge-waiting">Pending</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Appointment Management</h1>
        <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
          Review, confirm, and update clinic patient appointments.
        </p>
      </div>

      {queryError && (
        <div className="alert alert-error" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Data Access Notice:</strong> {queryError.message || 'Unable to retrieve appointments.'}
            <div style={{ fontSize: '0.85rem', marginTop: '0.25rem', opacity: 0.9 }}>
              Please verify that your database administrator permissions in <code>public.admins</code> and RLS policies on <code>appointments</code> are active.
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Search patient or service..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['all', 'pending', 'confirmed', 'completed', 'cancelled', 'no_show'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`btn btn-sm ${statusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
              style={{ textTransform: 'capitalize' }}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Appointments Table (Section 17) */}
      {filteredAppointments.length > 0 ? (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Service</th>
                <th>Date</th>
                <th>Time</th>
                <th>Status</th>
                <th>Notes</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.map((appt) => (
                <tr key={appt.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{appt.patient?.full_name || appt.profiles?.full_name || 'Patient'}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{appt.patient?.phone || appt.profiles?.phone || appt.patient?.email || appt.profiles?.email || '—'}</div>
                  </td>
                  <td>{appt.dental_services?.name || 'General Dental'}</td>
                  <td>
                    {new Date(appt.appointment_date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td style={{ fontWeight: 600 }}>{appt.appointment_time.slice(0, 5)}</td>
                  <td>{getStatusBadge(appt.status)}</td>
                  <td style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: '180px' }}>
                    {appt.notes || '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                      {appt.status === 'pending' && (
                        <button
                          onClick={() => updateStatus(appt.id, 'confirmed')}
                          className="btn btn-primary btn-sm"
                          title="Confirm Appointment"
                        >
                          <Check size={14} />
                          <span>Confirm</span>
                        </button>
                      )}

                      {appt.status === 'confirmed' && (
                        <button
                          onClick={() => updateStatus(appt.id, 'completed')}
                          className="btn btn-success btn-sm"
                          title="Mark Completed"
                        >
                          <CheckCheck size={14} />
                          <span>Done</span>
                        </button>
                      )}

                      {['pending', 'confirmed'].includes(appt.status) && (
                        <>
                          <button
                            onClick={() => updateStatus(appt.id, 'no_show')}
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#d97706' }}
                            title="Mark No Show"
                          >
                            <UserX size={14} />
                            <span>No Show</span>
                          </button>
                          <button
                            onClick={() => updateStatus(appt.id, 'cancelled')}
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#ef4444' }}
                            title="Cancel Appointment"
                          >
                            <X size={14} />
                          </button>
                        </>
                      )}
                    </div>
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
              <Calendar size={48} />
            </div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No appointments found</h3>
            <p style={{ color: '#64748b' }}>No records match the chosen search or status filter.</p>
          </div>
        </div>
      )}
    </div>
  );
};
