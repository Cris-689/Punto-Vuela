import React, { useState, useEffect } from 'react';
import { Bird, User, FileText } from 'lucide-react';

export default function Auth({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [dni, setDni] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [supportNumber, setSupportNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [serviceStatus, setServiceStatus] = useState(null);

  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => setServiceStatus(data.status))
      .catch(err => console.error('Error fetching service status:', err));
  }, []);

  const validateDni = (dni) => {
    // Return true for admin login if needed (although login bypasses this, good to be safe)
    if (dni === 'ElC1g4L4') return true;

    const validChars = 'TRWAGMYFPDXBNJZSQVHLCKET';
    const dniRegex = /^[0-9]{8}[TRWAGMYFPDXBNJZSQVHLCKET]$/i;

    if (!dniRegex.test(dni)) return false;

    const numberString = dni.substring(0, 8);
    const letter = dni.charAt(8).toUpperCase();
    const index = parseInt(numberString, 10) % 23;

    return validChars.charAt(index) === letter;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isRegister && !validateDni(dni)) {
      setError('El DNI introducido no tiene un formato válido.');
      return;
    }

    setLoading(true);

    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    
    try {
      const bodyPayload = isRegister 
        ? { dni, nombre_completo: nombreCompleto, support_number: supportNumber } 
        : { dni, support_number: supportNumber };

      const res = await fetch(`${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyPayload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error de autenticación');
      }

      if (isRegister) {
        // Auto login after register
        const loginRes = await fetch(`/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dni, support_number: supportNumber })
        });
        const loginData = await loginRes.json();
        onLogin(loginData.user, loginData.token);
      } else {
        onLogin(data.user, data.token);
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="glass-panel auth-card animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <Bird size={48} color="var(--primary)" />
        </div>
        <h1>Punto Vuela Citas</h1>
        <p>Sistema de gestión de citas Guadalinfo</p>

        {serviceStatus && (
          <div style={{
            padding: '12px',
            marginBottom: '24px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.95rem',
            backgroundColor: serviceStatus === 'available' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: serviceStatus === 'available' ? 'var(--success)' : 'var(--danger)',
            border: `1px solid ${serviceStatus === 'available' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
          }}>
            {serviceStatus === 'available' ? '🟢 Estamos disponibles' : '🔴 Estamos fuera de servicio'}
          </div>
        )}

        {error && <div style={{ color: 'var(--danger)', marginBottom: '16px', fontSize: '0.875rem', padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={16} /> DNI
            </label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Ej: 12345678A"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              required
            />
          </div>

          {isRegister && (
            <div className="input-group">
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={16} /> Nombre Completo
              </label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Ej: Juan Pérez"
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                required
              />
            </div>
          )}

          <div className="input-group">
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} /> Número de Soporte (Contraseña)
            </label>
            <input 
              type="password" 
              className="input-field" 
              placeholder="Número de soporte de tu DNI"
              value={supportNumber}
              onChange={(e) => setSupportNumber(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? 'Cargando...' : (isRegister ? 'Registrarse' : 'Iniciar Sesión')}
          </button>
        </form>

        <div style={{ marginTop: '24px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {isRegister ? '¿Ya tienes cuenta?' : '¿Es tu primera vez aquí?'}
          <button 
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            style={{ color: 'var(--primary)', fontWeight: 600, marginLeft: '4px', textDecoration: 'underline' }}
          >
            {isRegister ? 'Inicia sesión' : 'Regístrate'}
          </button>
        </div>
      </div>
    </div>
  );
}
