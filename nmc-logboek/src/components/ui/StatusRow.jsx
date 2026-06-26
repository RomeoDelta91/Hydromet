import { STATUS_OPTS } from "../../constants.js";

export default function StatusRow({ label, field, val, onChange }) {
  return (
    <div className="status-row">
      <label>{label}</label>
      <select value={val} onChange={e => onChange(field, e.target.value)}>
        {STATUS_OPTS.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}
