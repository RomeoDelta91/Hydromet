import { useState } from "react";
import { ADMIN_SHIFT, ADMIN_UREN } from "../constants.js";
import { today, nowId } from "../utils.js";
import { checkDuplicate } from "../api.js";
import Field from "./ui/Field.jsx";
import RepeatText from "./ui/RepeatText.jsx";

const DEF_ADMIN = {
  datum: today(),
  administratie: [""],
  onderhoud: [""],
  werkzaamheden_per_uur: Object.fromEntries(ADMIN_UREN.map(u => [u, ""])),
  byz_algemeen: "",
};

function normalizeInitial(initial) {
  const merged = initial ? { ...DEF_ADMIN, ...initial } : { ...DEF_ADMIN, datum: today() };
  if (!Array.isArray(merged.administratie) || merged.administratie.length === 0) merged.administratie = [""];
  if (!Array.isArray(merged.onderhoud) || merged.onderhoud.length === 0) merged.onderhoud = [""];
  merged.werkzaamheden_per_uur = { ...Object.fromEntries(ADMIN_UREN.map(u => [u, ""])), ...(merged.werkzaamheden_per_uur || {}) };
  return merged;
}

export default function AdministratieForm({ onSave, gebruiker, initial }) {
  const [f, setF] = useState(() => normalizeInitial(initial));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));
  const updUur = (uur, v) => setF(p => ({ ...p, werkzaamheden_per_uur: { ...p.werkzaamheden_per_uur, [uur]: v } }));

  const validate = () => {
    const e = {};
    if (!f.datum) e.datum = true;
    if (!f.administratie[0]?.trim()) e.administratie_0 = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const meteoroloog = f.administratie[0] || "";
      if (!f.id) {
        const exists = await checkDuplicate(f.datum, ADMIN_SHIFT, "administratie", meteoroloog);
        if (exists && !window.confirm("Er bestaat al een logboek voor deze datum. Toch doorgaan?")) {
          setSaving(false);
          return;
        }
      }
      await onSave({ ...f, type: "administratie", shift: ADMIN_SHIFT, meteoroloog, id: f.id || nowId(), ts: Date.now(), ingevuld_door: gebruiker });
      setF({ ...DEF_ADMIN, datum: today(), werkzaamheden_per_uur: Object.fromEntries(ADMIN_UREN.map(u => [u, ""])) });
      setErrors({});
    } finally {
      setSaving(false);
    }
  };

  const reqStyle = k => (errors[k] ? { borderColor: "var(--danger)" } : {});

  return (
    <div className="section">
      <div className="card">
        <div className="card-header"><span>📋 Basisgegevens</span></div>
        <div className="card-body">
          <div className="field-grid single">
            <div className="field"><label>Datum {errors.datum && <span style={{ color: "var(--danger)" }}>*</span>}</label><input type="date" value={f.datum} onChange={e => upd("datum", e.target.value)} style={reqStyle("datum")} /></div>
          </div>
          {Object.keys(errors).length > 0 && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 4 }}>Vul de verplichte velden in (*).</p>}
          <div className="field-grid" style={{ marginTop: 8 }}>
            <div>
              <RepeatText label="Administratie" value={f.administratie} onChange={v => upd("administratie", v)} placeholder="Naam" />
              {errors.administratie_0 && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: -4 }}>Vul minimaal één naam in.</p>}
            </div>
            <RepeatText label="Onderhoudmedewerker" value={f.onderhoud} onChange={v => upd("onderhoud", v)} placeholder="Naam" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span>🕐 Werkzaamheden per uur</span></div>
        <div className="card-body">
          {ADMIN_UREN.map(uur => (
            <Field key={uur} label={`${uur} — Verrichte werkzaamheden`} field={uur} val={f.werkzaamheden_per_uur[uur]} onChange={(_, v) => updUur(uur, v)} type="textarea" />
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span>📝 Algemene Bijzonderheden</span></div>
        <div className="card-body"><div className="field-grid single"><Field label="" field="byz_algemeen" val={f.byz_algemeen} onChange={upd} type="textarea" /></div></div>
      </div>

      <div className="ingevuld-bar">Ingevuld door: {gebruiker}</div>
      <button className="btn btn-primary" onClick={submit} disabled={saving} style={{ borderRadius: "0 0 8px 8px" }}>
        {saving ? "Opslaan…" : "✅ Logboek opslaan"}
      </button>
      <div style={{ height: 16 }} />
    </div>
  );
}
