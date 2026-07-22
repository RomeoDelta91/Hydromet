import { useState, useEffect, useCallback, useMemo } from "react";
import { EXPORT_TREE, ALL_EXPORT_IDS } from "../constants.js";
import { today } from "../utils.js";
import { getEntries, deleteEntry, updateEntry } from "../api.js";
import EntryCard from "./EntryCard.jsx";
import ForecasterForm from "./ForecasterForm.jsx";
import ObserverForm from "./ObserverForm.jsx";
import AdministratieForm from "./AdministratieForm.jsx";
import { exportDocx } from "../export/exportDocx.js";
import { exportXlsx } from "../export/exportXlsx.js";

// Alle namen (meteoroloog + adjunct-meteorologen) van één entry, voor de
// naam-filter en de weergave.
function namenVan(e) {
  const uit = [];
  if (e.meteoroloog) uit.push(e.meteoroloog);
  (e.personen || []).forEach(p => p.naam && uit.push(p.naam));
  (e.administratie || []).forEach(n => n && uit.push(n));
  (e.onderhoud || []).forEach(n => n && uit.push(n));
  return uit;
}

export default function Overzicht({ canDelete, canEdit = true, showToast }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("alle");
  const [naamFilter, setNaamFilter] = useState("");
  const [periodeMode, setPeriodeMode] = useState("maand");
  const [maand, setMaand] = useState(today().slice(0, 7));
  const [dagVan, setDagVan] = useState(today());
  const [dagTot, setDagTot] = useState(today());
  const [selectedIds, setSelectedIds] = useState(ALL_EXPORT_IDS);
  const [editing, setEditing] = useState(null);

  const filters = {};
  if (periodeMode === "maand") filters.maand = maand;
  else if (periodeMode === "dag") filters.datum = dagVan;
  else { filters.van = dagVan; filters.tot = dagTot; }
  if (typeFilter !== "alle") filters.type = typeFilter;

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    getEntries(filters)
      .then(rows => setEntries(rows))
      .catch(err => setError(err.message || "Kon logboeken niet laden."))
      .finally(() => setLoading(false));
  }, [maand, periodeMode, dagVan, dagTot, typeFilter]);

  useEffect(() => { load(); }, [load]);

  // Naam-filter draait client-side op de al opgehaalde entries.
  const visibleEntries = useMemo(() => {
    const q = naamFilter.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(e => namenVan(e).some(n => n.toLowerCase().includes(q)));
  }, [entries, naamFilter]);

  // Export-selectie: per element (leaf). Een sectie is "aan" als al zijn
  // elementen aan staan, "deels" als sommige aan staan.
  const isElOn = id => selectedIds.includes(id);
  const toggleEl = id => setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const sectionState = sec => {
    const on = sec.elements.filter(el => isElOn(el.id)).length;
    if (on === 0) return "off";
    if (on === sec.elements.length) return "on";
    return "partial";
  };
  const toggleSection = sec => {
    const ids = sec.elements.map(el => el.id);
    const allOn = sectionState(sec) === "on";
    setSelectedIds(prev => (allOn ? prev.filter(x => !ids.includes(x)) : [...new Set([...prev, ...ids])]));
  };
  const allOn = selectedIds.length === ALL_EXPORT_IDS.length;
  const toggleAll = () => setSelectedIds(allOn ? [] : ALL_EXPORT_IDS);

  const handleDelete = async uuid => {
    if (!window.confirm("Wis dit logboek?")) return;
    try {
      await deleteEntry(uuid);
      showToast?.("Logboek verwijderd");
      load();
    } catch (err) {
      setError(err.message || "Verwijderen mislukt.");
    }
  };

  const handleEditSave = async updated => {
    try {
      await updateEntry(updated.uuid || updated.id, updated);
      showToast?.("✓ Logboek bijgewerkt");
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message || "Bijwerken mislukt.");
    }
  };

  const periodeNaam = () => {
    if (periodeMode === "maand") return maand;
    if (periodeMode === "dag") return dagVan;
    return `${dagVan}_tm_${dagTot}`;
  };

  if (editing) {
    const FormComp = editing.type === "forecaster" ? ForecasterForm : editing.type === "administratie" ? AdministratieForm : ObserverForm;
    return (
      <div className="section">
        <button className="btn btn-secondary" style={{ marginBottom: 12 }} onClick={() => setEditing(null)}>← Terug naar overzicht</button>
        <FormComp initial={editing} gebruiker={editing.ingevuld_door} onSave={handleEditSave} />
      </div>
    );
  }

  return (
    <div className="section">
      <div className="filter-panel">
        <h3>🔍 Filters &amp; Export</h3>

        <div style={{ marginBottom: 10 }}>
          <div className="cb-title" style={{ marginBottom: 6 }}>Periode</div>
          <div className="cb-row">
            {[["maand", "Per maand"], ["dag", "Één dag"], ["bereik", "Datumbereik"]].map(([v, l]) => (
              <label key={v} className={`cb-item${periodeMode === v ? " checked" : ""}`}>
                <input type="radio" name="periode" checked={periodeMode === v} onChange={() => setPeriodeMode(v)} />{l}
              </label>
            ))}
          </div>
        </div>

        <div className="filter-row">
          {periodeMode === "maand" && (
            <div className="filter-field"><label>Maand</label><input type="month" value={maand} onChange={e => setMaand(e.target.value)} /></div>
          )}
          {periodeMode === "dag" && (
            <div className="filter-field"><label>Datum</label><input type="date" value={dagVan} onChange={e => setDagVan(e.target.value)} /></div>
          )}
          {periodeMode === "bereik" && (<>
            <div className="filter-field"><label>Van</label><input type="date" value={dagVan} onChange={e => setDagVan(e.target.value)} /></div>
            <div className="filter-field"><label>Tot en met</label><input type="date" value={dagTot} onChange={e => setDagTot(e.target.value)} /></div>
          </>)}
          <div className="filter-field"><label>Type</label>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="alle">Alle</option>
              <option value="forecaster">Forecasters</option>
              <option value="observer">Observers</option>
              <option value="administratie">Administratie</option>
            </select>
          </div>
          <div className="filter-field"><label>Naam (meteoroloog / adjunct)</label>
            <input value={naamFilter} onChange={e => setNaamFilter(e.target.value)} placeholder="Filter op naam…" />
          </div>
        </div>

        <div style={{ marginTop: 4 }}>
          <div className="cb-title" style={{ marginBottom: 6 }}>Elementen in export
            <button onClick={toggleAll} style={{ marginLeft: 10, fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid var(--paperMid)", background: "var(--paper)", cursor: "pointer", color: "var(--inkMid)" }}>
              {allOn ? "Alles uit" : "Alles aan"}
            </button>
          </div>
          <div className="export-tree">
            {EXPORT_TREE.map(sec => {
              const st = sectionState(sec);
              const single = sec.elements.length === 1 && sec.elements[0].id === sec.id;
              return (
                <div key={sec.id} className="export-tree-sec">
                  <label className={`section-toggle${st !== "off" ? " on" : ""}`}>
                    <input
                      type="checkbox"
                      checked={st === "on"}
                      ref={el => el && (el.indeterminate = st === "partial")}
                      onChange={() => toggleSection(sec)}
                    />
                    <strong>{sec.label}</strong>
                  </label>
                  {!single && (
                    <div className="export-tree-elements">
                      {sec.elements.map(el => (
                        <label key={el.id} className={`section-toggle${isElOn(el.id) ? " on" : ""}`}>
                          <input type="checkbox" checked={isElOn(el.id)} onChange={() => toggleEl(el.id)} />{el.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn-export" onClick={() => exportDocx(visibleEntries, selectedIds, periodeNaam())}>⬇ Download Word (.docx)</button>
          <button className="btn btn-export" onClick={() => exportXlsx(visibleEntries, periodeNaam(), selectedIds)}>⬇ Download Excel (.xlsx)</button>
          <span style={{ fontSize: 12, color: "var(--inkLo)" }}>{visibleEntries.length} inzending{visibleEntries.length !== 1 ? "en" : ""} geselecteerd</span>
        </div>
      </div>

      {error && <div className="error-state">{error}</div>}
      {loading && <div className="loading-state">Logboeken laden…</div>}
      {!loading && visibleEntries.length === 0 && !error
        ? <div className="empty-state"><div style={{ fontSize: 32 }}>📭</div><p>Geen logboeken voor de geselecteerde filters.</p></div>
        : visibleEntries.map(e => <EntryCard key={e.uuid || e.id} e={e} onDelete={handleDelete} onEdit={canEdit ? setEditing : undefined} canDelete={canDelete} canEdit={canEdit} />)
      }
      <div style={{ height: 16 }} />
    </div>
  );
}
