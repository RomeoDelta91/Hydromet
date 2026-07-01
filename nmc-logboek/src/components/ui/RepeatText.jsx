// Lijst van vrije-tekstvelden met + toevoegen / × verwijderen. Gebruikt voor
// velden waar meerdere personen ingevuld kunnen worden (administratie,
// onderhoud, security). `value` is altijd een array van strings.
export default function RepeatText({ label, value, onChange, placeholder }) {
  const rows = Array.isArray(value) && value.length ? value : [""];

  const setRow = (idx, v) => {
    const next = [...rows];
    next[idx] = v;
    onChange(next);
  };
  const addRow = () => onChange([...rows, ""]);
  const removeRow = idx => {
    const next = rows.filter((_, i) => i !== idx);
    onChange(next.length ? next : [""]);
  };

  return (
    <div className="field">
      <label>{label}</label>
      {rows.map((r, idx) => (
        <div key={idx} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input value={r} placeholder={placeholder} onChange={e => setRow(idx, e.target.value)} style={{ flex: 1 }} />
          {rows.length > 1 && (
            <button type="button" className="btn btn-danger" onClick={() => removeRow(idx)}>×</button>
          )}
        </div>
      ))}
      <button type="button" className="btn btn-secondary" style={{ fontSize: 11, padding: "5px 10px" }} onClick={addRow}>
        + Extra persoon
      </button>
    </div>
  );
}
