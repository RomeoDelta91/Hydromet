// Eenvoudige horizontale bar chart, één reeks (dus geen legenda nodig).
// Waarde staat altijd direct naast de balk (geen hover-only info).
export default function BarChart({ data, color = "var(--green)", max, unit = "" }) {
  if (!data || data.length === 0) return <div className="no-data">Geen data.</div>;
  const maxVal = max ?? Math.max(1, ...data.map(d => d.value));
  return (
    <div className="bar-chart">
      {data.map(d => (
        <div key={d.label} className="bar-chart-row">
          <span className="bar-chart-label">{d.label}</span>
          <div className="bar-chart-track">
            <div className="bar-chart-fill" style={{ width: `${Math.max(0, Math.min(100, (d.value / maxVal) * 100))}%`, background: color }} />
          </div>
          <span className="bar-chart-value">{d.value}{unit}</span>
        </div>
      ))}
    </div>
  );
}
