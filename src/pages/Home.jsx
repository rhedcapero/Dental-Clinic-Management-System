import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Activity,
  UserCheck,
  Ticket,
  Clock,
  ShieldCheck,
  Calendar,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  Tv
} from 'lucide-react';

export const Home = () => {
  const [services, setServices] = useState([]);

  useEffect(() => {
    const fetchServices = async () => {
      const { data } = await supabase
        .from('dental_services')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (data) setServices(data);
    };
    fetchServices();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Hero Section */}
      <section style={{ background: 'linear-gradient(135deg, #0f172a 0%, #14532d 55%, #15803d 100%)', color: '#ffffff', padding: 'clamp(3rem, 7vw, 5rem) 1.25rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h1 style={{ fontSize: 'clamp(2rem, 5.5vw, 3.25rem)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: '1.25rem', color: '#ffffff' }}>
            Your Smile, <span style={{ color: '#86efac' }}>Our Care.</span>
          </h1>

          <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)', color: '#dcfce7', maxWidth: '650px', margin: '0 auto 2.5rem', lineHeight: 1.6 }}>
            Manage your dental appointments and track your queue in real time from your mobile phone or desktop without sitting endlessly in a crowded lobby.
          </p>

          <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
            <Link to="/patient/dashboard" className="btn btn-primary btn-lg" style={{ background: '#22c55e', color: '#0f172a', fontWeight: 700, border: 'none', boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)' }}>
              <span>Patient Portal</span>
              <ChevronRight size={18} />
            </Link>

            <Link to="/register" className="btn btn-secondary btn-lg" style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', borderColor: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(4px)' }}>
              <span>New Patient Register</span>
            </Link>

            <Link to="/display" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-lg" style={{ background: '#15803d', color: '#fff', borderColor: '#15803d' }}>
              <Tv size={18} />
              <span>Waiting Room Display</span>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works (Section 26) */}
      <section style={{ padding: 'clamp(2.5rem, 6vw, 4.5rem) 1.25rem', background: '#f8fafc' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
            Simple & Fast
          </div>
          <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.25rem)', fontWeight: 800, marginBottom: '2.5rem' }}>
            How It Works in 3 Easy Steps
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '1.5rem' }}>
            <div className="card" style={{ textAlign: 'left', position: 'relative' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                <UserCheck size={24} />
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase' }}>Step 1</div>
              <h3 style={{ fontSize: '1.25rem', margin: '0.35rem 0 0.75rem' }}>1. Register Online</h3>
              <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
                Create your patient profile securely in less than a minute. Your medical visits and history stay organized in one place.
              </p>
            </div>

            <div className="card" style={{ textAlign: 'left', position: 'relative' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#ccfbf1', color: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                <Ticket size={24} />
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0d9488', textTransform: 'uppercase' }}>Step 2</div>
              <h3 style={{ fontSize: '1.25rem', margin: '0.35rem 0 0.75rem' }}>2. Get Queue Ticket</h3>
              <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
                Choose your dental treatment (extraction, cleaning, consultation) and instantly receive your daily sequential queue ticket.
              </p>
            </div>

            <div className="card" style={{ textAlign: 'left', position: 'relative' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                <Clock size={24} />
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase' }}>Step 3</div>
              <h3 style={{ fontSize: '1.25rem', margin: '0.35rem 0 0.75rem' }}>3. Wait For Your Turn</h3>
              <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
                Monitor the clinic's live currently serving number and how many patients are ahead of you with real-time updates.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dental Services Section */}
      <section style={{ padding: 'clamp(2.5rem, 6vw, 4.5rem) 1.25rem', background: '#ffffff' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
              Comprehensive Treatments
            </div>
            <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.25rem)', fontWeight: 800 }}>Our Dental Services</h2>
            <p style={{ color: '#64748b', marginTop: '0.5rem' }}>
              Professional dentistry delivered with gentle care and modern equipment.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '1.5rem' }}>
            {services.length > 0 ? (
              services.map((s) => (
                <div key={s.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: '#0f172a' }}>{s.name}</h3>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1rem' }}>{s.description}</p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: '#15803d', fontWeight: 600 }}>
                      Approx. {s.estimated_minutes} minutes
                    </span>
                    <Link to="/patient/queue" className="btn btn-secondary btn-sm">Queue Now</Link>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ textAlign: 'center', gridColumn: '1 / -1', color: '#94a3b8' }}>Loading services from database...</p>
            )}
          </div>
        </div>
      </section>

      {/* Clinic Contact & Footer */}
      <footer style={{ background: '#0f172a', color: '#94a3b8', padding: 'clamp(2.5rem, 5vw, 4rem) 1.25rem 2rem', marginTop: 'auto' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', fontWeight: 800, fontSize: '1.25rem', marginBottom: '0.75rem' }}>
              <Activity color="#4ade80" />
              <span>DentalCare Clinic</span>
            </div>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
              Providing quality dental health care with real-time digital queuing and seamless appointment scheduling.
            </p>
          </div>

          <div>
            <h4 style={{ color: '#fff', fontSize: '1rem', marginBottom: '1rem' }}>Quick Links</h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
              <li><Link to="/login" style={{ color: '#cbd5e1' }}>Patient Login</Link></li>
              <li><Link to="/register" style={{ color: '#cbd5e1' }}>Patient Registration</Link></li>
              <li><Link to="/admin" style={{ color: '#cbd5e1' }}>Administrator Portal</Link></li>
              <li><Link to="/display" style={{ color: '#cbd5e1' }}>Live Waiting Room Display</Link></li>
            </ul>
          </div>

          <div>
            <h4 style={{ color: '#fff', fontSize: '1rem', marginBottom: '1rem' }}>Contact Information</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPin size={16} color="#4ade80" />
                <span>123 Healthcare Ave, Medical Center</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Phone size={16} color="#4ade80" />
                <span>+1 (555) 019-2834</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Mail size={16} color="#4ade80" />
                <span>appointments@dentalcare.com</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: '0.85rem', borderTop: '1px solid #1e293b', paddingTop: '1.5rem' }}>
          &copy; {new Date().getFullYear()} DentalCare Clinic Queue System. All rights reserved.
        </div>
      </footer>
    </div>
  );
};
