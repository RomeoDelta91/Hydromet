// Zoals CheckboxGroup, maar met een eigen 2-letter initialenveld ONDER elk
// afzonderlijk uur — zodat je per tijdstip kunt zien wie het werk deed
// (bijv. 12 UTC door AB, 13 UTC door CD).
export default function CheckboxGroupInit({ label, options, selected, onChangeSelected, initials, onChangeInitials, hint }) {
  const toggle = o => {
    const next = selected.includes(o) ? selected.filter(x => x !== o) : [...selected, o];
    onChangeSelected(next);
  };
  const setInit = (o, v) => {
    const next = { ...(initials || {}), [o]: v.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2) };
    onChangeInitials(next);
  };
  return (
    <div>
      {label && (
        <div className="cb-title">
          {label}
          {hint && <span style={{ fontWeight: 400, textTransform: "none", fontSize: 11, marginLeft: 6, color: "var(--inkLo)" }}>({hint})</span>}
        </div>
      )}
      <div className="cb-row-init">
        {options.map(o => (
          <div key={o} className="cb-init-item">
            <label className={`cb-item${selected.includes(o) ? " checked" : ""}`}>
              <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} />{o}
            </label>
            <input
              className="cb-init-input"
              value={(initials || {})[o] || ""}
              maxLength={2}
              placeholder="XX"
              onChange={e => setInit(o, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
