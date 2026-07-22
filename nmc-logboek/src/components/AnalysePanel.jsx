import { useState, useEffect, useRef } from "react";
import {
  WZ_LABELS, VERWACHT_PER_SHIFT, STATUS_KEYS_COMM_OBS, STATUS_KEYS_INST_OBS,
  STATUS_KEYS_COMM_F, STATUS_KEYS_INST_F, SYSTEM_LABELS,
  SYNOP_TIMES, SYNOP_AMHS_TIMES, KLIMA_SHIFT, WIS_TIMES, TAF_TIMES,
} from "../constants.js";
import { today, ltToUtcMinutes, utcLabelToMinutes, inRange, inRangeKlima } from "../utils.js";
import { getEntries } from "../api.js";
import BarChart from "./ui/BarChart.jsx";
import LineChart from "./ui/LineChart.jsx";
import { downloadSvgAsPng } from "../utils/exportChartPng.js";

function getPersonalResponsibilityFull(persoon, shift) {
  if (!shift) return null;
  const vanMin = ltToUtcMinutes(persoon.werktijd_van);
  const totMin = ltToUtcMinutes(persoon.werktijd_tot);

  const synopTimes = SYNOP_TIMES[shift] || [];
  const synopAmhsTimes = SYNOP_AMHS_TIMES[shift] || [];
  const klimaTimes = KLIMA_SHIFT[shift] || [];
  const wisTimes = WIS_TIMES[shift] || [];
  const tafTimes = TAF_TIMES[shift] || [];

  const filterUtc = times => times.filter(t => inRange(utcLabelToMinutes(t), vanMin, totMin));
  const filterKlima = times => times.filter(t => inRangeKlima(t, vanMin, totMin));

  const resp_synop = filterUtc(synopTimes);
  const resp_synop_amhs = filterUtc(synopAmhsTimes);
  const resp_metar = filterUtc(synopTimes);
  const resp_upload_metar = filterUtc(synopTimes);
  const resp_digitaal_wx = filterUtc(synopTimes);
  const resp_klima = filterKlima(klimaTimes);
  const resp_digitaal_klima = filterKlima(klimaTimes);
  const resp_wis = filterUtc(wisTimes);
  const resp_taf = filterUtc(tafTimes);
  const resp_rr = (shift === "Ochtenddienst (08:00–15:00 LT)" && inRange(11 * 60, vanMin, totMin)) ? ["11:00 UTC"] : [];

  const done_synop = persoon.synop_gedaan || [];
  const done_synop_amhs = persoon.synop_amhs_gedaan || [];
  const done_metar = persoon.metar_gedaan || [];
  const done_upload_metar = persoon.upload_metar_gedaan || [];
  const done_digitaal_wx = persoon.digitaal_wx_gedaan || [];
  const done_klima = persoon.klima_gedaan || [];
  const done_digitaal_klima = persoon.digitaal_klima_gedaan || [];
  const done_wis = persoon.wis_synop_gedaan || [];
  const done_taf = persoon.taf_gedaan || [];

  const miss = (resp, done) => resp.filter(t => !done.includes(t));

  return {
    van: persoon.werktijd_van,
    tot: persoon.werktijd_tot,
    hasWindow: !!(persoon.werktijd_van && persoon.werktijd_tot),
    sections: [
      { key: "synop", label: "Synop-boek", verantw: resp_synop, gemist: miss(resp_synop, done_synop) },
      { key: "synop_amhs", label: "Synop-AMHS", verantw: resp_synop_amhs, gemist: miss(resp_synop_amhs, done_synop_amhs) },
      { key: "metar", label: "Metar-AMHS", verantw: resp_metar, gemist: miss(resp_metar, done_metar) },
      { key: "upload_metar", label: "Upload Metar", verantw: resp_upload_metar, gemist: miss(resp_upload_metar, done_upload_metar) },
      { key: "digitaal_wx", label: "Digitaal WX", verantw: resp_digitaal_wx, gemist: miss(resp_digitaal_wx, done_digitaal_wx) },
      { key: "klima", label: "Klimawaarneming-boek", verantw: resp_klima, gemist: miss(resp_klima, done_klima) },
      { key: "digitaal_klima", label: "Digitaal Klima", verantw: resp_digitaal_klima, gemist: miss(resp_digitaal_klima, done_digitaal_klima) },
      { key: "wis", label: "WIS 2.0 Synop", verantw: resp_wis, gemist: miss(resp_wis, done_wis) },
      { key: "taf", label: "TAF verzonden", verantw: resp_taf, gemist: miss(resp_taf, done_taf) },
      { key: "rr", label: "RR naar Klima", verantw: resp_rr, gemist: persoon.rr_gedaan ? [] : resp_rr },
    ],
  };
}

