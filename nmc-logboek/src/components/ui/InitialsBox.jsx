// Klein invoerveld voor de initialen (max 2 letters) van wie het werk heeft
// gedaan. Wordt onder een CheckboxGroup/vink-blok geplaatst.
export default function InitialsBox({ value, onChange }) {
  return (
    <div className="initials-field">
      <label>Initialen</label>
      <input
        value={value || ""}
        maxLength={2}
        placeholder="XX"
        onChange={e => onChange(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2))}
      />
    </div>
  );
}
