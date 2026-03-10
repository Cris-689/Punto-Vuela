import React, { useState, useEffect } from 'react';
import { Bird, LogOut } from 'lucide-react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import './index.css';

function App() {
  const [user, setUser] = useState(null);

  // Check simple session
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
  };

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="app-container animate-fade-in">
      <header className="main-header">
        <div className="brand">
          <Bird size={28} color="var(--primary)" />
          <span>Punto Vuela Citas</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>DNI: {user.dni}</span>
          <button className="btn btn-danger" onClick={handleLogout} style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
            <LogOut size={16} /> Salir
          </button>
        </div>
      </header>
      <main className="main-content">
        {user.dni === 'admin' ? <AdminDashboard user={user} /> : <Dashboard user={user} />}
      </main>
    </div>
  );
}

export default App;
