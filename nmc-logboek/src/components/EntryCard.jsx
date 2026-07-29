import { sectiesVoorEntry } from "../entryVelden.js";

// Toont één volledig logboek-record: elk kopstuk en elk veld, ook wanneer een
// veld niet is ingevuld (dan blijft de waarde leeg) of op de standaardwaarde
// "OK" staat. De velden komen uit entryVelden.js, zodat het Overzicht en de
// leesweergave "Vorige Records" altijd hetzelfde tonen.
export default function EntryCard({ e, onDelete, onEdit, canDelete, canEdit = true }) {
  const isF = e.type === "forecaster";
  const isAdmin = e.type === "administratie";

  const chefEdits = e.chef_edits || [];
  const correctieVelden = e.correctie_velden || [];
  // Rood = aantekening van de chef, groen = eigen correctie van de invoerder.
  // Staat een veld in beide, dan weegt de chef-aantekening het zwaarst.
  const markKlasse = key => {
    if (!key) return "";
    if (chefEdits.includes(key)) return " chef-changed";
    if (correctieVelden.includes(key)) return " correctie-changed";
    return "";
  };

  const secties = sectiesVoorEntry(e);
  const heeftStoring = secties.some(s => (s.rijen || []).some(r => r.waarschuwing));

  const regel = (r, i) => (
    <div className="ef-rij" key={`${r.key}-${r.label}-${i}`}>
      <div className="ef-rij-label">{r.label}</div>
      <div className={`ef-rij-waarde${r.waarde ? "" : " leeg"}${r.waarschuwing ? " storing" : ""}${markKlasse(r.key)}`}>
        {r.waarde || "—"}
      </div>
    </div>
  );

  return (
    <div className="entry-card">
      <div className="entry-header">
        <div className="entry-meta">
          <span className={`badge badge-${e.type}`}>{isF ? "Forecaster" : isAdmin ? "Administratie" : "Observer"}</span>
          <span className="entry-date">{e.datum}</span>
          <span style={{ fontSize: 11, color: "var(--inkLo)", fontWeight: 600 }}>{e.shift || "—"}</span>
          {e.shift_code && <span style={{ fontSize: 11, color: "var(--inkLo)", fontFamily: "IBM Plex Mono,monospace" }}>{e.shift_code}</span>}
          {heeftStoring && <span className="badge badge-warn">⚠ Storing</span>}
          {chefEdits.length > 0 && <span className="badge badge-chef">✏ Aantekening chef</span>}
          {chefEdits.length === 0 && correctieVelden.length > 0 && <span className="badge badge-correctie">✏ Gecorrigeerd</span>}
        </div>
        <div className="entry-actions">
          {onEdit && canEdit && <button className="btn btn-secondary" onClick={() => onEdit(e)}>Bewerk</button>}
          {canDelete && <button className="btn btn-danger" onClick={() => onDelete(e.uuid || e.id)}>Wis</button>}
        </div>
      </div>

      <div className="entry-body">
        {secties.map(sectie => (
          <div className="ef-sectie" key={sectie.titel}>
            <div className="ef-sectie-titel">{sectie.titel}</div>
            {(sectie.rijen || []).map(regel)}
            {(sectie.subblokken || []).map(blok => (
              <div className="ef-subblok" key={blok.titel}>
                <div className="ef-subblok-titel">{blok.titel}</div>
                {blok.rijen.map(regel)}
              </div>
            ))}
          </div>
        ))}

        {correctieVelden.length > 0 && (() => {
          const laatste = (e.correcties || [])[(e.correcties || []).length - 1];
          return (
            <div style={{ fontSize: 11, color: "var(--correctie)", fontFamily: "IBM Plex Mono,monospace", fontWeight: 600, marginTop: 8 }}>
              Gecorrigeerd door {laatste?.door || e.ingevuld_door || "—"}{laatste?.tijdstip ? ` · ${laatste.tijdstip}` : ""} — correcties staan in het groen.
            </div>
          );
        })()}
        {chefEdits.length > 0 && (
          <div style={{ fontSize: 11, color: "var(--danger)", fontFamily: "IBM Plex Mono,monospace", fontWeight: 600, marginTop: 4 }}>
            Aantekening door chef: {e.chef_edit_door || "—"}{e.chef_edit_datum ? ` · ${String(e.chef_edit_datum).slice(0, 10)}` : ""} — Aantekeningen staan in het rood.
          </div>
        )}
      </div>
    </div>
  );
}
