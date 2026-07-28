import { useState } from "react";
import { getEntries } from "../api.js";
import { today, getWeekRange } from "../utils.js";
import { exportDocx } from "../export/exportDocx.js";

// Elementen die forecasters/observers mogen terugroepen om na te gaan wat
// een vorige shift heeft ingevuld — bewust een kleinere set dan het volledige
// Overzicht (dat is voorbehouden aan chef/admin/administratie/viewer).
const RECALL_IDS = [
  "basis",
  "com_telefoon", "com_internet", "com_amhs", "com_awos", "com_werkmobiel", "com_charger",
  "inst_conventioneel", "inst_aws", "inst_awos", "inst_pc_lhb", "inst_radar",
  "byz_dienstauto", "byz_dienstbus", "byz_hydrofoor", "byz_stroom", "byz_swm",
  "byz_maaiwerkzaamheden", "byz_toilet", "byz_logistiek_anders",
  "ziekmeldingen", "aanvragen", "byz_algemeen",
];

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
      let filters = { type };
      let label;
      if (periode === "dag") {
        filters.datum = datum;
        label = datum;
      } else if (periode === "week") {
        const { van, tot } = getWeekRange(datum);
        filters.van = van;
        filters.tot = tot;
        label = `Week ${van} t-m ${tot}`;
      } else {
        filters.maand = maand;
        label = maand;
      }
      const entries = await getEntries(filters);
      setResultaat({ entries, label });
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    if (!resultaat || resultaat.entries.length === 0) return;
    exportDocx(resultaat.entries, RECALL_IDS, `Vorige-Records_${resultaat.label}`);
  };

  return (
    <>
      <button type="button" className="nav-extra-btn" onClick={() => setOpen(true)}>📄 Vorige Records</button>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📄 Vorige Records opvragen</h3>
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Sluiten</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 12, color: "var(--inkLo)", marginBottom: 12 }}>
                Roep eerdere invoer van uw eigen sectie op om na te gaan wat de vorige shift heeft ingevuld.
                Bevat: Naam, Dienst, Shift, Communicatie, Instrumenten, Logistiek, Ziektemeldingen, Aanvragen en Algemene Bijzonderheden.
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
                {loading ? "Zoeken…" : "🔍 Zoeken"}
              </button>

              {resultaat && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontSize: 13, color: "var(--ink)" }}>
                    {resultaat.entries.length === 0
                      ? "Geen records gevonden voor deze periode."
                      : `${resultaat.entries.length} record(en) gevonden.`}
                  </p>
                  {resultaat.entries.length > 0 && (
                    <button type="button" className="btn btn-export" onClick={download}>⬇ Download Word</button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
