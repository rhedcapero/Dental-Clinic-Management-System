import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { PatientForm } from '../../components/PatientForm';
import { User, Shield } from 'lucide-react';

export const PatientProfile = () => {
  const { profile } = useAuth();

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>My Profile</h1>
        <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
          Update your contact details to help our clinic team reach you.
        </p>
      </div>

      <div className="card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={28} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>{profile?.full_name || 'Patient'}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem' }}>
              <span className="badge badge-waiting" style={{ fontSize: '0.7rem' }}>
                Account Role: {profile?.role || 'patient'}
              </span>
            </div>
          </div>
        </div>

        <PatientForm initialData={profile} />
      </div>
    </div>
  );
};
