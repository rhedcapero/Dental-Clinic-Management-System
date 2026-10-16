import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Calendar, Clock, FileText, CheckCircle, AlertCircle } from 'lucide-react';

export const AppointmentForm = ({ onSuccess, onCancel }) => {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Available clinic appointment time slots
  const timeSlots = [
    '09:00:00',
    '10:00:00',
    '11:00:00',
    '13:00:00',
    '14:00:00',
    '15:00:00',
    '16:00:00',
  ];

  // Fetch active services
  useEffect(() => {
    const fetchServices = async () => {
      const { data, error } = await supabase
        .from('dental_services')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (data && data.length > 0) {
        setServices(data);
        setServiceId(data[0].id);
      }
    };
    fetchServices();
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!serviceId) {
      setError('Please select a dental service.');
      return;
    }
    if (!date) {
      setError('Please choose an appointment date.');
      return;
    }
    if (!time) {
      setError('Please select an appointment time.');
      return;
    }

    setLoading(true);

    try {
      // Check for double booking (is there an existing confirmed/pending appointment at that date & time?)
      const { data: existingSlots, error: checkError } = await supabase
        .from('appointments')
        .select('id')
        .eq('appointment_date', date)
        .eq('appointment_time', time)
        .in('status', ['pending', 'confirmed']);

      if (checkError) throw checkError;

      if (existingSlots && existingSlots.length > 0) {
        setError('This appointment time is no longer available. Please pick another time slot.');
        setLoading(false);
        return;
      }

      // Insert new appointment
      const { data, error: insertError } = await supabase
        .from('appointments')
        .insert({
          patient_id: user.id,
          service_id: serviceId,
          appointment_date: date,
          appointment_time: time,
          notes: notes.trim(),
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setSuccess(true);
      if (onSuccess) onSuccess(data);
    } catch (err) {
      console.error('Error creating appointment:', err);
      setError(err.message || 'Something went wrong while booking the appointment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <CheckCircle size={18} />
          <span>Appointment booked successfully!</span>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Dental Service</label>
        <select
          className="form-select"
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          required
        >
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.estimated_minutes} mins)
            </option>
          ))}
        </select>
      </div>

      <div className="grid-2col">
        <div className="form-group">
          <label className="form-label">Date</label>
          <input
            type="date"
            className="form-input"
            min={todayStr}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Time</label>
          <select
            className="form-select"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          >
            <option value="">Select Time Slot</option>
            {timeSlots.map((ts) => (
              <option key={ts} value={ts}>
                {ts.slice(0, 5)} {parseInt(ts) >= 12 ? 'PM' : 'AM'}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Notes / Symptoms (Optional)</label>
        <textarea
          rows={3}
          className="form-textarea"
          placeholder="Describe your symptoms or reason for visit..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-secondary">
            Cancel
          </button>
        )}
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? 'Booking...' : 'Confirm Appointment'}
        </button>
      </div>
    </form>
  );
};
