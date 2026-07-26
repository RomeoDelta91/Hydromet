import { useState, useEffect } from "react";
import { SHIFTS, SHIFT_CODES, NOTAM_SHIFTS, WEB_PRODUCTS, MAAIWERK_OPTS, VERWACHTINGEN_PER_SHIFT, GEMAILDE_VERWACHTINGEN_PER_SHIFT } from "../constants.js";
import { today, nowId } from "../utils.js";
import { checkDuplicate } from "../api.js";
import Field from "./ui/Field.jsx";
import StatusRow from "./ui/StatusRow.jsx";
import Ziekmeldingen from "./ui/Ziekmeldingen.jsx";
import Aanvragen from "./ui/Aanvragen.jsx";
import Mededelingen from "./Mededelingen.jsx";
import VorigeRecords from "./VorigeRecords.jsx";

const DEF_PERSOON_F = { naam: "" };

const DEF_F = {
  datum: today(),
  shift: "",
  shift_code: "",
  personen: [{ ...DEF_PERSOON_F }],
  verwachtingen_checks: [],
  verwachtingen: "",
  gemailde_verwachtingen: [],
  com_telefoon: "OK",
  com_internet: "OK",
  com_amhs: "OK",
  com_awos: "OK",
  inst_aws: "OK",
  inst_awos: "OK",
  inst_pc_lhb: "OK",
  inst_radar: "OK",
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
  byz_maaiwerkzaamheden: "",
  byz_toilet: "",
  byz_logistiek_anders: "",
  ziekmeldingen: [],
  aanvragen: [],
  byz_airlines: "",
  byz_operations: "",
  byz_atc: "",
  byz_toren: "",
  byz_algemeen: "",
};

// Zet oudere entries (met los `meteoroloog`-veld) om naar de personen-array.
function normalizeInitial(initial) {
  if (!initial) return { ...DEF_F, datum: today() };
  const merged = { ...DEF_F, ...initial };
  if (!Array.isArray(merged.personen) || merged.personen.length === 0) {
    merged.personen = [{ naam: initial.meteoroloog || "" }];
  }
  if (!Array.isArray(merged.ziekmeldingen)) merged.ziekmeldingen = [];
  if (!Array.isArray(merged.aanvragen)) merged.aanvragen = [];
  if (!Array.isArray(merged.verwachtingen_checks)) merged.verwachtingen_checks = [];
  if (!Array.isArray(merged.gemailde_verwachtingen)) merged.gemailde_verwachtingen = [];
  return merged;
}

