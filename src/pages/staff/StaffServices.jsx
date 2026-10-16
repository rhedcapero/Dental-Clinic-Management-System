import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Briefcase, Plus, Check, X, AlertCircle, CheckCircle2 } from 'lucide-react';

export const StaffServices = () => {
  const [services, setServices] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const fetchServices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('dental_services')
        .select('*')
        .order('name');
      if (error) throw error;
      setServices(data || []);
    } catch (err) {
      console.error('Error fetching dental services:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleAddService = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', text: '' });
    if (!name.trim()) return;

    try {
      const { error } = await supabase
        .from('dental_services')
        .insert({
          name: name.trim(),
          description: description.trim(),
          estimated_minutes: parseInt(minutes, 10) || 30,
          is_active: true,
        });

      if (error) throw error;
      setShowAddModal(false);
      setName('');
      setDescription('');
      setMinutes(30);
      setFeedback({ type: 'success', text: 'Dental service added successfully!' });
      fetchServices();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to add service.' });
    }
  };

  const toggleServiceActive = async (id, currentStatus) => {
    try {
      const { error } = await supabase
        .from('dental_services')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      fetchServices();
    } catch (err) {
      console.error('Error toggling service status:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Dental Services</h1>
          <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
            Manage the list of clinic procedures, estimated treatment durations, and availability.
          </p>
        </div>

        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
          <Plus size={18} />
          <span>Add New Service</span>
        </button>
      </div>

      {feedback.text && (
        <div className={`alert ${feedback.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Add Service Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.35rem', margin: 0 }}>Add Dental Service</h2>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddService} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Service Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Root Canal Therapy"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Estimated Treatment Time (Minutes)</label>
                <input
                  type="number"
                  className="form-input"
                  min="5"
                  max="240"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Explain what this treatment involves..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Services Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Service Name</th>
              <th>Description</th>
              <th>Estimated Duration</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td style={{ fontWeight: 700, color: '#0f172a' }}>{s.name}</td>
                <td style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '350px' }}>
                  {s.description || '—'}
                </td>
                <td style={{ fontWeight: 600 }}>{s.estimated_minutes} mins</td>
                <td>
                  <span className={`badge ${s.is_active ? 'badge-completed' : 'badge-cancelled'}`}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    onClick={() => toggleServiceActive(s.id, s.is_active)}
                    className="btn btn-secondary btn-sm"
                  >
                    {s.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
