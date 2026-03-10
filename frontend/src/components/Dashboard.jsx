import React, { useState, useEffect } from 'react';
import CalendarComponent from './CalendarComponent';
import { Calendar, PlusCircle, Trash2 } from 'lucide-react';

export default function Dashboard({ user }) {
  const [appointments, setAppointments] = useState([]);
  const [myAppointments, setMyAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const fetchAppointments = async () => {
    try {
      const [allRes, meRes] = await Promise.all([
        fetch('/api/appointments'),
        fetch('/api/appointments/me', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      if (allRes.ok) setAppointments(await allRes.json());
      if (meRes.ok) setMyAppointments(await meRes.json());
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [user]);

  const handleCreateAppointment = async (dateStr, timeStr) => {
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ date: dateStr, time: timeStr })
      });

      if (res.ok) {
        fetchAppointments();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAppointment = async (id) => {
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (res.ok) {
        fetchAppointments();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '32px' }}>
      <div className="glass-panel animate-fade-in" style={{ padding: '24px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <Calendar color="var(--primary)" /> Calendario de Citas
        </h2>
        <CalendarComponent 
          appointments={appointments} 
          myAppointments={myAppointments}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onCreate={handleCreateAppointment}
          onDelete={id => handleDeleteAppointment(id)}
        />
      </div>

      <div className="glass-panel animate-fade-in" style={{ padding: '24px', height: 'fit-content' }}>
        <h3 style={{ marginBottom: '16px' }}>Mis Citas Actuales</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '16px' }}>
          Aquí se muestran las citas que tienes reservadas en el sistema.
        </p>
        
        {loading ? (
          <p>Cargando...</p>
        ) : myAppointments.length === 0 ? (
          <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '8px', border: '1px dashed var(--border)', textAlign: 'center', color: 'var(--text-muted)' }}>
            No tienes citas activas.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {myAppointments.map(app => (
              <div key={app.id} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'var(--surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{app.date}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{app.time}</div>
                </div>
                <button 
                  onClick={() => handleDeleteAppointment(app.id)}
                  style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)' }}
                  title="Anular cita"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
