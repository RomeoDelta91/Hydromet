import { useState } from "react";
import { SHIFTS, NOTAM_SHIFTS, WEB_PRODUCTS } from "../constants.js";
import { today, nowId } from "../utils.js";
import { checkDuplicate } from "../api.js";
import Field from "./ui/Field.jsx";
import StatusRow from "./ui/StatusRow.jsx";

const DEF_F = {
  datum: today(),
  shift: "",
  meteoroloog: "",
  werktijd_van: "",
  werktijd_tot: "",
  verwachtingen: "",
  com_telefoon: "OK",
  com_internet: "OK",
  com_amhs: "OK",
  com_awos: "OK",
  inst_aws: "OK",
  inst_awos: "OK",
  inst_pc_lhb: "OK",
  inst_radar: "OK",
  inst_werkmobiel: "OK",
  inst_charger: "OK",
  wu_products: [],
  wu_anders: "",
  notam_verzonden: false,
  notam_shifts: [],
  notam_opmerkingen: "",
  byz_dienstauto: "",
  byz_dienstbus: "",
  byz_hydrofoor: "",
  byz_stroom: "",
  byz_swm: "",
  byz_airlines: "",
  byz_operations: "",
  byz_atc: "",
  byz_toren: "",
  byz_algemeen: "",
};

