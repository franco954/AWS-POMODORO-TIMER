import { useState } from 'react';

export default function SettingsPanel({ settings, onSave, onClose }) {
  const [form, setForm] = useState({
    workDuration:       settings?.workDuration       ?? 25,
    shortBreakDuration: settings?.shortBreakDuration ?? 5,
    longBreakDuration:  settings?.longBreakDuration  ?? 15,
    dailyGoal:          settings?.dailyGoal          ?? 8,
    autoStartBreaks:    settings?.autoStartBreaks    ?? false,
  });
  const [saving, setSaving] = useState(false);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="settings-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="settings-panel" role="dialog" aria-modal="true" aria-label="Configuración">
        <div className="settings-header">
          <h2 className="settings-title">⚙️ Configuración</h2>
          <button id="close-settings" className="btn-icon" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="settings-row">
          <div className="settings-label">
            <strong>Trabajo</strong>
            Duración de sesión Pomodoro
          </div>
          <div className="number-input">
            <input id="work-duration" type="number" min={1} max={90}
              value={form.workDuration}
              onChange={e => update('workDuration', parseInt(e.target.value))} />
            <span>min</span>
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-label">
            <strong>Descanso corto</strong>
            Pausa entre Pomodoros
          </div>
          <div className="number-input">
            <input id="short-break-duration" type="number" min={1} max={30}
              value={form.shortBreakDuration}
              onChange={e => update('shortBreakDuration', parseInt(e.target.value))} />
            <span>min</span>
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-label">
            <strong>Descanso largo</strong>
            Cada 4 Pomodoros
          </div>
          <div className="number-input">
            <input id="long-break-duration" type="number" min={1} max={60}
              value={form.longBreakDuration}
              onChange={e => update('longBreakDuration', parseInt(e.target.value))} />
            <span>min</span>
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-label">
            <strong>Meta diaria</strong>
            Pomodoros por día
          </div>
          <div className="number-input">
            <input id="daily-goal" type="number" min={1} max={20}
              value={form.dailyGoal}
              onChange={e => update('dailyGoal', parseInt(e.target.value))} />
            <span>🍅</span>
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-label">
            <strong>Auto-descanso</strong>
            Iniciar descanso automáticamente
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
            <input id="auto-breaks" type="checkbox"
              checked={form.autoStartBreaks}
              onChange={e => update('autoStartBreaks', e.target.checked)}
              style={{ width:18, height:18, accentColor:'var(--clr-work)' }}
            />
          </label>
        </div>

        <div style={{ marginTop: 28, display:'flex', gap:12, justifyContent:'flex-end' }}>
          <button id="cancel-settings" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button id="save-settings" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <span className="spinner" /> : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
