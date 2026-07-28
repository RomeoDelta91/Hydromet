import { useState } from "react";
import { ADMIN_SHIFT, MAAIWERK_OPTS } from "../constants.js";
import { today, nowId } from "../utils.js";
import { checkDuplicate } from "../api.js";
import Field from "./ui/Field.jsx";
import RepeatText from "./ui/RepeatText.jsx";

const DEF_ADMIN = {
  datum: today(),
  administratie: [""],
  onderhoud: [""],
  werkzaamheden: "",
  onderhoud_notities: "",
  spullen_ontvangen: "",
  spullen_verzonden: "",
  byz_dienstauto: "",
  byz_dienstbus: "",
  byz_hydrofoor: "",
  byz_stroom: "",
  byz_swm: "",
  byz_maaiwerkzaamheden: "",
  byz_toilet: "",
  byz_algemeen: "",
};

// Oudere entries hadden werkzaamheden als per-uur object; migreer die naar één
// vrij tekstveld zodat bestaand werk niet verloren gaat bij het bewerken.
function normalizeInitial(initial) {
  const merged = initial ? { ...DEF_ADMIN, ...initial } : { ...DEF_ADMIN, datum: today() };
  if (!Array.isArray(merged.administratie) || merged.administratie.length === 0) merged.administratie = [""];
  if (!Array.isArray(merged.onderhoud) || merged.onderhoud.length === 0) merged.onderhoud = [""];
  if (typeof merged.werkzaamheden !== "string") {
    merged.werkzaamheden = merged.werkzaamheden_per_uur && typeof merged.werkzaamheden_per_uur === "object"
      ? Object.entries(merged.werkzaamheden_per_uur).filter(([, v]) => v).map(([uur, v]) => `${uur}: ${v}`).join("\n")
      : "";
  }
  return merged;
}

export default function AdministratieForm({ onSave, gebruiker, initial, editMode }) {
  const [f, setF] = useState(() => normalizeInitial(initial));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));

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
      setF({ ...DEF_ADMIN, datum: today() });
      setErrors({});
    } finally {
      setSaving(false);
    }
  };

  const reqStyle = k => (errors[k] ? { borderColor: "var(--danger)" } : {});

  return (
    <div className={`section${editMode ? " chef-edit-mode" : ""}`}>
      {editMode && <div className="chef-edit-banner">✏ U maakt een aantekening als chef/admin — de ingevoerde tekst wordt rood weergegeven zodat de aantekeningen opvallen.</div>}
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
        <div className="card-header"><span>📊 Werkzaamheden-Admin</span></div>
        <div className="card-body">
          <div className="field-grid single"><Field label="" field="werkzaamheden" val={f.werkzaamheden} onChange={upd} type="textarea" /></div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span>🔧 Werkzaamheden-Onderhoud</span></div>
        <div className="card-body"><div className="field-grid single"><Field label="" field="onderhoud_notities" val={f.onderhoud_notities} onChange={upd} type="textarea" /></div></div>
      </div>

      <div className="card">
        <div className="card-header"><span>📦 Spullen ontvangen</span></div>
        <div className="card-body"><div className="field-grid single"><Field label="" field="spullen_ontvangen" val={f.spullen_ontvangen} onChange={upd} type="textarea" /></div></div>
      </div>

      <div className="card">
        <div className="card-header"><span>📤 Spullen verzonden</span></div>
        <div className="card-body"><div className="field-grid single"><Field label="" field="spullen_verzonden" val={f.spullen_verzonden} onChange={upd} type="textarea" /></div></div>
      </div>

      <div className="card">
        <div className="card-header"><span>🚗 Bijzonderheden – Logistiek</span></div>
        <div className="card-body">
          <div className="field-grid">
            <Field label="Dienstauto" field="byz_dienstauto" val={f.byz_dienstauto} onChange={upd} />
            <Field label="Dienstbus" field="byz_dienstbus" val={f.byz_dienstbus} onChange={upd} />
            <Field label="Hydrofoor" field="byz_hydrofoor" val={f.byz_hydrofoor} onChange={upd} />
            <Field label="Stroomonderbrekingen" field="byz_stroom" val={f.byz_stroom} onChange={upd} />
            <Field label="Levering SWM water" field="byz_swm" val={f.byz_swm} onChange={upd} />
            <Field label="Toilet" field="byz_toilet" val={f.byz_toilet} onChange={upd} />
            <div className="field">
              <label>Maaiwerkzaamheden</label>
              <select value={f.byz_maaiwerkzaamheden} onChange={e => upd("byz_maaiwerkzaamheden", e.target.value)}>
                {MAAIWERK_OPTS.map(o => <option key={o} value={o}>{o === "" ? "N.v.t." : o}</option>)}
              </select>
            </div>
          </div>
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