export default function ForecasterForm({ onSave, gebruiker, initial }) {
  const [f, setF] = useState(initial ? { ...DEF_F, ...initial } : { ...DEF_F, datum: today() });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    if (!f.datum) e.datum = true;
    if (!f.meteoroloog) e.meteoroloog = true;
    if (!f.shift) e.shift = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (!f.id) {
        const exists = await checkDuplicate(f.datum, f.shift, "forecaster", f.meteoroloog);
        if (exists && !window.confirm("Er bestaat al een logboek voor deze datum/shift/meteoroloog. Toch doorgaan?")) {
          setSaving(false);
          return;
        }
      }
      await onSave({ ...f, type: "forecaster", id: f.id || nowId(), ts: Date.now(), ingevuld_door: gebruiker });
      setF({ ...DEF_F, datum: today() });
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
          <div className="field-grid">
            <div className="field"><label>Datum {errors.datum && <span style={{ color: "var(--danger)" }}>*</span>}</label><input type="date" value={f.datum} onChange={e => upd("datum", e.target.value)} style={reqStyle("datum")} /></div>
            <div className="field"><label>Shift {errors.shift && <span style={{ color: "var(--danger)" }}>*</span>}</label><select value={f.shift} onChange={e => upd("shift", e.target.value)} style={reqStyle("shift")}><option value="">Selecteer…</option>{SHIFTS.map(s => <option key={s}>{s}</option>)}</select></div>
          </div>
          <div className="field-grid single">
            <div className="field"><label>Meteoroloog {errors.meteoroloog && <span style={{ color: "var(--danger)" }}>*</span>}</label><input value={f.meteoroloog} onChange={e => upd("meteoroloog", e.target.value)} style={reqStyle("meteoroloog")} placeholder="Volledige naam" /></div>
          </div>
          <div className="field-grid">
            <div className="field"><label>Werktijd van (LT)</label><input type="time" value={f.werktijd_van} onChange={e => upd("werktijd_van", e.target.value)} /></div>
            <div className="field"><label>Werktijd tot (LT)</label><input type="time" value={f.werktijd_tot} onChange={e => upd("werktijd_tot", e.target.value)} /></div>
          </div>
          {!f.werktijd_van && !f.werktijd_tot && (
            <p style={{ fontSize: 11, color: "var(--warn)", marginTop: -4, marginBottom: 4 }}>Aanbevolen: vul uw exacte werktijden in (LT) voor de persoonsanalyse.</p>
          )}
          {Object.keys(errors).length > 0 && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 4 }}>Vul de verplichte velden in (*).</p>}
          <div className="field-grid single" style={{ marginTop: 8 }}>
            <Field label="Verwachtingen uitgebracht" field="verwachtingen" val={f.verwachtingen} onChange={upd} type="textarea" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span>📡 Communicatie</span></div>
        <div className="card-body">
          <StatusRow label="Telefoon" field="com_telefoon" val={f.com_telefoon} onChange={upd} />
          <StatusRow label="Internet" field="com_internet" val={f.com_internet} onChange={upd} />
          <StatusRow label="AMHS" field="com_amhs" val={f.com_amhs} onChange={upd} />
          <StatusRow label="AWOS" field="com_awos" val={f.com_awos} onChange={upd} />
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span>🛰 Instrumenten</span></div>
        <div className="card-body">
          <StatusRow label="AWS" field="inst_aws" val={f.inst_aws} onChange={upd} />
          <StatusRow label="AWOS" field="inst_awos" val={f.inst_awos} onChange={upd} />
          <StatusRow label="PC LHB" field="inst_pc_lhb" val={f.inst_pc_lhb} onChange={upd} />
          <StatusRow label="RADAR" field="inst_radar" val={f.inst_radar} onChange={upd} />
          <StatusRow label="Werkmobiel" field="inst_werkmobiel" val={f.inst_werkmobiel} onChange={upd} />
          <StatusRow label="Charger" field="inst_charger" val={f.inst_charger} onChange={upd} />
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span>🌐 Web Upload</span></div>
        <div className="card-body">
          <div className="cb-title" style={{ marginBottom: 8 }}>Producten geüpload deze shift</div>
          <div className="wu-grid">
            {WEB_PRODUCTS.map(p => (
              <label key={p} className={`cb-item${f.wu_products.includes(p) ? " checked" : ""}`}>
                <input type="checkbox" checked={f.wu_products.includes(p)} onChange={() => {
                  const next = f.wu_products.includes(p) ? f.wu_products.filter(x => x !== p) : [...f.wu_products, p];
                  upd("wu_products", next);
                }} />{p}
              </label>
            ))}
          </div>
          <div style={{ marginTop: 10 }}><Field label="Anders (omschrijf)" field="wu_anders" val={f.wu_anders} onChange={upd} /></div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span>✈️ NOTAMs</span></div>
        <div className="card-body">
          <label className={`cb-item${f.notam_verzonden ? " checked" : ""}`} style={{ display: "inline-flex", marginBottom: 10 }}>
            <input type="checkbox" checked={f.notam_verzonden} onChange={e => upd("notam_verzonden", e.target.checked)} />NOTAMs verzonden deze shift
          </label>
          {f.notam_verzonden && (
            <>
              <div className="cb-title" style={{ marginBottom: 6 }}>Voor welke shift(s)?</div>
              <div className="cb-row" style={{ marginBottom: 10 }}>
                {NOTAM_SHIFTS.map(s => (
                  <label key={s} className={`cb-item${f.notam_shifts.includes(s) ? " checked" : ""}`}>
                    <input type="checkbox" checked={f.notam_shifts.includes(s)} onChange={() => {
                      const next = f.notam_shifts.includes(s) ? f.notam_shifts.filter(x => x !== s) : [...f.notam_shifts, s];
                      upd("notam_shifts", next);
                    }} />{s}
                  </label>
                ))}
              </div>
              <Field label="Opmerkingen / details" field="notam_opmerkingen" val={f.notam_opmerkingen} onChange={upd} type="textarea" />
            </>
          )}
        </div>
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
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span>✈️ Bijzonderheden – Operationeel</span></div>
        <div className="card-body">
          <div className="field-grid">
            <Field label="Airlines" field="byz_airlines" val={f.byz_airlines} onChange={upd} />
            <Field label="Operations" field="byz_operations" val={f.byz_operations} onChange={upd} />
            <Field label="ATC" field="byz_atc" val={f.byz_atc} onChange={upd} />
            <Field label="Toren" field="byz_toren" val={f.byz_toren} onChange={upd} />
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
