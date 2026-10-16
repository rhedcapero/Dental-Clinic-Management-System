import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { AppointmentForm } from '../../components/AppointmentForm';
import { Calendar, Plus, Clock, AlertCircle, CheckCircle2, X } from 'lucide-react';

export const PatientAppointments = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const fetchAppointments = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, dental_services(name)')
        .eq('patient_id', user.id)
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false });

      if (error) throw error;
      setAppointments(data || []);
    } catch (err) {
      console.error('Error fetching appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [user]);

  const handleCancelAppointment = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) throw error;
      setFeedback({ type: 'success', text: 'Appointment has been cancelled.' });
      fetchAppointments();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to cancel appointment.' });
    }
  };

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>My Appointments</h1>
          <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
            Schedule and manage your upcoming dental visits.
          </p>
        </div>

        <button onClick={() => setShowBookingModal(true)} className="btn btn-primary">
          <Plus size={18} />
          <span>Book Appointment</span>
        </button>
      </div>

      {feedback.text && (
        <div className={`alert ${feedback.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Appointment Booking Modal */}
      {showBookingModal && (
        <div className="modal-overlay" onClick={() => setShowBookingModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={20} color="#15803d" />
                <h2 style={{ fontSize: '1.35rem', margin: 0 }}>Book Dental Appointment</h2>
              </div>
              <button
                onClick={() => setShowBookingModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <AppointmentForm
              onSuccess={() => {
                setShowBookingModal(false);
                setFeedback({ type: 'success', text: 'Appointment booked successfully!' });
                fetchAppointments();
              }}
              onCancel={() => setShowBookingModal(false)}
            />
          </div>
        </div>
      )}

      {/* Appointments List */}
      {appointments.length > 0 ? (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Date</th>
                <th>Time</th>
                <th>Status</th>
                <th>Notes</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appt) => (
                <tr key={appt.id}>
                  <td style={{ fontWeight: 600 }}>{appt.dental_services?.name || 'General Dental'}</td>
                  <td>
                    {new Date(appt.appointment_date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td>{appt.appointment_time.slice(0, 5)}</td>
                  <td>{getStatusBadge(appt.status)}</td>
                  <td style={{ color: '#64748b', fontSize: '0.85rem', maxWidth: '200px' }}>
                    {appt.notes || '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {['pending', 'confirmed'].includes(appt.status) && (
                      <button
                        onClick={() => handleCancelAppointment(appt.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#ef4444' }}
                      >
                        Cancel
                      </button>
                    )}
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
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No appointments found.</h3>
            <p style={{ fontSize: '0.95rem', marginBottom: '1.5rem', maxWidth: '340px', marginInline: 'auto' }}>
              You don't have any appointments scheduled yet. Book your first visit now.
            </p>
            <button onClick={() => setShowBookingModal(true)} className="btn btn-primary">
              Book Appointment
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
