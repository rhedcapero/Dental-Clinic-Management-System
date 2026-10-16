import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatQueueNumber } from '../components/QueueCard';
import { Activity, Clock, Users, Volume2 } from 'lucide-react';

export const QueueDisplay = () => {
  const [servingPatient, setServingPatient] = useState(null);
  const [waitingList, setWaitingList] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchQueueData = async () => {
    const todayStr = new Date().toISOString().split('T')[0];

    // Helper to query queue records with patient relationship fallback
    const queryQueueWithPatient = async (status, limit, orderCol, ascending) => {
      let res = await supabase
        .from('queue')
        .select('*, patient:patient_id(full_name), dental_services(name)')
        .eq('queue_date', todayStr)
        .eq('status', status)
        .order(orderCol, { ascending })
        .limit(limit);

      if (res.error && res.error.message?.includes('relationship')) {
        res = await supabase
          .from('queue')
          .select('*, profiles:patient_id(full_name), dental_services(name)')
          .eq('queue_date', todayStr)
          .eq('status', status)
          .order(orderCol, { ascending })
          .limit(limit);
      }

      if (res.error && (res.error.message?.includes('schema cache') || res.error.message?.includes('profiles') || res.error.message?.includes('relationship'))) {
        const rawRes = await supabase
          .from('queue')
          .select('*, dental_services(name)')
          .eq('queue_date', todayStr)
          .eq('status', status)
          .order(orderCol, { ascending })
          .limit(limit);

        if (!rawRes.error && rawRes.data) {
          let patRes = await supabase.from('patient').select('id, full_name');
          if (patRes.error) patRes = await supabase.from('profiles').select('id, full_name');
          const pMap = new Map((patRes.data || []).map((p) => [p.id, p]));
          const merged = rawRes.data.map((q) => {
            const p = pMap.get(q.patient_id) || null;
            return { ...q, patient: p, profiles: p };
          });
          return merged;
        }
      }

      return (res.data || []).map((q) => {
        const p = q.patient || q.profiles || null;
        return { ...q, patient: p, profiles: p };
      });
    };

    // 1. Fetch currently serving patient
    const servingData = await queryQueueWithPatient('serving', 1, 'called_at', false);
    if (servingData && servingData.length > 0) {
      setServingPatient(servingData[0]);
    } else {
      setServingPatient(null);
    }

    // 2. Fetch waiting patients for today
    const waitingData = await queryQueueWithPatient('waiting', 10, 'queue_number', true);
    setWaitingList(waitingData || []);
  };

  useEffect(() => {
    fetchQueueData();

    // Subscribe to realtime updates on queue table
    const channel = supabase
      .channel('public_queue_display')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue' },
        () => {
          fetchQueueData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="tv-display-container">
      {/* Top Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1e293b', paddingBottom: '1.25rem', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={28} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', margin: 0 }}>
              DENTAL CARE CLINIC
            </h1>
            <p style={{ color: '#38bdf8', fontSize: '0.9rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Live Patient Queue Monitor
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div className="mono-number" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 700, color: '#f8fafc', lineHeight: 1 }}>
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            {currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </header>

      {/* Main Grid: Now Serving (Hero) vs Waiting List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: '1.75rem', flex: 1 }}>
        {/* NOW SERVING SECTION */}
        <div style={{ background: '#1e293b', borderRadius: '24px', border: '2px solid #0284c7', padding: 'clamp(1.5rem, 4vw, 3rem)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(2, 132, 199, 0.25)' }}>
          <div style={{ background: 'rgba(2, 132, 199, 0.2)', color: '#38bdf8', padding: '0.45rem 1.25rem', borderRadius: '9999px', fontSize: 'clamp(0.9rem, 2vw, 1.2rem)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <Volume2 size={22} />
            <span>NOW SERVING</span>
          </div>

          {servingPatient ? (
            <div>
              <div className="mono-number" style={{ fontSize: 'clamp(3.5rem, 11vw, 7rem)', fontWeight: 900, color: '#38bdf8', lineHeight: 1, letterSpacing: '4px', textShadow: '0 0 30px rgba(56, 189, 248, 0.4)' }}>
                {formatQueueNumber(servingPatient.queue_number)}
              </div>
              <div style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 700, color: '#ffffff', marginTop: '1.25rem' }}>
                {servingPatient.profiles?.full_name || 'Patient'}
              </div>
              <div style={{ fontSize: '1.4rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                {servingPatient.dental_services?.name || 'Dental Treatment'}
              </div>
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '1.5rem', padding: '2rem 0' }}>
              <div className="mono-number" style={{ fontSize: '4.5rem', color: '#334155' }}>---</div>
              <p style={{ marginTop: '1rem' }}>No patient currently being served.</p>
              <p style={{ fontSize: '1rem', color: '#475569' }}>Please wait for the next queue announcement.</p>
            </div>
          )}
        </div>

        {/* WAITING LIST SECTION */}
        <div style={{ background: '#0f172a', borderRadius: '24px', border: '1px solid #1e293b', padding: '2.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={22} color="#f59e0b" />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>WAITING QUEUE</h2>
            </div>
            <span className="badge badge-waiting" style={{ fontSize: '0.85rem' }}>
              {waitingList.length} In Line
            </span>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>
            {waitingList.length > 0 ? (
              waitingList.map((item, index) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#1e293b',
                    padding: '1rem 1.5rem',
                    borderRadius: '12px',
                    border: '1px solid #334155',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ color: '#64748b', fontWeight: 700, fontSize: '1rem', width: '24px' }}>
                      #{index + 1}
                    </span>
                    <span className="mono-number" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff' }}>
                      {formatQueueNumber(item.queue_number)}
                    </span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.95rem' }}>
                      {item.dental_services?.name || 'Dental Service'}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                <p style={{ fontSize: '1.1rem' }}>The waiting queue is currently empty.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
