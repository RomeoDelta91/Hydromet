import { useState } from "react";
import { getEntries } from "../api.js";
import { today, getWeekRange } from "../utils.js";

// Statusvelden per type; alleen afwijkingen (niet-OK) zijn interessant bij een
// dienstoverdracht, de rest wordt als "Alles OK" samengevat.
const COMM_LABELS = {
  com_telefoon: "Telefoon", com_internet: "Internet", com_amhs: "AMHS", com_awos: "AWOS",
  com_werkmobiel: "Werkmobiel", com_charger: "Charger",
};
const INST_LABELS = {
  inst_conventioneel: "Conventioneel", inst_aws: "AWS", inst_awos: "AWOS",
  inst_pc_lhb: "PC LHB", inst_radar: "RADAR",
};
const LOGISTIEK_LABELS = {
  byz_dienstauto: "Dienstauto", byz_dienstbus: "Dienstbus", byz_hydrofoor: "Hydrofoor",
  byz_stroom: "Stroomonderbrekingen", byz_swm: "Levering SWM water",
  byz_maaiwerkzaamheden: "Maaiwerkzaamheden", byz_toilet: "Toilet", byz_logistiek_anders: "Anders",
};

// Leesweergave van één record. Uitsluitend de elementen die relevant zijn om na
// te gaan wat de vorige shift heeft ingevuld — geen bewerk- of opslagopties.
function RecordItem({ e }) {
  const chefEdits = e.chef_edits || [];
  const correctieVelden = e.correctie_velden || [];
  // Rood = aantekening chef, groen = eigen correctie; chef weegt het zwaarst.
  const rood = key => {
    if (chefEdits.includes(key)) return " chef-changed";
    if (correctieVelden.includes(key)) return " correctie-changed";
    return "";
  };
  const groepMark = labels => {
    if (chefEdits.some(k => labels[k])) return " chef-changed";
    if (correctieVelden.some(k => labels[k])) return " correctie-changed";
    return "";
  };
  const namen = (e.personen || []).map(p => p.naam).filter(Boolean).join(", ") || e.meteoroloog || "—";

  const statusBlok = (titel, labels, andersKey) => {
    const afwijkingen = Object.entries(labels)
      .filter(([k]) => e[k] !== undefined && e[k] !== "" && e[k] !== "OK")
      .map(([k, l]) => `${l}: ${e[k]}`);
    const anders = e[andersKey];
    if (!afwijkingen.length && !anders) {
      return <div className="ef-block"><div className="ef-label">{titel}</div><div className="ef-value">Alles OK</div></div>;
    }
    return (
      <div className="ef-block">
        <div className="ef-label">{titel}</div>
        {afwijkingen.length > 0 && (
          <div className={`ef-value${groepMark(labels)}`}>{afwijkingen.join("\n")}</div>
        )}
        {anders && <div className={`ef-value${rood(andersKey)}`} style={{ marginTop: afwijkingen.length ? 4 : 0 }}>Anders: {anders}</div>}
      </div>
    );
  };

  const tekstBlok = (titel, key) => {
    if (!e[key]) return null;
    return <div className="ef-block"><div className="ef-label">{titel}</div><div className={`ef-value${rood(key)}`}>{e[key]}</div></div>;
  };

  const logistiek = Object.entries(LOGISTIEK_LABELS).filter(([k]) => e[k]);
  const ziek = (e.ziekmeldingen || []).filter(z => z.tijd || z.naam || z.periode);
  const aanvr = (e.aanvragen || []).filter(a => a.type || a.naam || a.periode);

  return (
    <div className="entry-card">
      <div className="entry-header">
        <div className="entry-meta">
          <span className={`badge badge-${e.type}`}>{e.type === "forecaster" ? "Forecaster" : "Observer"}</span>
          <span className="entry-date">{e.datum}</span>
          <span style={{ fontSize: 11, color: "var(--inkLo)", fontWeight: 600 }}>{e.shift || "—"}</span>
          {e.shift_code && <span style={{ fontSize: 11, color: "var(--inkLo)", fontFamily: "IBM Plex Mono,monospace" }}>{e.shift_code}</span>}
          {chefEdits.length > 0 && <span className="badge badge-chef">✏ Aantekening chef</span>}
          {chefEdits.length === 0 && correctieVelden.length > 0 && <span className="badge badge-correctie">✏ Gecorrigeerd</span>}
        </div>
      </div>
      <div className="entry-body">
        <div className="ef-block">
          <div className="ef-label">{e.type === "forecaster" ? "Meteoroloog" : "Adj.-meteorologen"}</div>
          <div className={`ef-value${rood("personen")}`}>{namen}</div>
        </div>
        {statusBlok("Communicatie", COMM_LABELS, "com_anders")}
        {statusBlok("Instrumenten", INST_LABELS, "inst_anders")}
        {logistiek.length > 0 && (
          <div className="ef-block">
            <div className="ef-label">Logistiek</div>
            <div className={`ef-value${groepMark(LOGISTIEK_LABELS)}`}>
              {logistiek.map(([k, l]) => `${l}: ${e[k]}`).join("\n")}
            </div>
          </div>
        )}
        {ziek.length > 0 && (
          <div className="ef-block">
            <div className="ef-label">Ziektemeldingen</div>
            <div className={`ef-value${rood("ziekmeldingen")}`}>
              {ziek.map(z => [z.tijd, z.naam, z.periode].filter(Boolean).join(" — ")).join("\n")}
            </div>
          </div>
        )}
        {aanvr.length > 0 && (
          <div className="ef-block">
            <div className="ef-label">Aanvragen</div>
            <div className={`ef-value${rood("aanvragen")}`}>
              {aanvr.map(a => [a.type, a.naam, a.periode].filter(Boolean).join(" — ")).join("\n")}
            </div>
          </div>
        )}
        {tekstBlok("Algemene Bijzonderheden", "byz_algemeen")}
        {e.ingevuld_door && <div style={{ fontSize: 11, color: "var(--inkLo)", fontFamily: "IBM Plex Mono,monospace" }}>Ingevuld door: {e.ingevuld_door}</div>}
        {correctieVelden.length > 0 && (() => {
          const laatste = (e.correcties || [])[(e.correcties || []).length - 1];
          return (
            <div style={{ fontSize: 11, color: "var(--correctie)", fontFamily: "IBM Plex Mono,monospace", fontWeight: 600 }}>
              Gecorrigeerd door {laatste?.door || e.ingevuld_door || "—"}{laatste?.tijdstip ? ` · ${laatste.tijdstip}` : ""} — correcties staan in het groen.
            </div>
          );
        })()}
        {chefEdits.length > 0 && (
          <div style={{ fontSize: 11, color: "var(--danger)", fontFamily: "IBM Plex Mono,monospace", fontWeight: 600 }}>
            Aantekening door chef: {e.chef_edit_door || "—"}{e.chef_edit_datum ? ` · ${String(e.chef_edit_datum).slice(0, 10)}` : ""} — Aantekeningen staan in het rood.
          </div>
        )}
      </div>
    </div>
  );
}

