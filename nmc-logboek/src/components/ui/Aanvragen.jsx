import { AANVRAAG_OPTS } from "../../constants.js";

// Aanvragen: per aanvraag een type (Compensatie/Verlof), naam en periode.
// `value` is een array van { type, naam, periode }. Gedeeld tussen beide formulieren.
export const DEF_AANVRAAG = { type: AANVRAAG_OPTS[0], naam: "", periode: "" };

export default function Aanvragen({ value, onChange }) {
  const rows = Array.isArray(value) ? value : [];

  const setRow = (idx, key, v) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, [key]: v } : r));
    onChange(next);
  };
  const addRow = () => onChange([...rows, { ...DEF_AANVRAAG }]);
  const removeRow = idx => onChange(rows.filter((_, i) => i !== idx));

  return (
    <div>
      {rows.map((r, idx) => (
        <div key={idx} className="persoon-block">
          <div className="persoon-block-head">
            <span>Aanvraag {idx + 1}</span>
            <button type="button" className="btn btn-danger" onClick={() => removeRow(idx)}>× Verwijder</button>
          </div>
          <div className="field-grid">
            <div className="field"><label>Type</label>
              <select value={r.type} onChange={e => setRow(idx, "type", e.target.value)}>
                {AANVRAAG_OPTS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="field"><label>Naam</label><input value={r.naam} onChange={e => setRow(idx, "naam", e.target.value)} placeholder="Volledige naam" /></div>
          </div>
          <div className="field-grid single">
            <div className="field"><label>Periode</label><input value={r.periode} onChange={e => setRow(idx, "periode", e.target.value)} placeholder="bijv. 10 mei t/m 14 mei" /></div>
          </div>
        </div>
      ))}
      {rows.length === 0 && <p style={{ fontSize: 12, color: "var(--inkLo)", marginBottom: 8 }}>Geen aanvragen.</p>}
      <button type="button" className="btn btn-secondary" onClick={addRow}>+ Aanvraag toevoegen</button>
    </div>
  );
}
