export default function Field({ label, field, val, onChange, type = "text", opts, style }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {type === "select" ? (
        <select value={val} onChange={e => onChange(field, e.target.value)} style={style}>
          <option value="">Selecteer…</option>
          {opts.map(o => <option key={o}>{o}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea value={val} onChange={e => onChange(field, e.target.value)} rows={3} style={style} />
      ) : (
        <input type={type} value={val} onChange={e => onChange(field, e.target.value)} style={style} />
      )}
    </div>
  );
}
