import { useState } from "react";
import { SHIFTS, SHIFT_CODES, MONTHS_NL, WZ_OPTS, SYNOP_TIMES, SYNOP_AMHS_TIMES, KLIMA_SHIFT, WIS_TIMES, TAF_TIMES, MAAIWERK_OPTS } from "../constants.js";
import { today, nowId, filterTijdenVoorPersoon } from "../utils.js";
import { checkDuplicate } from "../api.js";
import Field from "./ui/Field.jsx";
import StatusRow from "./ui/StatusRow.jsx";
import CheckboxGroupInit from "./ui/CheckboxGroupInit.jsx";
import InitialsBox from "./ui/InitialsBox.jsx";
import RepeatText from "./ui/RepeatText.jsx";
import Ziekmeldingen from "./ui/Ziekmeldingen.jsx";
import Aanvragen from "./ui/Aanvragen.jsx";
import VorigeRecords from "./VorigeRecords.jsx";

// De `*_init` velden zijn objects, gekeyed per tijdstip: { "12 UTC": "AB" }
// zodat je per uur kunt zien wie het werk deed.
export const DEF_PERSOON = {
  naam: "",
  synop_gedaan: [],
  synop_init: {},
  synop_amhs_gedaan: [],
  synop_amhs_init: {},
  metar_gedaan: [],
  metar_init: {},
  klima_gedaan: [],
  klima_init: {},
  taf_gedaan: [],
  taf_init: {},
  wis_synop_gedaan: [],
  wis_synop_init: {},
  upload_metar_gedaan: [],
  upload_metar_init: {},
  digitaal_wx_gedaan: [],
  digitaal_wx_init: {},
  digitaal_klima_gedaan: [],
  digitaal_klima_init: {},
  digitaal_speci_gedaan: false,
  digitaal_speci_welke: "",
  digitaal_speci_init: "",
  rr_gedaan: false,
  rr_init: "",
};

