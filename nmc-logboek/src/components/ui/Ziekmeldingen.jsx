// Ziektemeldingen: per melding tijd, naam en periode. `value` is een array van
// { tijd, naam, periode }. Gedeeld tussen Forecaster- en Observer-formulier.
export const DEF_ZIEK = { tijd: "", naam: "", periode: "" };

export default function Ziekmeldingen({ value, onChange }) {
  const rows = Array.isArray(value) ? value : [];

  const setRow = (idx, key, v) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, [key]: v } : r));
    onChange(next);
  };
  const addRow = () => onChange([...rows, { ...DEF_ZIEK }]);
  const removeRow = idx => onChange(rows.filter((_, i) => i !== idx));

  return (
    <div>
      {rows.map((r, idx) => (
        <div key={idx} className="persoon-block">
          <div className="persoon-block-head">
            <span>Ziekmelding {idx + 1}</span>
            <button type="button" className="btn btn-danger" onClick={() => removeRow(idx)}>× Verwijder</button>
          </div>
          <div className="field-grid">
            <div className="field"><label>Tijd</label><input type="time" value={r.tijd} onChange={e => setRow(idx, "tijd", e.target.value)} /></div>
            <div className="field"><label>Naam</label><input value={r.naam} onChange={e => setRow(idx, "naam", e.target.value)} placeholder="Volledige naam" /></div>
          </div>
          <div className="field-grid single">
            <div className="field"><label>Periode van ziekte</label><input value={r.periode} onChange={e => setRow(idx, "periode", e.target.value)} placeholder="bijv. 1 mei t/m 3 mei" /></div>
          </div>
        </div>
      ))}
      {rows.length === 0 && <p style={{ fontSize: 12, color: "var(--inkLo)", marginBottom: 8 }}>Geen ziekmeldingen.</p>}
      <button type="button" className="btn btn-secondary" onClick={addRow}>+ Ziekmelding toevoegen</button>
    </div>
  );
}
