export default function StatsBar({ stats }) {
  const { today, week, all } = stats;

  const cards = [
    { label: 'Hoy',      value: today.sessionsCompleted, unit: 'sesiones', cls: 'work' },
    { label: 'Esta semana', value: week.sessionsCompleted, unit: 'sesiones',  cls: 'cyan' },
    { label: 'Hoy min',  value: today.minutesFocused,    unit: 'minutos',  cls: 'violet' },
    { label: 'Total hrs', value: all.totalHours,          unit: 'horas',    cls: 'green' },
    { label: 'Racha',    value: `${all.streak}🔥`,        unit: 'días',     cls: 'work' },
    { label: 'Total',    value: all.sessionsCompleted,    unit: 'total',    cls: 'cyan' },
  ];

  return (
    <div className="stats-grid" aria-label="Estadísticas">
      {cards.map((c, i) => (
        <div key={i} className="stat-card">
          <div className={`stat-value ${c.cls}`}>{c.value}</div>
          <div className="stat-label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