export default function ForecasterForm({ onSave, gebruiker, initial, role }) {
  const [f, setF] = useState(() => normalizeInitial(initial));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));

  const verwachtingenOpts = f.shift && VERWACHTINGEN_PER_SHIFT[f.shift] ? VERWACHTINGEN_PER_SHIFT[f.shift] : [];
  const gemaildeOpts = f.shift && GEMAILDE_VERWACHTINGEN_PER_SHIFT[f.shift] ? GEMAILDE_VERWACHTINGEN_PER_SHIFT[f.shift] : [];

  // Als de shift wijzigt, laat alleen de aangevinkte verwachtingen/gemailde
  // producten staan die ook bij de nieuwe shift horen.
  useEffect(() => {
    setF(prev => {
      const opts = prev.shift && VERWACHTINGEN_PER_SHIFT[prev.shift] ? VERWACHTINGEN_PER_SHIFT[prev.shift] : [];
      const gOpts = prev.shift && GEMAILDE_VERWACHTINGEN_PER_SHIFT[prev.shift] ? GEMAILDE_VERWACHTINGEN_PER_SHIFT[prev.shift] : [];
      const filtered = (prev.verwachtingen_checks || []).filter(v => opts.includes(v));
      const gFiltered = (prev.gemailde_verwachtingen || []).filter(v => gOpts.includes(v));
      if (filtered.length === (prev.verwachtingen_checks || []).length && gFiltered.length === (prev.gemailde_verwachtingen || []).length) return prev;
      return { ...prev, verwachtingen_checks: filtered, gemailde_verwachtingen: gFiltered };
    });
  }, [f.shift]);

  const addPersoon = () => {
    if (f.personen.length >= 6) return;
    setF(prev => ({ ...prev, personen: [...prev.personen, { ...DEF_PERSOON_F }] }));
  };
  const removePersoon = idx => {
    if (f.personen.length <= 1) return;
    setF(prev => ({ ...prev, personen: prev.personen.filter((_, i) => i !== idx) }));
  };
  const updPersoon = (idx, val) => {
    setF(prev => {
      const arr = [...prev.personen];
      arr[idx] = { ...arr[idx], naam: val };
      return { ...prev, personen: arr };
    });
  };

  const validate = () => {
    const e = {};
    if (!f.datum) e.datum = true;
    if (!f.shift) e.shift = true;
    if (!f.personen[0]?.naam.trim()) e.persoon_naam_0 = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const meteoroloog = f.personen[0]?.naam || "";
      if (!f.id) {
        const exists = await checkDuplicate(f.datum, f.shift, "forecaster", meteoroloog);
        if (exists && !window.confirm("Er bestaat al een logboek voor deze datum/shift/meteoroloog. Toch doorgaan?")) {
          setSaving(false);
          return;
        }
      }
      await onSave({ ...f, type: "forecaster", meteoroloog, id: f.id || nowId(), ts: Date.now(), ingevuld_door: gebruiker });
      setF({ ...DEF_F, datum: today(), personen: [{ ...DEF_PERSOON_F }] });
      setErrors({});
    } finally {
      setSaving(false);
    }
  };

  const reqStyle = k => (errors[k] ? { borderColor: "var(--danger)" } : {});

  return (
    <div className="section">
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <Mededelingen role={role} />
        <VorigeRecords type="forecaster" />
      </div>
      <div className="card">
        <div className="card-header"><span>📋 Basisgegevens</span></div>
        <div className="card-body">
          <div className="field-grid">
            <div className="field"><label>Datum {errors.datum && <span style={{ color: "var(--danger)" }}>*</span>}</label><input type="date" value={f.datum} onChange={e => upd("datum", e.target.value)} style={reqStyle("datum")} /></div>
            <div className="field"><label>Dienst {errors.shift && <span style={{ color: "var(--danger)" }}>*</span>}</label><select value={f.shift} onChange={e => upd("shift", e.target.value)} style={reqStyle("shift")}><option value="">Selecteer…</option>{SHIFTS.map(s => <option key={s}>{s}</option>)}</select></div>
          </div>
          <div className="field-grid">
            <div className="field"><label>Shift</label><select value={f.shift_code} onChange={e => upd("shift_code", e.target.value)}><option value="">Selecteer…</option>{SHIFT_CODES.map(s => <option key={s}>{s}</option>)}</select></div>
          </div>
          {Object.keys(errors).length > 0 && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 4 }}>Vul de verplichte velden in (*).</p>}
          <div style={{ marginTop: 8 }}>
            <div className="cb-title" style={{ marginBottom: 6 }}>Verwachtingen uitgebracht</div>
            {!f.shift && <p style={{ fontSize: 12, color: "var(--inkLo)" }}>Selecteer eerst een shift.</p>}
            {f.shift && (
              <div className="cb-row" style={{ marginBottom: 10 }}>
                {verwachtingenOpts.map(v => (
                  <label key={v} className={`cb-item${f.verwachtingen_checks.includes(v) ? " checked" : ""}`}>
                    <input type="checkbox" checked={f.verwachtingen_checks.includes(v)} onChange={() => {
                      const next = f.verwachtingen_checks.includes(v) ? f.verwachtingen_checks.filter(x => x !== v) : [...f.verwachtingen_checks, v];
                      upd("verwachtingen_checks", next);
                    }} />{v}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="field-grid single" style={{ marginTop: 8 }}>
            <Field label="Anders (omschrijf)" field="verwachtingen" val={f.verwachtingen} onChange={upd} type="textarea" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span>👥 Meteoroloog / meteorologen</span></div>
        <div className="card-body">
          {f.personen.map((p, idx) => (
            <div key={idx} className="persoon-block">
              <div className="persoon-block-head">
                <span>{idx === 0 ? "Meteoroloog" : `Persoon ${idx + 1}`}</span>
                {idx > 0 && <button type="button" className="btn btn-danger" onClick={() => removePersoon(idx)}>× Verwijder</button>}
              </div>
              <div className="field-grid single">
                <div className="field">
                  <label>Naam {idx === 0 && errors.persoon_naam_0 && <span style={{ color: "var(--danger)" }}>*</span>}</label>
                  <input value={p.naam} onChange={e => updPersoon(idx, e.target.value)} style={idx === 0 ? reqStyle("persoon_naam_0") : {}} placeholder="Volledige naam" />
                </div>
              </div>
            </div>
          ))}
          {f.personen.length < 6 && (
            <button type="button" className="btn btn-secondary" onClick={addPersoon}>+ Voeg persoon toe</button>
          )}
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
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span>📧 Gemailde Verwachtingen</span></div>
        <div className="card-body">
          {!f.shift && <p style={{ fontSize: 12, color: "var(--inkLo)" }}>Selecteer eerst een Dienst.</p>}
          {f.shift && gemaildeOpts.length === 0 && <p style={{ fontSize: 12, color: "var(--inkLo)" }}>Geen producten gemaild bij deze dienst.</p>}
          {f.shift && gemaildeOpts.length > 0 && (
            <div className="cb-row">
              {gemaildeOpts.map(v => (
                <label key={v} className={`cb-item${f.gemailde_verwachtingen.includes(v) ? " checked" : ""}`}>
                  <input type="checkbox" checked={f.gemailde_verwachtingen.includes(v)} onChange={() => {
                    const next = f.gemailde_verwachtingen.includes(v) ? f.gemailde_verwachtingen.filter(x => x !== v) : [...f.gemailde_verwachtingen, v];
                    upd("gemailde_verwachtingen", next);
                  }} />{v}
                </label>
              ))}
            </div>
          )}
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
            <Field label="Toilet" field="byz_toilet" val={f.byz_toilet} onChange={upd} />
            <div className="field">
              <label>Maaiwerkzaamheden</label>
              <select value={f.byz_maaiwerkzaamheden} onChange={e => upd("byz_maaiwerkzaamheden", e.target.value)}>
                {MAAIWERK_OPTS.map(o => <option key={o} value={o}>{o === "" ? "N.v.t." : o}</option>)}
              </select>
            </div>
          </div>
          <div className="field-grid single" style={{ marginTop: 8 }}>
            <Field label="Anders" field="byz_logistiek_anders" val={f.byz_logistiek_anders} onChange={upd} type="textarea" />
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
        <div className="card-header"><span>🤒 Ziektemeldingen</span></div>
        <div className="card-body">
          <Ziekmeldingen value={f.ziekmeldingen} onChange={v => upd("ziekmeldingen", v)} />
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span>📅 Aanvragen</span></div>
        <div className="card-body">
          <Aanvragen value={f.aanvragen} onChange={v => upd("aanvragen", v)} />
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
