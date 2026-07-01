export default function EntryCard({ e, onDelete, onEdit, canDelete }) {
  const isF = e.type === "forecaster";
  const storingen = [
    e.com_telefoon !== "OK" && `Telefoon: ${e.com_telefoon}`,
    e.com_internet !== "OK" && `Internet: ${e.com_internet}`,
    e.com_amhs !== "OK" && `AMHS: ${e.com_amhs}`,
    e.com_awos !== "OK" && `AWOS: ${e.com_awos}`,
    !isF && e.com_werkmobiel !== "OK" && `Werkmobiel: ${e.com_werkmobiel}`,
    !isF && e.com_charger !== "OK" && `Charger: ${e.com_charger}`,
    e.inst_aws !== "OK" && `AWS: ${e.inst_aws}`,
    e.inst_awos !== "OK" && `AWOS inst: ${e.inst_awos}`,
    e.inst_radar !== "OK" && `RADAR: ${e.inst_radar}`,
    isF && e.inst_pc_lhb !== "OK" && `PC LHB: ${e.inst_pc_lhb}`,
    !isF && e.inst_conventioneel !== "OK" && `Conventioneel: ${e.inst_conventioneel}`,
  ].filter(Boolean);

  const personenNamen = (e.personen || []).map(p => p.naam).filter(Boolean).join(", ");
  const namen = isF ? (personenNamen || e.meteoroloog) : personenNamen;

  const ef = (label, val) => {
    if (!val || val === "" || val === "OK" || (Array.isArray(val) && val.length === 0)) return null;
    return (<div className="ef-block"><div className="ef-label">{label}</div><div className="ef-value">{Array.isArray(val) ? val.join(", ") : val}</div></div>);
  };

  return (
    <div className="entry-card">
      <div className="entry-header">
        <div className="entry-meta">
          <span className={`badge badge-${e.type}`}>{isF ? "Forecaster" : "Observer"}</span>
          <span className="entry-date">{e.datum}</span>
          <span style={{ fontSize: 11, color: "var(--inkLo)", fontWeight: 600 }}>{e.shift || "—"}</span>
          {storingen.length > 0 && <span className="badge badge-warn">⚠ Storing</span>}
        </div>
        <div className="entry-actions">
          {onEdit && <button className="btn btn-secondary" onClick={() => onEdit(e)}>Bewerk</button>}
          {canDelete && <button className="btn btn-danger" onClick={() => onDelete(e.uuid || e.id)}>Wis</button>}
        </div>
      </div>
      <div className="entry-body">
        {ef(isF ? "Meteoroloog" : "Adj.-meteorologen", namen)}
        {isF && ef("Verwachtingen", e.verwachtingen)}
        {isF && (e.wu_products?.length || e.wu_anders) && <div className="ef-block"><div className="ef-label">Web Upload</div><div className="ef-value">{[...(e.wu_products || []), e.wu_anders && `Anders: ${e.wu_anders}`].filter(Boolean).join(", ")}</div></div>}
        {isF && e.notam_verzonden && (
          <div className="ef-block">
            <div className="ef-label">NOTAMs verzonden</div>
            <div className="ef-value">
              {(e.notam_shifts || []).join(", ")}
              {e.notam_opmerkingen && ` — ${e.notam_opmerkingen}`}
            </div>
          </div>
        )}
        {storingen.length > 0 && <div className="ef-block" style={{ borderLeft: "3px solid var(--danger)" }}><div className="ef-label">Storingen / Defecten</div><div className="ef-value">{storingen.join("\n")}</div></div>}
        {!isF && (e.personen || []).map((p, idx) => {
          const heeftWz = (p.synop_gedaan?.length || p.metar_gedaan?.length || p.klima_gedaan?.length || p.taf_gedaan?.length || p.digitaal_speci_gedaan || p.rr_gedaan);
          if (!heeftWz) return null;
          return (
            <div key={idx} className="ef-block">
              <div className="ef-label">{p.naam || `Persoon ${idx + 1}`}</div>
              <div className="ef-value">
                {p.synop_gedaan?.length ? `Synop: ${p.synop_gedaan.join(", ")}\n` : ""}
                {p.metar_gedaan?.length ? `Metar: ${p.metar_gedaan.join(", ")}\n` : ""}
                {p.klima_gedaan?.length ? `Klima: ${p.klima_gedaan.join(", ")}\n` : ""}
                {p.taf_gedaan?.length ? `TAF: ${p.taf_gedaan.join(", ")}\n` : ""}
                {p.digitaal_speci_gedaan ? `SPECI: ${p.digitaal_speci_welke || "Ja"}\n` : ""}
                {p.rr_gedaan ? "RR naar Klima: Verzonden" : ""}
              </div>
            </div>
          );
        })}
        {ef("Maaiwerkzaamheden", e.byz_maaiwerkzaamheden)}
        {(e.ziekmeldingen || []).length > 0 && (
          <div className="ef-block"><div className="ef-label">Ziektemeldingen</div><div className="ef-value">
            {e.ziekmeldingen.map((z, i) => `${[z.tijd, z.naam, z.periode].filter(Boolean).join(" — ")}`).filter(Boolean).join("\n")}
          </div></div>
        )}
        {(e.aanvragen || []).length > 0 && (
          <div className="ef-block"><div className="ef-label">Aanvragen</div><div className="ef-value">
            {e.aanvragen.map(a => `${[a.type, a.naam, a.periode].filter(Boolean).join(" — ")}`).filter(Boolean).join("\n")}
          </div></div>
        )}
        {ef("Algemeen", e.byz_algemeen)}
        {e.ingevuld_door && <div style={{ fontSize: 11, color: "var(--inkLo)", fontFamily: "IBM Plex Mono,monospace" }}>Ingevuld door: {e.ingevuld_door}</div>}
      </div>
    </div>
  );
}
