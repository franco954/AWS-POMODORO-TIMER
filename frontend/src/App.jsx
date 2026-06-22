import { useState, useEffect, useCallback } from 'react';
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import AuthPage from './components/AuthPage';
import TimerPage from './components/TimerPage';

export default function App() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts]   = useState([]);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <span>Cargando...</span>
    </div>
  );

  return (
    <>
      <div className="app-bg" />

      {user ? (
        <TimerPage user={user} onSignOut={handleSignOut} addToast={addToast} />
      ) : (
        <AuthPage onAuthSuccess={setUser} addToast={addToast} />
      )}

      {/* Toast container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}</span>
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
}
