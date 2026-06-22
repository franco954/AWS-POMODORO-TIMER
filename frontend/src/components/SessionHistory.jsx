const TYPE_LABELS = {
  work:        { label: 'Trabajo',        cls: 'work' },
  short_break: { label: 'Descanso corto', cls: 'break' },
  long_break:  { label: 'Descanso largo', cls: 'long' },
};

const fmtTime = (isoStr) => {
  if (!isoStr) return '—';
  return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(isoStr));
};

export default function SessionHistory({ sessions }) {
  if (!sessions.length) return (
    <div className="history-section" style={{ textAlign: 'center', padding: '48px 28px' }}>
      <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🍅</div>
      <p style={{ color: 'var(--clr-text-muted)' }}>Completá tu primera sesión Pomodoro para ver tu historial.</p>
    </div>
  );

  return (
    <section className="history-section" aria-label="Historial de sesiones">
      <div className="section-header">
        <h2 className="section-title">📋 Historial reciente</h2>
        <span style={{ color: 'var(--clr-text-muted)', fontSize: '0.85rem' }}>{sessions.length} sesiones</span>
      </div>
      <div className="session-list">
        {sessions.map((s) => {
          const t    = TYPE_LABELS[s.type] || TYPE_LABELS.work;
          const dur  = s.actualDuration ?? s.duration;
          return (
            <article key={s.sessionId} className="session-item">
              <div className={`session-dot dot-${t.cls}`} aria-hidden="true" />
              <div className="session-info">
                <div className="session-type">{t.label} · {dur} min</div>
                <div className="session-time">{fmtTime(s.startTime)}</div>
              </div>
              <span className={`session-badge badge-${s.status}`}>
                {s.status === 'completed' ? '✓ Completado' : s.status === 'cancelled' ? '✕ Cancelado' : '⏱ Activo'}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
