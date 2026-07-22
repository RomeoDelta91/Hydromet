import { forwardRef } from "react";

// Let op: kleuren zijn hier bewust letterlijke hex-waarden (niet var(--x)).
// Bij het opslaan als PNG wordt de SVG los van de pagina gerenderd, waar
// CSS custom properties niet beschikbaar zijn — dus geen var() in marks.
const INK_MID = "#4A5C70";
const INK = "#1A2433";
const PAPER_MID = "#E8EDF3";

const ROW_H = 28;
const GAP = 10;
const LABEL_W = 170;
const VALUE_W = 46;
const CHART_W = 640;

// Eenvoudige horizontale bar chart, één reeks (dus geen legenda nodig).
// Waarde staat altijd direct naast de balk (geen hover-only info).
const BarChart = forwardRef(function BarChart({ data, color = "#00C896", max, unit = "" }, ref) {
  if (!data || data.length === 0) return <div className="no-data">Geen data.</div>;
  const maxVal = max ?? Math.max(1, ...data.map(d => d.value));
  const barAreaW = CHART_W - LABEL_W - VALUE_W;
  const height = data.length * (ROW_H + GAP) + GAP;

  return (
    <svg ref={ref} width={CHART_W} height={height} viewBox={`0 0 ${CHART_W} ${height}`} style={{ width: "100%", height: "auto", maxWidth: CHART_W }}>
      {data.map((d, i) => {
        const y = GAP + i * (ROW_H + GAP);
        const w = Math.max(2, (Math.max(0, Math.min(maxVal, d.value)) / maxVal) * barAreaW);
        return (
          <g key={d.label}>
            <text x={0} y={y + ROW_H / 2 + 4} fontSize="12" fill={INK_MID} fontFamily="Inter, sans-serif">
              {d.label.length > 22 ? d.label.slice(0, 21) + "…" : d.label}
            </text>
            <rect x={LABEL_W} y={y} width={barAreaW} height={ROW_H} rx={5} fill={PAPER_MID} />
            <rect x={LABEL_W} y={y} width={w} height={ROW_H} rx={5} fill={color} />
            <text x={LABEL_W + barAreaW + 8} y={y + ROW_H / 2 + 4} fontSize="12" fontWeight="600" fill={INK} fontFamily="'IBM Plex Mono', monospace">
              {d.value}{unit}
            </text>
          </g>
        );
      })}
    </svg>
  );
});

export default BarChart;
