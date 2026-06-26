export default function CheckboxGroup({ label, options, selected, onChange, hint }) {
  const toggle = o => {
    const next = selected.includes(o) ? selected.filter(x => x !== o) : [...selected, o];
    onChange(next);
  };
  return (
    <div>
      {label && (
        <div className="cb-title">
          {label}
          {hint && <span style={{ fontWeight: 400, textTransform: "none", fontSize: 11, marginLeft: 6, color: "var(--inkLo)" }}>({hint})</span>}
        </div>
      )}
      <div className="cb-row">
        {options.map(o => (
          <label key={o} className={`cb-item${selected.includes(o) ? " checked" : ""}`}>
            <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} />{o}
          </label>
        ))}
      </div>
    </div>
  );
}