function Bar({ pct, color = "ok" }) {
  return (
    <div className="bar-wrap">
      <div className="bar-bg">
        <div className={`bar-fill bar-${color}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
      <span style={{ fontSize: 11, color: "var(--inkMid)", width: 36, textAlign: "right" }}>{Math.round(pct)}%</span>
    </div>
  );
}

export default function AnalysePanel() {
  const [maand, setMaand] = useState(today().slice(0, 7));
  const [subTab, setSubTab] = useState("observer");
  const [grafiekId, setGrafiekId] = useState("ziekmeldingen");
  const [grafiekType, setGrafiekType] = useState("bar");
  const chartRef = useRef(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    getEntries({ maand })
      .then(setEntries)
      .catch(err => setError(err.message || "Kon analysedata niet laden."))
      .finally(() => setLoading(false));
  }, [maand]);

  const observers = entries.filter(e => e.type === "observer");
  const forecasters = entries.filter(e => e.type === "forecaster");

  function calcWzStats() {
    if (!observers.length) return [];
    const keys = Object.keys(WZ_LABELS);
    return keys.map(k => {
      let totaalVerwacht = 0, totaalGedaan = 0, gemist = 0;
      observers.forEach(e => {
        const v = VERWACHT_PER_SHIFT[e.shift];
        if (!v) return;
        const personen = e.personen || [];
        const vk = (v[k] ?? 0) * Math.max(personen.length, 1);
        totaalVerwacht += v[k] ?? 0;
        if (k === "rr") {
          const done = personen.some(p => p.rr_gedaan);
          if ((v.rr ?? 0) > 0) { totaalGedaan += done ? 1 : 0; if (!done) gemist++; }
          return;
        }
        const fieldMap = {
          synop: "synop_gedaan", synop_amhs: "synop_amhs_gedaan", metar: "metar_gedaan", klima: "klima_gedaan",
          upload_metar: "upload_metar_gedaan", digitaal_wx: "digitaal_wx_gedaan",
          digitaal_klima: "digitaal_klima_gedaan", wis: "wis_synop_gedaan", taf: "taf_gedaan",
        };
        const field = fieldMap[k];
        if (!field) return;
        const g = personen.reduce((sum, p) => sum + (p[field] || []).length, 0);
        totaalGedaan += g;
        if ((v[k] ?? 0) > 0 && g < (v[k] ?? 0)) gemist++;
      });
      const pct = totaalVerwacht > 0 ? Math.round(totaalGedaan / totaalVerwacht * 100) : 100;
      return { key: k, label: WZ_LABELS[k], totaalVerwacht, totaalGedaan, gemist, pct };
    });
  }

  function calcPerPersoon() {
    const map = {};
    observers.forEach(e => {
      const v = VERWACHT_PER_SHIFT[e.shift];
      (e.personen || []).forEach(p => {
        const naam = p.naam || "Onbekend";
        if (!map[naam]) map[naam] = { naam, shifts: 0, totaalMissed: 0 };
        map[naam].shifts++;
        if (!v) return;
        let missed = 0;
        if ((p.synop_gedaan || []).length < v.synop) missed++;
        if ((p.synop_amhs_gedaan || []).length < v.synop_amhs) missed++;
        if ((p.metar_gedaan || []).length < v.metar) missed++;
        if (v.klima > 0 && (p.klima_gedaan || []).length < v.klima) missed++;
        if ((p.upload_metar_gedaan || []).length < v.upload_metar) missed++;
        if ((p.digitaal_wx_gedaan || []).length < v.digitaal_wx) missed++;
        if (v.digitaal_klima > 0 && (p.digitaal_klima_gedaan || []).length < v.digitaal_klima) missed++;
        if ((p.wis_synop_gedaan || []).length < v.wis) missed++;
        if (v.rr > 0 && !p.rr_gedaan) missed++;
        map[naam].totaalMissed += missed;
      });
    });
    return Object.values(map).sort((a, b) => b.totaalMissed - a.totaalMissed);
  }

  function calcPerShift() {
    const map = {};
    observers.forEach(e => {
      const s = e.shift || "Onbekend";
      if (!map[s]) map[s] = { shift: s, count: 0, missed: 0 };
      map[s].count++;
      const v = VERWACHT_PER_SHIFT[s];
      if (!v) return;
      let m = 0;
      (e.personen || []).forEach(p => {
        if ((p.synop_gedaan || []).length < v.synop) m++;
        if ((p.synop_amhs_gedaan || []).length < v.synop_amhs) m++;
        if ((p.metar_gedaan || []).length < v.metar) m++;
        if (v.klima > 0 && (p.klima_gedaan || []).length < v.klima) m++;
        if ((p.upload_metar_gedaan || []).length < v.upload_metar) m++;
        if ((p.digitaal_wx_gedaan || []).length < v.digitaal_wx) m++;
        if (v.digitaal_klima > 0 && (p.digitaal_klima_gedaan || []).length < v.digitaal_klima) m++;
        if ((p.wis_synop_gedaan || []).length < v.wis) m++;
        if ((p.taf_gedaan || []).length < (v.taf || 0)) m++;
        if (v.rr > 0 && !p.rr_gedaan) m++;
      });
      map[s].missed += m;
    });
    return Object.values(map);
  }

  function calcStoringen(isForecaster) {
    const src = isForecaster ? forecasters : observers;
    const keys = isForecaster ? [...STATUS_KEYS_COMM_F, ...STATUS_KEYS_INST_F] : [...STATUS_KEYS_COMM_OBS, ...STATUS_KEYS_INST_OBS];
    return keys.map(k => {
      let storing = 0, defect = 0, uitgevallen = 0;
      src.forEach(e => {
        const v = e[k];
        if (v === "Storing") storing++;
        else if (v === "Defect") defect++;
        else if (v === "Uitgevallen") uitgevallen++;
      });
      const totaal = storing + defect + uitgevallen;
      return { key: k, label: SYSTEM_LABELS[k] || k, storing, defect, uitgevallen, totaal };
    }).filter(x => x.totaal > 0).sort((a, b) => b.totaal - a.totaal);
  }

  function calcWebUpload() {
    if (!forecasters.length) return [];
    const map = {};
    forecasters.forEach(e => {
      (e.wu_products || []).forEach(p => { map[p] = (map[p] || 0) + 1; });
      if (e.wu_anders) map[`Anders: ${e.wu_anders}`] = (map[`Anders: ${e.wu_anders}`] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([p, n]) => ({ product: p, count: n }));
  }

  function calcNotamStats() {
    if (!forecasters.length) return { totaal: 0, verzonden: 0, perShift: {} };
    let verzonden = 0;
    const perShift = {};
    forecasters.forEach(e => {
      if (e.notam_verzonden) {
        verzonden++;
        (e.notam_shifts || []).forEach(s => { perShift[s] = (perShift[s] || 0) + 1; });
      }
    });
    return { totaal: forecasters.length, verzonden, perShift };
  }

  function calcWerktijdPerPersoon() {
    const map = {};
    observers.forEach(e => {
      (e.personen || []).forEach(p => {
        const naam = p.naam || "Onbekend";
        if (!map[naam]) map[naam] = { naam, shifts: [], totaalVerantw: 0, totaalGemist: 0, hasWindow: false };
        const detail = getPersonalResponsibilityFull(p, e.shift);
        if (!detail) return;
        if (detail.hasWindow) map[naam].hasWindow = true;
        let verantw = 0, gemist = 0;
        detail.sections.forEach(s => { verantw += s.verantw.length; gemist += s.gemist.length; });
        map[naam].totaalVerantw += verantw;
        map[naam].totaalGemist += gemist;
        map[naam].shifts.push({ ...detail, datum: e.datum, shift: e.shift });
      });
    });
    return Object.values(map).sort((a, b) => b.totaalGemist - a.totaalGemist);
  }

  function calcOverlaps() {
    const results = [];
    observers.forEach(e => {
      const personen = e.personen || [];
      for (let i = 0; i < personen.length; i++) {
        for (let j = i + 1; j < personen.length; j++) {
          const a = personen[i], b = personen[j];
          if (!a.werktijd_van || !b.werktijd_van) continue;
          const vanA = ltToUtcMinutes(a.werktijd_van), totA = ltToUtcMinutes(a.werktijd_tot);
          const vanB = ltToUtcMinutes(b.werktijd_van), totB = ltToUtcMinutes(b.werktijd_tot);
          const allTimes = [...(SYNOP_TIMES[e.shift] || []), ...(WIS_TIMES[e.shift] || []), ...(TAF_TIMES[e.shift] || [])];
          const shared = [...new Set(allTimes)].filter(t => {
            const m = utcLabelToMinutes(t);
            return inRange(m, vanA, totA) && inRange(m, vanB, totB);
          });
          if (shared.length > 0) {
            results.push({
              datum: e.datum, shift: e.shift,
              persoonA: a.naam || "?", vanA: a.werktijd_van, totA: a.werktijd_tot,
              persoonB: b.naam || "?", vanB: b.werktijd_van, totB: b.werktijd_tot,
              gedeeldeTijden: shared,
            });
          }
        }
      }
    });
    return results;
  }

  function calcZiekmeldingen() {
    const map = {};
    entries.forEach(e => {
      (e.ziekmeldingen || []).forEach(z => {
        const naam = z.naam?.trim() || "Onbekend";
        map[naam] = (map[naam] || 0) + 1;
      });
    });
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }

  function calcAanvragen() {
    const map = {};
    entries.forEach(e => {
      (e.aanvragen || []).forEach(a => {
        const t = a.type || "Onbekend";
        map[t] = (map[t] || 0) + 1;
      });
    });
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }

  const GRAFIEK_OPTS = [
    { id: "ziekmeldingen", label: "Ziektemeldingen (per persoon)" },
    { id: "aanvragen", label: "Aanvragen (per type)" },
    { id: "wz_volledigheid", label: "Werkzaamheden – volledigheid per onderdeel (%)" },
    { id: "storingen_obs", label: "Storingen – Observers (per systeem)" },
    { id: "storingen_f", label: "Storingen – Forecasters (per systeem)" },
  ];

  function grafiekData(id) {
    switch (id) {
      case "ziekmeldingen": return { data: calcZiekmeldingen(), color: "var(--warn)", max: undefined, unit: "" };
      case "aanvragen": return { data: calcAanvragen(), color: "var(--navyMid)", max: undefined, unit: "" };
      case "wz_volledigheid": return { data: wzStats.map(r => ({ label: r.label, value: r.pct })), color: "var(--green)", max: 100, unit: "%" };
      case "storingen_obs": return { data: storingenObs.map(r => ({ label: r.label, value: r.totaal })), color: "var(--danger)", max: undefined, unit: "" };
      case "storingen_f": return { data: storingenF.map(r => ({ label: r.label, value: r.totaal })), color: "var(--danger)", max: undefined, unit: "" };
      default: return { data: [], color: "var(--green)", max: undefined, unit: "" };
    }
  }

  const wzStats = calcWzStats();
  const perPersoon = calcPerPersoon();
  const perShift = calcPerShift();
  const storingenObs = calcStoringen(false);
  const storingenF = calcStoringen(true);
  const webUpload = calcWebUpload();
  const notamStats = calcNotamStats();
  const werktijdPerPersoon = calcWerktijdPerPersoon();
  const overlaps = calcOverlaps();

  const totaalMissedObs = wzStats.reduce((s, x) => s + x.gemist, 0);
  const completePct = wzStats.length > 0 ? Math.round(wzStats.reduce((s, x) => s + x.pct, 0) / wzStats.length) : 100;

  return (
    <div className="analyse-wrap">
      <div className="month-sel">
        <label>Maand</label>
        <input type="month" value={maand} onChange={e => setMaand(e.target.value)} />
        <span style={{ fontSize: 12, color: "var(--inkLo)" }}>
          {observers.length} observer-{observers.length === 1 ? "shift" : "shifts"} · {forecasters.length} forecaster-{forecasters.length === 1 ? "shift" : "shifts"}
        </span>
      </div>

      {error && <div className="error-state">{error}</div>}
      {loading && <div className="loading-state">Analysedata laden…</div>}

      {!loading && (
        <>
          <div className="analyse-tabs">
            {[["observer", "👁 Observers"], ["perpersoon", "👤 Per Persoon"], ["forecaster", "🌤 Forecasters"], ["storingen", "⚠ Storingen"], ["grafieken", "📈 Grafieken"]].map(([id, label]) => (
              <button key={id} className={`a-tab${subTab === id ? " active" : ""}`} onClick={() => setSubTab(id)}>{label}</button>
            ))}
          </div>

          {subTab === "observer" && (
            observers.length === 0 ? <div className="no-data">Geen observer-inzendingen voor {maand}.</div> : (
              <>
                <div className="stat-grid" style={{ marginBottom: 16 }}>
                  <div className="stat-box"><div className={`stat-num ${completePct < 80 ? "red" : completePct < 95 ? "warn" : "green"}`}>{completePct}%</div><div className="stat-label">Gem. volledigheid</div></div>
                  <div className="stat-box"><div className={`stat-num ${totaalMissedObs > 0 ? "red" : "green"}`}>{totaalMissedObs}</div><div className="stat-label">Onderdelen met missen</div></div>
                  <div className="stat-box"><div className="stat-num">{observers.length}</div><div className="stat-label">Shifts deze maand</div></div>
                  <div className="stat-box"><div className="stat-num">{perPersoon.length}</div><div className="stat-label">Actieve observers</div></div>
                </div>

                <div className="a-card">
                  <div className="a-card-head"><span>Werkzaamheden – Volledigheid per onderdeel</span></div>
                  <div className="a-card-body">
                    <table className="a-table">
                      <thead><tr><th>Werkzaamheid</th><th>Verwacht</th><th>Gedaan</th><th>Shifts gemist</th><th>Volledigheid</th></tr></thead>
                      <tbody>
                        {wzStats.map(r => (
                          <tr key={r.key}>
                            <td>{r.label}</td>
                            <td>{r.totaalVerwacht}</td>
                            <td>{r.totaalGedaan}</td>
                            <td>{r.gemist > 0 ? <span className="tag-miss">{r.gemist}x gemist</span> : <span className="tag-ok">Volledig</span>}</td>
                            <td><Bar pct={r.pct} color={r.pct < 80 ? "miss" : r.pct < 95 ? "warn" : "ok"} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="a-card">
                  <div className="a-card-head"><span>Prestaties per observer</span></div>
                  <div className="a-card-body">
                    {perPersoon.length === 0 ? <div className="no-data">Geen data.</div> : (
                      <table className="a-table">
                        <thead><tr><th>Observer</th><th>Shifts</th><th>Shifts met missen</th><th>Prestatie</th></tr></thead>
                        <tbody>
                          {perPersoon.map(r => {
                            const pct = r.shifts > 0 ? Math.round((1 - r.totaalMissed / (r.shifts * 8)) * 100) : 100;
                            return (
                              <tr key={r.naam}>
                                <td>{r.naam}</td>
                                <td>{r.shifts}</td>
                                <td>{r.totaalMissed > 0 ? <span className="tag-miss">{r.totaalMissed}x</span> : <span className="tag-ok">Geen</span>}</td>
                                <td><Bar pct={Math.max(0, pct)} color={pct < 80 ? "miss" : pct < 95 ? "warn" : "ok"} /></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div className="a-card">
                  <div className="a-card-head"><span>Missende werkzaamheden per shift-type</span></div>
                  <div className="a-card-body">
                    <table className="a-table">
                      <thead><tr><th>Shift</th><th>Aantal shifts</th><th>Totaal gemist</th><th>Gem. per shift</th></tr></thead>
                      <tbody>
                        {perShift.map(r => (
                          <tr key={r.shift}>
                            <td>{r.shift}</td>
                            <td>{r.count}</td>
                            <td>{r.missed > 0 ? <span className="tag-miss">{r.missed}x</span> : <span className="tag-ok">0</span>}</td>
                            <td>{r.count > 0 ? (r.missed / r.count).toFixed(1) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )
          )}

          {subTab === "perpersoon" && (
            observers.length === 0 ? <div className="no-data">Geen observer-inzendingen voor {maand}.</div> : (
              <>
                {overlaps.length > 0 && (
                  <div className="a-card" style={{ borderColor: "var(--warn)" }}>
                    <div className="a-card-head" style={{ background: "#3D2B00" }}><span style={{ color: "var(--warn)" }}>⚠ Gedeelde verantwoordelijkheid – Overlap gedetecteerd</span></div>
                    <div className="a-card-body">
                      <p style={{ fontSize: 12, color: "var(--inkMid)", marginBottom: 10 }}>De volgende tijdvakken vallen binnen de werktijd van meerdere personen tegelijk binnen dezelfde shift. Beide personen waren medeverantwoordelijk voor deze observaties.</p>
                      <table className="a-table">
                        <thead><tr><th>Datum</th><th>Persoon A</th><th>Persoon B</th><th>Gedeelde tijden</th></tr></thead>
                        <tbody>
                          {overlaps.map((o, i) => (
                            <tr key={i}>
                              <td>{o.datum}<br /><span style={{ fontSize: 10, color: "var(--inkLo)" }}>{o.shift}</span></td>
                              <td><strong>{o.persoonA}</strong><br /><span style={{ fontSize: 11, color: "var(--inkLo)" }}>{o.vanA}–{o.totA} LT</span></td>
                              <td><strong>{o.persoonB}</strong><br /><span style={{ fontSize: 11, color: "var(--inkLo)" }}>{o.vanB}–{o.totB} LT</span></td>
                              <td><span className="tag-part">{o.gedeeldeTijden.join(", ")}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="a-card">
                  <div className="a-card-head"><span>Prestaties per observer – op basis van werktijd</span></div>
                  <div className="a-card-body">
                    {werktijdPerPersoon.some(p => !p.hasWindow) && (
                      <p style={{ fontSize: 11, color: "var(--warn)", marginBottom: 10 }}>⚠ Sommige observers hebben geen werktijden ingevuld. Voor die shifts wordt de volledige shift als verantwoordelijkheid gerekend.</p>
                    )}
                    <table className="a-table">
                      <thead><tr><th>Observer</th><th>Shifts</th><th>Verantw. taken</th><th>Gemist</th><th>Volledigheid</th></tr></thead>
                      <tbody>
                        {werktijdPerPersoon.map(p => {
                          const pct = p.totaalVerantw > 0 ? Math.round((p.totaalVerantw - p.totaalGemist) / p.totaalVerantw * 100) : 100;
                          return (
                            <tr key={p.naam}>
                              <td>{p.naam}{!p.hasWindow && <span style={{ fontSize: 10, color: "var(--warn)", marginLeft: 6 }}>geen werktijd</span>}</td>
                              <td>{p.shifts.length}</td>
                              <td>{p.totaalVerantw}</td>
                              <td>{p.totaalGemist > 0 ? <span className="tag-miss">{p.totaalGemist}x</span> : <span className="tag-ok">Geen</span>}</td>
                              <td><Bar pct={pct} color={pct < 80 ? "miss" : pct < 95 ? "warn" : "ok"} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {werktijdPerPersoon.map(p => (
                  <div key={p.naam} className="a-card">
                    <div className="a-card-head">
                      <span>👤 {p.naam} – Shift detail</span>
                      <span style={{ fontSize: 11, color: "var(--inkLo)" }}>{p.shifts.length} shift{p.shifts.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="a-card-body">
                      {p.shifts.map((s, si) => (
                        <div key={si} style={{ marginBottom: 16, paddingBottom: 12, borderBottom: si < p.shifts.length - 1 ? "1px solid var(--paperMid)" : "none" }}>
                          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                            <span style={{ fontFamily: "IBM Plex Mono,monospace", fontSize: 11, fontWeight: 600, color: "var(--navy)" }}>{s.datum}</span>
                            <span style={{ fontSize: 11, color: "var(--inkMid)" }}>{s.shift}</span>
                            {s.hasWindow
                              ? <span style={{ fontSize: 11, background: "rgba(0,200,150,.12)", color: "#006B52", padding: "2px 8px", borderRadius: 4 }}>⏱ {s.van}–{s.tot} LT</span>
                              : <span style={{ fontSize: 11, background: "rgba(232,160,32,.12)", color: "#7A4A00", padding: "2px 8px", borderRadius: 4 }}>Geen werktijd ingevuld</span>
                            }
                          </div>
                          <table className="a-table">
                            <thead><tr><th>Werkzaamheid</th><th>Verantwoordelijk voor</th><th>Gemist</th></tr></thead>
                            <tbody>
                              {s.sections.filter(sec => sec.verantw.length > 0).map(sec => (
                                <tr key={sec.key}>
                                  <td>{sec.label}</td>
                                  <td style={{ fontSize: 11 }}>{sec.verantw.join(", ")}</td>
                                  <td>{sec.gemist.length > 0 ? <span className="tag-miss">{sec.gemist.join(", ")}</span> : <span className="tag-ok">Volledig</span>}</td>
                                </tr>
                              ))}
                              {s.sections.every(sec => sec.verantw.length === 0) && (
                                <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--inkLo)", fontSize: 12 }}>Geen taken in dit tijdvenster.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )
          )}

          {subTab === "forecaster" && (
            forecasters.length === 0 ? <div className="no-data">Geen forecaster-inzendingen voor {maand}.</div> : (
              <>
                <div className="stat-grid" style={{ marginBottom: 16 }}>
                  <div className="stat-box"><div className="stat-num">{forecasters.length}</div><div className="stat-label">Shifts</div></div>
                  <div className="stat-box"><div className="stat-num green">{webUpload.length}</div><div className="stat-label">Unieke producten</div></div>
                  <div className="stat-box"><div className={`stat-num ${storingenF.length > 0 ? "warn" : "green"}`}>{storingenF.length}</div><div className="stat-label">Systemen met storing</div></div>
                  <div className="stat-box"><div className="stat-num">{notamStats.verzonden}/{notamStats.totaal}</div><div className="stat-label">Shifts met NOTAMs</div></div>
                </div>

                <div className="a-card">
                  <div className="a-card-head"><span>Web Upload – Producten per maand</span></div>
                  <div className="a-card-body">
                    {webUpload.length === 0 ? <div className="no-data">Geen web uploads geregistreerd.</div> : (
                      <table className="a-table">
                        <thead><tr><th>Product</th><th>Aantal keer geüpload</th><th>Frequentie</th></tr></thead>
                        <tbody>
                          {webUpload.map(r => (
                            <tr key={r.product}>
                              <td>{r.product}</td>
                              <td>{r.count}</td>
                              <td><Bar pct={Math.round(r.count / forecasters.length * 100)} color="ok" /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div className="a-card">
                  <div className="a-card-head"><span>✈️ NOTAMs per shift-type</span></div>
                  <div className="a-card-body">
                    {Object.keys(notamStats.perShift).length === 0 ? <div className="no-data">Geen NOTAMs geregistreerd.</div> : (
                      <table className="a-table">
                        <thead><tr><th>Shift</th><th>Aantal keer NOTAM verzonden</th></tr></thead>
                        <tbody>
                          {Object.entries(notamStats.perShift).map(([s, n]) => (
                            <tr key={s}><td>{s}</td><td>{n}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </>
            )
          )}

          {subTab === "storingen" && (
            <>
              <div className="a-card">
                <div className="a-card-head"><span>⚠ Storingen &amp; Defecten – Observers</span></div>
                <div className="a-card-body">
                  {storingenObs.length === 0
                    ? <div className="no-data" style={{ color: "var(--green)" }}>✓ Geen storingen geregistreerd voor observers deze maand.</div>
                    : (
                      <table className="a-table">
                        <thead><tr><th>Systeem</th><th>Storing</th><th>Defect</th><th>Uitgevallen</th><th>Totaal meldingen</th></tr></thead>
                        <tbody>
                          {storingenObs.map(r => (
                            <tr key={r.key}>
                              <td>{r.label}</td>
                              <td>{r.storing > 0 ? <span className="tag-warn">{r.storing}x</span> : "—"}</td>
                              <td>{r.defect > 0 ? <span className="tag-miss">{r.defect}x</span> : "—"}</td>
                              <td>{r.uitgevallen > 0 ? <span className="tag-miss">{r.uitgevallen}x</span> : "—"}</td>
                              <td><strong>{r.totaal}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                </div>
              </div>

              <div className="a-card">
                <div className="a-card-head"><span>⚠ Storingen &amp; Defecten – Forecasters</span></div>
                <div className="a-card-body">
                  {storingenF.length === 0
                    ? <div className="no-data" style={{ color: "var(--green)" }}>✓ Geen storingen geregistreerd voor forecasters deze maand.</div>
                    : (
                      <table className="a-table">
                        <thead><tr><th>Systeem</th><th>Storing</th><th>Defect</th><th>Uitgevallen</th><th>Totaal meldingen</th></tr></thead>
                        <tbody>
                          {storingenF.map(r => (
                            <tr key={r.key}>
                              <td>{r.label}</td>
                              <td>{r.storing > 0 ? <span className="tag-warn">{r.storing}x</span> : "—"}</td>
                              <td>{r.defect > 0 ? <span className="tag-miss">{r.defect}x</span> : "—"}</td>
                              <td>{r.uitgevallen > 0 ? <span className="tag-miss">{r.uitgevallen}x</span> : "—"}</td>
                              <td><strong>{r.totaal}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                </div>
              </div>
            </>
          )}

          {subTab === "grafieken" && (
            <div className="a-card">
              <div className="a-card-head">
                <span>📈 Grafiek per element</span>
              </div>
              <div className="a-card-body">
                <div className="month-sel" style={{ marginBottom: 14, flexWrap: "wrap" }}>
                  <label>Element</label>
                  <select value={grafiekId} onChange={e => setGrafiekId(e.target.value)}>
                    {GRAFIEK_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                  <div className="chart-type-toggle">
                    <button type="button" className={`chart-type-btn${grafiekType === "bar" ? " active" : ""}`} onClick={() => setGrafiekType("bar")}>📊 Staaf</button>
                    <button type="button" className={`chart-type-btn${grafiekType === "line" ? " active" : ""}`} onClick={() => setGrafiekType("line")}>📈 Lijn</button>
                  </div>
                  <button
                    type="button"
                    className="btn btn-export"
                    onClick={() => downloadSvgAsPng(chartRef.current, `NMC_Grafiek_${grafiekId}_${maand}.png`)}
                  >💾 Opslaan als afbeelding</button>
                </div>
                {grafiekType === "bar"
                  ? <BarChart ref={chartRef} {...grafiekData(grafiekId)} />
                  : <LineChart ref={chartRef} {...grafiekData(grafiekId)} />}
              </div>
            </div>
          )}
        </>
      )}
      <div style={{ height: 16 }} />
    </div>
  );
}
