import React, { useState, useEffect } from 'react';
import { Trash2, UserSearch, Calendar as CalendarIcon, Power, CalendarDays } from 'lucide-react';
import CalendarComponent from './CalendarComponent';

export default function AdminDashboard({ user }) {
  const [allAppointments, setAllAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serviceStatus, setServiceStatus] = useState('available');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const fetchServiceStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setServiceStatus(data.status);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminAppointments = async () => {
    try {
      const res = await fetch('/api/admin/appointments', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllAppointments(Array.isArray(data) ? data : []);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminAppointments();
    fetchServiceStatus();
  }, []);

  const handleToggleStatus = async () => {
    const newStatus = serviceStatus === 'available' ? 'unavailable' : 'available';
    try {
      const res = await fetch('/api/admin/status', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setServiceStatus(newStatus);
      }
    } catch (err) {
      console.error('Error toggling status', err);
    }
  };

  const handleDeleteById = async (id) => {
    if(!window.confirm('¿Seguro que quieres anular esta cita?')) return;

    try {
      const res = await fetch(`/api/admin/appointments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (res.ok) fetchAdminAppointments();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateBlock = async (dateStr, timeStr) => {
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
        fetchAdminAppointments();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filtrar las citas que son bloqueos del administrador
  const adminAppointments = allAppointments.filter(app => app.dni === 'admin');

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <div className="mobile-col" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', gap: '24px' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--primary)' }}>
            <UserSearch size={28} /> Panel de Administración
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Vista global de todas las citas activas en el sistema. Puedes eliminar las citas de los usuarios si es necesario.
          </p>
        </div>
        
        <div style={{ 
          padding: '16px', 
          backgroundColor: 'var(--surface)', 
          border: '1px solid var(--border)', 
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          minWidth: '200px'
        }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)' }}>ESTADO DEL SERVICIO</div>
          <button 
            onClick={handleToggleStatus}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: serviceStatus === 'available' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: serviceStatus === 'available' ? 'var(--success)' : 'var(--danger)',
              transition: 'all 0.2s'
            }}
          >
            <Power size={16} />
            {serviceStatus === 'available' ? 'Disponible (Activo)' : 'Cerrado (Inactivo)'}
          </button>
        </div>
      </div>

        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--primary)' }}>
            <CalendarDays size={28} /> Bloqueo de Horarios
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
            Selecciona una fecha y hora para bloquear ese hueco, indicando que el administrador no estará disponible.
          </p>
          
          <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border)' }}>
             <CalendarComponent 
              appointments={allAppointments} 
              myAppointments={adminAppointments}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onCreate={handleCreateBlock}
              onDelete={handleDeleteById}
            />
          </div>
        </div>

        <div style={{ marginTop: '32px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--primary)' }}>
             <CalendarIcon size={28} /> Listado de Todas las Citas Activas
          </h2>
          {loading ? (
            <p>Cargando datos del servidor...</p>
          ) : allAppointments.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '8px', color: 'var(--text-muted)' }}>
              <CalendarIcon size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
              <div>No hay ninguna cita registrada en el sistema actualmente.</div>
            </div>
          ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {allAppointments.map(app => (
            <div key={app.id} className="admin-list-item" style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '16px 24px', 
              backgroundColor: 'var(--surface)', 
              borderRadius: '8px', 
              border: '1px solid var(--border)' 
            }}>
              <div>
                <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                  {app.date} a las {app.time}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', gap: '16px' }}>
                  {app.dni === 'admin' ? (
                    <span>Nombre: Administrador</span>
                  ) : (
                    <>
                      <span>DNI: {app.dni}</span>
                      <span>Nombre: {app.nombre_completo || 'N/A'}</span>
                    </>
                  )}
                  <span>ID Reserva: #{app.id}</span>
                </div>
              </div>
              <button 
                onClick={() => handleDeleteById(app.id)}
                className="btn btn-danger"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Trash2 size={16} /> Forzar Anulación
              </button>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