const DEF_O_SHIFT = {
  datum: today(),
  shift: "",
  shift_code: "",
  personen: [{ ...DEF_PERSOON }],
  security: [""],
  onderhoud: [""],
  com_telefoon: "OK",
  com_internet: "OK",
  com_amhs: "OK",
  com_awos: "OK",
  com_werkmobiel: "OK",
  com_charger: "OK",
  inst_conventioneel: "OK",
  inst_aws: "OK",
  inst_awos: "OK",
  inst_radar: "OK",
  wz_climate: "Niet gemaakt",
  wz_climate_maand: "",
  wz_climate_init: "",
  wz_act: "Niet gemaakt",
  wz_act_maand: "",
  wz_act_init: "",
  wz_acs: "Niet gemaakt",
  wz_acs_maand: "",
  wz_acs_init: "",
  wz_temp: "Niet gemaakt",
  wz_temp_dag: "",
  wz_temp_tijd: "",
  wz_temp_init: "",
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

// Oudere entries hadden security/onderhoud als los tekstveld en geen
// ziekmeldingen/aanvragen. Normaliseer die naar de nieuwe (array-)vorm.
const INIT_KEYS = ["synop_init", "synop_amhs_init", "metar_init", "klima_init", "taf_init", "wis_synop_init", "upload_metar_init", "digitaal_wx_init", "digitaal_klima_init"];

function normalizeInitial(initial) {
  const merged = initial ? { ...DEF_O_SHIFT, ...initial } : { ...DEF_O_SHIFT, datum: today() };
  if (!Array.isArray(merged.security)) merged.security = merged.security ? [merged.security] : [""];
  if (!Array.isArray(merged.onderhoud)) merged.onderhoud = merged.onderhoud ? [merged.onderhoud] : [""];
  if (!Array.isArray(merged.ziekmeldingen)) merged.ziekmeldingen = [];
  if (!Array.isArray(merged.aanvragen)) merged.aanvragen = [];
  if (Array.isArray(merged.personen)) {
    merged.personen = merged.personen.map(p => {
      const next = { ...p };
      INIT_KEYS.forEach(k => {
        if (typeof next[k] !== "object" || next[k] === null || Array.isArray(next[k])) next[k] = {};
      });
      return next;
    });
  }
  return merged;
}

function WzRow({ label, field_status, field_maand, field_init, val_status, val_maand, val_init, onChange, isTemp, val_dag, val_tijd }) {
  return (
    <div style={{ padding: "8px 0", borderBottom: "1px solid var(--paperMid)" }}>
      <div className="status-row" style={{ borderBottom: "none", paddingBottom: 0 }}>
        <label>{label}</label>
        <select value={val_status} onChange={e => onChange(field_status, e.target.value)}>{WZ_OPTS.map(o => <option key={o}>{o}</option>)}</select>
      </div>
      {val_status === "Gemaakt" && !isTemp && (
        <div style={{ marginTop: 6 }}>
          <select value={val_maand} onChange={e => onChange(field_maand, e.target.value)}
            style={{ border: "1px solid var(--paperMid)", borderRadius: 6, padding: "6px 8px", fontSize: 12, fontFamily: "Inter,sans-serif", color: "var(--ink)", background: "var(--paper)", width: "100%" }}>
            <option value="">Selecteer maand…</option>
            {MONTHS_NL.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
      )}
      {val_status === "Gemaakt" && isTemp && (
        <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
          <input type="date" value={val_dag} onChange={e => onChange(field_maand, e.target.value)}
            style={{ border: "1px solid var(--paperMid)", borderRadius: 6, padding: "6px 8px", fontSize: 12, flex: 1, fontFamily: "Inter,sans-serif", color: "var(--ink)", background: "var(--paper)" }} />
          <input type="time" value={val_tijd} onChange={e => onChange("wz_temp_tijd", e.target.value)}
            style={{ border: "1px solid var(--paperMid)", borderRadius: 6, padding: "6px 8px", fontSize: 12, flex: 1, fontFamily: "IBM Plex Mono,monospace", color: "var(--ink)", background: "var(--paper)" }} />
        </div>
      )}
      {val_status === "Gemaakt" && (
        <InitialsBox value={val_init} onChange={v => onChange(field_init, v)} />
      )}
    </div>
  );
}

export default function ObserverForm({ onSave, gebruiker, initial }) {
  const [f, setF] = useState(() => normalizeInitial(initial));
  const [errors, setErrors] = useState({});
  const [activePersoonTab, setActivePersoonTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));

  const shift = f.shift;
  const synopTimes = shift && SYNOP_TIMES[shift] ? SYNOP_TIMES[shift] : [];
  const synopAmhsTimes = shift && SYNOP_AMHS_TIMES[shift] ? SYNOP_AMHS_TIMES[shift] : [];
  const klimaTimes = shift && KLIMA_SHIFT[shift] ? KLIMA_SHIFT[shift] : [];
  const wisTimes = shift && WIS_TIMES[shift] ? WIS_TIMES[shift] : [];
  const tafTimes = shift && TAF_TIMES[shift] ? TAF_TIMES[shift] : [];
  const isOchtend = shift === SHIFTS[0];

  const addPersoon = () => {
    if (f.personen.length >= 6) return;
    setF(prev => ({ ...prev, personen: [...prev.personen, { ...DEF_PERSOON }] }));
  };
  const removePersoon = idx => {
    if (f.personen.length <= 1) return;
    setF(prev => ({ ...prev, personen: prev.personen.filter((_, i) => i !== idx) }));
    setActivePersoonTab(t => (t >= f.personen.length - 1 ? f.personen.length - 2 : t));
  };
  const updPersoon = (idx, key, val) => {
    setF(prev => {
      const arr = [...prev.personen];
      arr[idx] = { ...arr[idx], [key]: val };
      return { ...prev, personen: arr };
    });
  };

  // Bij meerdere observers moet je per aangevinkt tijdstip kunnen zien wie het
  // deed — initialen zijn dan verplicht. Bij één observer is dat niet nodig.
  const TIJDSLOT_CATS = [
    ["synop_gedaan", "synop_init"], ["synop_amhs_gedaan", "synop_amhs_init"], ["metar_gedaan", "metar_init"],
    ["klima_gedaan", "klima_init"], ["upload_metar_gedaan", "upload_metar_init"], ["digitaal_wx_gedaan", "digitaal_wx_init"],
    ["digitaal_klima_gedaan", "digitaal_klima_init"], ["wis_synop_gedaan", "wis_synop_init"], ["taf_gedaan", "taf_init"],
  ];

  const validate = () => {
    const e = {};
    if (!f.datum) e.datum = true;
    if (!f.shift) e.shift = true;
    f.personen.forEach((p, idx) => {
      if (!p.naam.trim()) e[`persoon_naam_${idx}`] = true;
    });
    if (f.personen.length > 1) {
      f.personen.forEach(p => {
        TIJDSLOT_CATS.forEach(([gedaanKey, initKey]) => {
          (p[gedaanKey] || []).forEach(slot => {
            if (!p[initKey]?.[slot]) e.initialen_verplicht = true;
          });
        });
        if (p.digitaal_speci_gedaan && !p.digitaal_speci_init) e.initialen_verplicht = true;
        if (p.rr_gedaan && !p.rr_init) e.initialen_verplicht = true;
      });
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (!f.id) {
        const meteoroloog = f.personen[0]?.naam || "";
        const exists = await checkDuplicate(f.datum, f.shift, "observer", meteoroloog);
        if (exists && !window.confirm("Er bestaat al een logboek voor deze datum/shift/persoon. Toch doorgaan?")) {
          setSaving(false);
          return;
        }
      }
      await onSave({ ...f, type: "observer", id: f.id || nowId(), ts: Date.now(), ingevuld_door: gebruiker });
      setF({ ...DEF_O_SHIFT, datum: today() });
      setErrors({});
      setActivePersoonTab(0);
    } finally {
      setSaving(false);
    }
  };

  const reqStyle = k => (errors[k] ? { borderColor: "var(--danger)" } : {});

  const persoonActief = f.personen[activePersoonTab] || f.personen[0];
  const idxActief = f.personen.indexOf(persoonActief);
  const synopTimesP = filterTijdenVoorPersoon(synopTimes, persoonActief.werktijd_van, persoonActief.werktijd_tot);
  const synopAmhsTimesP = filterTijdenVoorPersoon(synopAmhsTimes, persoonActief.werktijd_van, persoonActief.werktijd_tot);
  const klimaTimesP = filterTijdenVoorPersoon(klimaTimes, persoonActief.werktijd_van, persoonActief.werktijd_tot);
  const wisTimesP = filterTijdenVoorPersoon(wisTimes, persoonActief.werktijd_van, persoonActief.werktijd_tot);
  const tafTimesP = filterTijdenVoorPersoon(tafTimes, persoonActief.werktijd_van, persoonActief.werktijd_tot);

  return (
    <div className="section">
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <VorigeRecords type="observer" />
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
          <div className="field-grid">
            <RepeatText label="Security" value={f.security} onChange={v => upd("security", v)} placeholder="Naam" />
            <RepeatText label="Onderhoudmedewerker" value={f.onderhoud} onChange={v => upd("onderhoud", v)} placeholder="Naam" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span>👥 Aanwezige adjunct-meteorologen</span></div>
        <div className="card-body">
          {f.personen.map((p, idx) => (
            <div key={idx} className="persoon-block">
              <div className="persoon-block-head">
                <span>Persoon {idx + 1}</span>
                {idx > 0 && <button type="button" className="btn btn-danger" onClick={() => removePersoon(idx)}>× Verwijder</button>}
              </div>
              <div className="field-grid single">
                <div className="field">
                  <label>Naam {errors[`persoon_naam_${idx}`] && <span style={{ color: "var(--danger)" }}>*</span>}</label>
                  <input value={p.naam} onChange={e => updPersoon(idx, "naam", e.target.value)} style={errors[`persoon_naam_${idx}`] ? { borderColor: "var(--danger)" } : {}} placeholder="Volledige naam" />
                </div>
              </div>
            </div>
          ))}
          {f.personen.length < 6 && (
            <button type="button" className="btn btn-secondary" onClick={addPersoon}>+ Voeg persoon toe</button>
          )}
          {Object.keys(errors).some(k => k.startsWith("persoon_naam_")) && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>Vul de naam van elke persoon in.</p>}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span>📡 Communicatie</span></div>
        <div className="card-body">
          <StatusRow label="Telefoon" field="com_telefoon" val={f.com_telefoon} onChange={upd} />
          <StatusRow label="Internet" field="com_internet" val={f.com_internet} onChange={upd} />
          <StatusRow label="AMHS" field="com_amhs" val={f.com_amhs} onChange={upd} />
          <StatusRow label="AWOS" field="com_awos" val={f.com_awos} onChange={upd} />
          <StatusRow label="Werkmobiel" field="com_werkmobiel" val={f.com_werkmobiel} onChange={upd} />
          <StatusRow label="Charger" field="com_charger" val={f.com_charger} onChange={upd} />
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span>🛰 Instrumenten</span></div>
        <div className="card-body">
          <StatusRow label="Conventioneel" field="inst_conventioneel" val={f.inst_conventioneel} onChange={upd} />
          <StatusRow label="AWS" field="inst_aws" val={f.inst_aws} onChange={upd} />
          <StatusRow label="AWOS" field="inst_awos" val={f.inst_awos} onChange={upd} />
          <StatusRow label="RADAR" field="inst_radar" val={f.inst_radar} onChange={upd} />
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span>📊 Werkzaamheden</span></div>
        <div className="card-body">
          {errors.initialen_verplicht && (
            <p style={{ fontSize: 12, color: "var(--danger)", marginBottom: 10, fontWeight: 600 }}>
              ⚠ Er zijn meerdere observers ingevoerd — vul bij elk aangevinkt tijdstip de initialen in voordat u opslaat.
            </p>
          )}
          {!shift && <p style={{ fontSize: 12, color: "var(--inkLo)", marginBottom: 12 }}>Selecteer eerst een shift.</p>}
          {shift && f.personen.length > 1 && (
            <div className="persoon-tabs">
              {f.personen.map((p, idx) => (
                <button key={idx} type="button" className={`persoon-tab${activePersoonTab === idx ? " active" : ""}`} onClick={() => setActivePersoonTab(idx)}>
                  {p.naam || `Persoon ${idx + 1}`}
                  {p.werktijd_van && p.werktijd_tot ? ` (${p.werktijd_van}–${p.werktijd_tot})` : ""}
                </button>
              ))}
            </div>
          )}
          {shift && (
            <>
              <div className="time-block">
                <div className="time-block-label">Synop-boek</div>
                {synopTimesP.length > 0 ? (
                  <CheckboxGroupInit
                    options={synopTimesP} selected={persoonActief.synop_gedaan} onChangeSelected={v => updPersoon(idxActief, "synop_gedaan", v)}
                    initials={persoonActief.synop_init} onChangeInitials={v => updPersoon(idxActief, "synop_init", v)}
                    hint="vink aan welke gemaakt, initialen eronder"
                  />
                ) : <p style={{ fontSize: 12, color: "var(--inkLo)" }}>Geen taken in dit tijdvenster.</p>}
              </div>
              <div className="time-block">
                <div className="time-block-label">Metar-AMHS</div>
                {synopTimesP.length > 0 ? (
                  <CheckboxGroupInit
                    options={synopTimesP} selected={persoonActief.metar_gedaan} onChangeSelected={v => updPersoon(idxActief, "metar_gedaan", v)}
                    initials={persoonActief.metar_init} onChangeInitials={v => updPersoon(idxActief, "metar_init", v)}
                    hint="vink aan welke gemaakt, initialen eronder"
                  />
                ) : <p style={{ fontSize: 12, color: "var(--inkLo)" }}>Geen taken in dit tijdvenster.</p>}
              </div>
              <div className="time-block">
                <div className="time-block-label">Synop-AMHS</div>
                {synopAmhsTimesP.length > 0 ? (
                  <CheckboxGroupInit
                    options={synopAmhsTimesP} selected={persoonActief.synop_amhs_gedaan} onChangeSelected={v => updPersoon(idxActief, "synop_amhs_gedaan", v)}
                    initials={persoonActief.synop_amhs_init} onChangeInitials={v => updPersoon(idxActief, "synop_amhs_init", v)}
                    hint="vink aan welke gemaakt, initialen eronder"
                  />
                ) : <p style={{ fontSize: 12, color: "var(--inkLo)" }}>Geen taken in dit tijdvenster.</p>}
              </div>
              <div className="time-block">
                <div className="time-block-label">Klimawaarneming-boek</div>
                {klimaTimesP.length > 0 ? (
                  <CheckboxGroupInit
                    options={klimaTimesP} selected={persoonActief.klima_gedaan} onChangeSelected={v => updPersoon(idxActief, "klima_gedaan", v)}
                    initials={persoonActief.klima_init} onChangeInitials={v => updPersoon(idxActief, "klima_init", v)}
                    hint="vink aan welke gedaan, initialen eronder"
                  />
                ) : <p style={{ fontSize: 12, color: "var(--inkLo)" }}>{shift ? "Geen klima waarneming in dit tijdvenster." : "Selecteer een shift."}</p>}
              </div>
              <div className="time-block">
                <div className="time-block-label">Upload Metar website</div>
                {synopTimesP.length > 0 ? (
                  <CheckboxGroupInit
                    options={synopTimesP} selected={persoonActief.upload_metar_gedaan} onChangeSelected={v => updPersoon(idxActief, "upload_metar_gedaan", v)}
                    initials={persoonActief.upload_metar_init} onChangeInitials={v => updPersoon(idxActief, "upload_metar_init", v)}
                    hint="vink aan welke geüpload, initialen eronder"
                  />
                ) : <p style={{ fontSize: 12, color: "var(--inkLo)" }}>Geen taken in dit tijdvenster.</p>}
              </div>
              <div className="time-block">
                <div className="time-block-label">Digitale invoer WX website</div>
                {synopTimesP.length > 0 ? (
                  <CheckboxGroupInit
                    options={synopTimesP} selected={persoonActief.digitaal_wx_gedaan} onChangeSelected={v => updPersoon(idxActief, "digitaal_wx_gedaan", v)}
                    initials={persoonActief.digitaal_wx_init} onChangeInitials={v => updPersoon(idxActief, "digitaal_wx_init", v)}
                    hint="vink aan welke ingevoerd, initialen eronder"
                  />
                ) : <p style={{ fontSize: 12, color: "var(--inkLo)" }}>Geen taken in dit tijdvenster.</p>}
              </div>
              <div className="time-block">
                <div className="time-block-label">Digitale invoer Klima website</div>
                {klimaTimesP.length > 0 ? (
                  <CheckboxGroupInit
                    options={klimaTimesP} selected={persoonActief.digitaal_klima_gedaan} onChangeSelected={v => updPersoon(idxActief, "digitaal_klima_gedaan", v)}
                    initials={persoonActief.digitaal_klima_init} onChangeInitials={v => updPersoon(idxActief, "digitaal_klima_init", v)}
                    hint="vink aan welke ingevoerd, initialen eronder"
                  />
                ) : <p style={{ fontSize: 12, color: "var(--inkLo)" }}>{shift ? "Geen klima invoer in dit tijdvenster." : "Selecteer een shift."}</p>}
              </div>
              <div className="time-block">
                <div className="time-block-label">Digitale invoer SPECI website</div>
                <label className={`cb-item${persoonActief.digitaal_speci_gedaan ? " checked" : ""}`} style={{ display: "inline-flex", marginBottom: 8 }}>
                  <input type="checkbox" checked={persoonActief.digitaal_speci_gedaan} onChange={e => updPersoon(idxActief, "digitaal_speci_gedaan", e.target.checked)} />SPECI's ingevoerd deze shift
                </label>
                {persoonActief.digitaal_speci_gedaan && <Field label="Welke SPECI's ingevoerd?" field="digitaal_speci_welke" val={persoonActief.digitaal_speci_welke} onChange={(k, v) => updPersoon(idxActief, k, v)} type="textarea" />}
                {persoonActief.digitaal_speci_gedaan && <InitialsBox value={persoonActief.digitaal_speci_init} onChange={v => updPersoon(idxActief, "digitaal_speci_init", v)} />}
              </div>
              <div className="time-block">
                <div className="time-block-label">Upload Synop WIS 2.0</div>
                {wisTimesP.length > 0 ? (
                  <CheckboxGroupInit
                    options={wisTimesP} selected={persoonActief.wis_synop_gedaan} onChangeSelected={v => updPersoon(idxActief, "wis_synop_gedaan", v)}
                    initials={persoonActief.wis_synop_init} onChangeInitials={v => updPersoon(idxActief, "wis_synop_init", v)}
                    hint="vink aan welke geüpload, initialen eronder"
                  />
                ) : <p style={{ fontSize: 12, color: "var(--inkLo)" }}>Geen taken in dit tijdvenster.</p>}
              </div>
              <div className="time-block">
                <div className="time-block-label">Verzenden TAF</div>
                {tafTimesP.length > 0 ? (
                  <CheckboxGroupInit
                    options={tafTimesP} selected={persoonActief.taf_gedaan} onChangeSelected={v => updPersoon(idxActief, "taf_gedaan", v)}
                    initials={persoonActief.taf_init} onChangeInitials={v => updPersoon(idxActief, "taf_init", v)}
                    hint="vink aan welke verzonden, initialen eronder"
                  />
                ) : <p style={{ fontSize: 12, color: "var(--inkLo)" }}>Geen taken in dit tijdvenster.</p>}
              </div>
              <div className="time-block">
                <div className="time-block-label">Verzenden RR naar Klima-afdeling</div>
                {isOchtend ? (
                  <>
                    <label className={`cb-item${persoonActief.rr_gedaan ? " checked" : ""}`} style={{ display: "inline-flex" }}>
                      <input type="checkbox" checked={persoonActief.rr_gedaan} onChange={e => updPersoon(idxActief, "rr_gedaan", e.target.checked)} />Verzonden
                    </label>
                    {persoonActief.rr_gedaan && <InitialsBox value={persoonActief.rr_init} onChange={v => updPersoon(idxActief, "rr_init", v)} />}
                  </>
                ) : <p style={{ fontSize: 12, color: "var(--inkLo)" }}>Alleen van toepassing bij ochtenddienst.</p>}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span>📁 Overige Werkzaamheden</span></div>
        <div className="card-body">
          <WzRow label="Climate Report" field_status="wz_climate" field_maand="wz_climate_maand" field_init="wz_climate_init" val_status={f.wz_climate} val_maand={f.wz_climate_maand} val_init={f.wz_climate_init} onChange={upd} />
          <WzRow label="ACT" field_status="wz_act" field_maand="wz_act_maand" field_init="wz_act_init" val_status={f.wz_act} val_maand={f.wz_act_maand} val_init={f.wz_act_init} onChange={upd} />
          <WzRow label="ACS" field_status="wz_acs" field_maand="wz_acs_maand" field_init="wz_acs_init" val_status={f.wz_acs} val_maand={f.wz_acs_maand} val_init={f.wz_acs_init} onChange={upd} />
          <WzRow label="Temp" field_status="wz_temp" field_maand="wz_temp_dag" field_init="wz_temp_init" val_status={f.wz_temp} val_maand={f.wz_temp_dag} val_dag={f.wz_temp_dag} val_tijd={f.wz_temp_tijd} val_init={f.wz_temp_init} onChange={upd} isTemp={true} />
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