export default function VorigeRecords({ type }) {
  const [open, setOpen] = useState(false);
  const [periode, setPeriode] = useState("dag");
  const [datum, setDatum] = useState(today());
  const [maand, setMaand] = useState(today().slice(0, 7));
  const [resultaat, setResultaat] = useState(null);
  const [loading, setLoading] = useState(false);

  const zoek = async () => {
    setLoading(true);
    setResultaat(null);
    try {
      const filters = { type };
      if (periode === "dag") {
        filters.datum = datum;
      } else if (periode === "week") {
        const { van, tot } = getWeekRange(datum);
        filters.van = van;
        filters.tot = tot;
      } else {
        filters.maand = maand;
      }
      setResultaat(await getEntries(filters));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" className="nav-extra-btn" onClick={() => setOpen(true)}>📄 Vorige Records</button>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-box modal-box-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📄 Vorige Records</h3>
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Sluiten</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 12, color: "var(--inkLo)", marginBottom: 12 }}>
                Lees terug wat een vorige shift heeft ingevuld. Alleen-lezen — er is geen downloadoptie.
              </p>
              <div className="field-grid">
                <div className="field">
                  <label>Periode</label>
                  <select value={periode} onChange={e => setPeriode(e.target.value)}>
                    <option value="dag">Dag</option>
                    <option value="week">Week</option>
                    <option value="maand">Maand</option>
                  </select>
                </div>
                {periode !== "maand" ? (
                  <div className="field">
                    <label>{periode === "week" ? "Datum in de week" : "Datum"}</label>
                    <input type="date" value={datum} onChange={e => setDatum(e.target.value)} />
                  </div>
                ) : (
                  <div className="field">
                    <label>Maand</label>
                    <input type="month" value={maand} onChange={e => setMaand(e.target.value)} />
                  </div>
                )}
              </div>
              <button type="button" className="btn btn-secondary" onClick={zoek} disabled={loading}>
                {loading ? "Laden…" : "🔍 Toon records"}
              </button>

              {resultaat && (
                <div className="records-feed">
                  {resultaat.length === 0
                    ? <p style={{ fontSize: 13, color: "var(--inkLo)" }}>Geen records gevonden voor deze periode.</p>
                    : <>
                        <p style={{ fontSize: 12, color: "var(--inkLo)", margin: "14px 0 8px" }}>
                          {resultaat.length} record{resultaat.length !== 1 ? "s" : ""} — nieuwste bovenaan
                        </p>
                        {resultaat.map(e => <RecordItem key={e.uuid || e.id} e={e} />)}
                      </>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
