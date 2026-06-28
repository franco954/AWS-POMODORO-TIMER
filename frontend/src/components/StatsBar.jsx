export default function StatsBar({ stats }) {
  const { today } = stats;

  const cards = [
    { label: 'Pomodoros hoy', value: today.sessionsCompleted, cls: 'work' },
    { label: 'Tiempo hoy',    value: `${today.minutesFocused} min`, cls: 'violet' },
  ];

  return (
    <div className="stats-grid stats-grid-two" aria-label="Estadísticas">
      {cards.map((c, i) => (
        <div key={i} className="stat-card">
          <div className={`stat-value ${c.cls}`}>{c.value}</div>
          <div className="stat-label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
