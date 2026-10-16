import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Phone, Mail, CheckCircle2, AlertCircle } from 'lucide-react';

export const PatientForm = ({ initialData, onSaved }) => {
  const { updateProfile } = useAuth();
  const [fullName, setFullName] = useState(initialData?.full_name || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!fullName.trim()) {
      setMessage({ type: 'error', text: 'Please enter your full name.' });
      return;
    }

    setLoading(true);
    try {
      const updated = await updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
      });
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      if (onSaved) onSaved(updated);
    } catch (err) {
      console.error('Error updating profile:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {message.text && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Full Name</label>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="form-input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="e.g. Juan Dela Cruz"
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Email Address (Read-only)</label>
        <input
          type="email"
          className="form-input"
          value={initialData?.email || ''}
          disabled
        />
        <small style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.25rem' }}>
          Email address is tied to your login account and cannot be modified directly.
        </small>
      </div>

      <div className="form-group">
        <label className="form-label">Phone Number</label>
        <input
          type="tel"
          className="form-input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g. 09123456789"
        />
      </div>

      <button type="submit" disabled={loading} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
        {loading ? 'Saving changes...' : 'Save Changes'}
      </button>
    </form>
  );
};
