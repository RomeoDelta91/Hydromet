import { forwardRef } from "react";

// Letterlijke hex-kleuren i.p.v. var(--x) — zie toelichting in BarChart.jsx.
const INK_MID = "#4A5C70";
const INK = "#1A2433";
const PAPER_MID = "#E8EDF3";

const CHART_W = 640;
const CHART_H = 300;
const PAD_L = 36;
const PAD_R = 16;
const PAD_T = 20;
const PAD_B = 56;

// Eenvoudige lijngrafiek, één reeks. Categorieën op de x-as, waarden op de
// y-as. Elk punt heeft een directe waarde-label (dataset is klein/categorisch,
// geen dichte tijdreeks, dus geen anti-pattern van "een getal op elk punt").
const LineChart = forwardRef(function LineChart({ data, color = "#00C896", max, unit = "" }, ref) {
  if (!data || data.length === 0) return <div className="no-data">Geen data.</div>;
  const maxVal = max ?? Math.max(1, ...data.map(d => d.value));
  const plotW = CHART_W - PAD_L - PAD_R;
  const plotH = CHART_H - PAD_T - PAD_B;
  const stepX = data.length > 1 ? plotW / (data.length - 1) : 0;

  const xAt = i => PAD_L + (data.length > 1 ? i * stepX : plotW / 2);
  const yAt = v => PAD_T + plotH - (Math.max(0, Math.min(maxVal, v)) / maxVal) * plotH;

  const gridSteps = 4;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const frac = i / gridSteps;
    return { y: PAD_T + plotH - frac * plotH, val: Math.round(maxVal * frac) };
  });

  const pathD = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(d.value)}`).join(" ");

  return (
    <svg ref={ref} width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ width: "100%", height: "auto", maxWidth: CHART_W }}>
      {gridLines.map(g => (
        <g key={g.y}>
          <line x1={PAD_L} x2={CHART_W - PAD_R} y1={g.y} y2={g.y} stroke={PAPER_MID} strokeWidth={1} />
          <text x={PAD_L - 8} y={g.y + 4} fontSize="10" fill={INK_MID} textAnchor="end" fontFamily="'IBM Plex Mono', monospace">{g.val}</text>
        </g>
      ))}

      <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {data.map((d, i) => (
        <g key={d.label}>
          <circle cx={xAt(i)} cy={yAt(d.value)} r={4} fill={color} stroke="#fff" strokeWidth={2} />
          <text x={xAt(i)} y={yAt(d.value) - 10} fontSize="11" fontWeight="600" fill={INK} textAnchor="middle" fontFamily="'IBM Plex Mono', monospace">
            {d.value}{unit}
          </text>
          <text
            x={xAt(i)} y={CHART_H - PAD_B + 18} fontSize="10" fill={INK_MID} textAnchor="middle" fontFamily="Inter, sans-serif"
            transform={data.length > 6 ? `rotate(-30 ${xAt(i)} ${CHART_H - PAD_B + 18})` : undefined}
          >
            {d.label.length > 14 ? d.label.slice(0, 13) + "…" : d.label}
          </text>
        </g>
      ))}
    </svg>
  );
});

export default LineChart;
