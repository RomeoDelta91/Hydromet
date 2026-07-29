import { useState } from "react";
import { getEntries } from "../api.js";
import { today, getWeekRange } from "../utils.js";
import EntryCard from "./EntryCard.jsx";

// Leesweergave van eerdere records. Toont exact hetzelfde als het Overzicht —
// alle kopstukken en alle velden — maar zonder bewerk-, verwijder- of
// downloadmogelijkheid.
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
                Lees terug wat een vorige shift volledig heeft ingevuld. Alleen-lezen — er is geen downloadoptie.
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
                        {resultaat.map(e => <EntryCard key={e.uuid || e.id} e={e} canEdit={false} canDelete={false} />)}
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
