import { useState, useEffect, useRef, useCallback } from 'react';
import { createSession, completeSession, getSessions, getStats, getSettings, saveSettings } from '../services/api';
import SettingsPanel from './SettingsPanel';
import SessionHistory from './SessionHistory';
import StatsBar from './StatsBar';

const MODES = {
  work:        { label: 'Trabajo',        key: 'work',        defaultMin: 25 },
  short_break: { label: 'Descanso corto', key: 'short_break', defaultMin: 5  },
  long_break:  { label: 'Descanso largo', key: 'long_break',  defaultMin: 15 },
};

export default function TimerPage({ user, onSignOut, addToast }) {
  const [mode, setMode]           = useState('work');
  const [timeLeft, setTimeLeft]   = useState(25 * 60);
  const [running, setRunning]     = useState(false);
  const [settings, setSettings]   = useState(null);
  const [stats, setStats]         = useState(null);
  const [sessions, setSessions]   = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [showSettings, setShowSettings]   = useState(false);
  const [loadingData, setLoadingData]     = useState(true);

  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);

  // ── Load initial data ─────────────────────────────────────────
  useEffect(() => {
    Promise.all([getSettings(), getStats(), getSessions({ limit: 20 })])
      .then(([s, st, sess]) => {
        setSettings(s);
        setStats(st);
        setSessions(sess.sessions || []);
        setTimeLeft(s.workDuration * 60);
      })
      .catch(() => addToast('Error cargando datos. Reintentando...', 'error'))
      .finally(() => setLoadingData(false));
  }, []);

  // ── Timer tick ────────────────────────────────────────────────
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  // ── Duration for current mode ─────────────────────────────────
  const getDuration = useCallback((m = mode) => {
    if (!settings) return MODES[m].defaultMin;
    return m === 'work'
      ? settings.workDuration
      : m === 'short_break'
      ? settings.shortBreakDuration
      : settings.longBreakDuration;
  }, [settings, mode]);

  // ── Switch mode (only when not running) ───────────────────────
  const switchMode = (newMode) => {
    if (running) return;
    setMode(newMode);
    setTimeLeft(getDuration(newMode) * 60);
    setActiveSession(null);
  };

  // ── Start timer ───────────────────────────────────────────────
  const handleStart = async () => {
    if (running) return;
    try {
      const duration = getDuration();
      const session  = await createSession(mode, duration);
      setActiveSession({ ...session, duration });
      startTimeRef.current = session.startTime;
      setRunning(true);
      addToast(`⏱ ${MODES[mode].label} iniciado`, 'info');
    } catch (e) {
      addToast('Error al iniciar sesión. Verificá tu conexión.', 'error');
    }
  };

  // ── Pause timer ───────────────────────────────────────────────
  const handlePause = () => setRunning(false);
  const handleResume = () => setRunning(true);

  // ── Reset timer ───────────────────────────────────────────────
  const handleReset = async () => {
    setRunning(false);
    setTimeLeft(getDuration() * 60);
    if (activeSession) {
      try {
        await completeSession(activeSession.sessionId, activeSession.startTime, 'cancelled', null);
      } catch {}
      setActiveSession(null);
    }
  };

  // ── Timer completed ───────────────────────────────────────────
  const handleTimerComplete = async () => {
    setRunning(false);
    if (!activeSession) return;

    const actualDuration = getDuration();
    try {
      await completeSession(activeSession.sessionId, activeSession.startTime, 'completed', actualDuration);
      addToast(`🎉 ¡${MODES[mode].label} completado! +${actualDuration} min`, 'success');

      // Refresh stats & history
      const [newStats, newSessions] = await Promise.all([getStats(), getSessions({ limit: 20 })]);
      setStats(newStats);
      setSessions(newSessions.sessions || []);
    } catch (e) {
      addToast('Error al guardar sesión', 'error');
    }
    setActiveSession(null);

    // Vibrate if supported
    if (navigator.vibrate) navigator.vibrate([300, 100, 300]);

    // Auto-switch to break if work completed
    if (mode === 'work' && settings?.autoStartBreaks) {
      setTimeout(() => switchMode('short_break'), 1500);
    }
  };

  // ── Save settings ─────────────────────────────────────────────
  const handleSaveSettings = async (newSettings) => {
    try {
      const saved = await saveSettings(newSettings);
      setSettings(saved);
      setShowSettings(false);
      if (!running) setTimeLeft(getDuration() * 60);
      addToast('Configuración guardada ✓', 'success');
    } catch {
      addToast('Error al guardar configuración', 'error');
    }
  };

  // ── Progress calculation ──────────────────────────────────────
  const totalSecs    = getDuration() * 60;
  const progress     = timeLeft / totalSecs;
  const RADIUS       = 120;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const strokeOffset  = CIRCUMFERENCE * (1 - progress);

  const modeClass   = mode === 'work' ? 'work' : mode === 'short_break' ? 'break' : 'long';
  const activeClass = `active-${modeClass}`;

  const fmt = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (loadingData) return (
    <div className="loading-screen"><div className="spinner" /><span>Cargando...</span></div>
  );

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="header-inner">
            <div className="logo">
              <span className="logo-emoji">🍅</span>
              Pomodoro
            </div>
            <div className="nav-actions">
              {stats?.all?.streak > 0 && (
                <div className="streak-badge">
                  🔥 {stats.all.streak} {stats.all.streak === 1 ? 'día' : 'días'}
                </div>
              )}
              <button id="settings-btn" className="btn-icon" onClick={() => setShowSettings(true)} title="Configuración">⚙️</button>
              <button id="signout-btn" className="btn btn-ghost" onClick={onSignOut}>Salir</button>
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="container">

          {/* Mode Tabs */}
          <div className="mode-tabs" role="tablist" aria-label="Modo de sesión">
            {Object.entries(MODES).map(([key, m]) => (
              <button
                key={key}
                id={`tab-${key}`}
                role="tab"
                aria-selected={mode === key}
                className={`mode-tab ${mode === key ? activeClass : ''}`}
                onClick={() => switchMode(key)}
                disabled={running}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Timer */}
          <section className="timer-section" aria-label="Temporizador">
            <div className="timer-ring-wrap">
              <svg className="timer-ring" viewBox="0 0 280 280" aria-hidden="true">
                <defs>
                  <linearGradient id="grad-work" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#dc2626" />
                  </linearGradient>
                  <linearGradient id="grad-break" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#0891b2" />
                  </linearGradient>
                  <linearGradient id="grad-long" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a78bfa" />
                    <stop offset="100%" stopColor="#7c3aed" />
                  </linearGradient>
                </defs>
                <circle className="timer-ring-bg" cx="140" cy="140" r={RADIUS} />
                <circle
                  className={`timer-ring-progress ring-${modeClass}`}
                  cx="140" cy="140" r={RADIUS}
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={strokeOffset}
                />
              </svg>
              <div className="timer-display">
                <span className="timer-time" aria-live="polite" aria-atomic="true">{fmt(timeLeft)}</span>
                <span className="timer-label">{MODES[mode].label}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="timer-controls">
              <button id="reset-btn" className="btn-icon" onClick={handleReset} title="Reiniciar" aria-label="Reiniciar temporizador">↺</button>
              {!running ? (
                <button
                  id="start-btn"
                  className={`btn-timer-main btn-${modeClass}`}
                  onClick={handleStart}
                  aria-label="Iniciar temporizador"
                >▶</button>
              ) : (
                <button
                  id="pause-btn"
                  className={`btn-timer-main btn-${modeClass}`}
                  onClick={handlePause}
                  aria-label="Pausar temporizador"
                >⏸</button>
              )}
              {!running && activeSession && (
                <button id="resume-btn" className="btn-icon" onClick={handleResume} aria-label="Reanudar">▶▶</button>
              )}
              {running && <div style={{width:44}} />}
            </div>
          </section>

          {/* Stats */}
          {stats && <StatsBar stats={stats} />}

          {/* Session History */}
          <SessionHistory sessions={sessions} />
        </div>
      </main>

      {/* Settings panel */}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
