import { useEffect, useState } from "react";
import { getMededelingen, createMededeling, updateMededeling, deleteMededeling } from "../api.js";

// Mededelingenbord: forecasters en observers lezen, chef/admin mogen
// aanmaken/bewerken/verwijderen (bijv. verlof goed-/afgekeurd, updates van de chef).
export default function Mededelingen({ role }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nieuw, setNieuw] = useState("");
  const [bewerkId, setBewerkId] = useState(null);
  const [bewerkTekst, setBewerkTekst] = useState("");
  const canEdit = role === "chef" || role === "admin";

  const laad = async () => {
    setLoading(true);
    try {
      setItems(await getMededelingen());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) laad();
  }, [open]);

  const plaats = async () => {
    if (!nieuw.trim()) return;
    await createMededeling(nieuw.trim());
    setNieuw("");
    laad();
  };

  const startBewerk = item => {
    setBewerkId(item.id);
    setBewerkTekst(item.tekst);
  };

  const bewaarBewerk = async () => {
    if (!bewerkTekst.trim()) return;
    await updateMededeling(bewerkId, bewerkTekst.trim());
    setBewerkId(null);
    setBewerkTekst("");
    laad();
  };

  const verwijder = async id => {
    if (!window.confirm("Deze mededeling verwijderen?")) return;
    await deleteMededeling(id);
    laad();
  };

  return (
    <>
      <button type="button" className="nav-extra-btn" onClick={() => setOpen(true)}>📢 Mededelingen</button>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📢 Mededelingen</h3>
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Sluiten</button>
            </div>
            <div className="modal-body">
              {canEdit && (
                <div style={{ marginBottom: 16 }}>
                  <div className="field">
                    <label>Nieuwe mededeling</label>
                    <textarea value={nieuw} onChange={e => setNieuw(e.target.value)} placeholder="Bijv. verlofaanvraag goedgekeurd, storing verholpen, ..." />
                  </div>
                  <button type="button" className="btn btn-secondary" style={{ marginTop: 8 }} onClick={plaats}>+ Plaatsen</button>
                </div>
              )}
              {loading && <p style={{ fontSize: 12, color: "var(--inkLo)" }}>Laden…</p>}
              {!loading && items.length === 0 && <p style={{ fontSize: 12, color: "var(--inkLo)" }}>Nog geen mededelingen.</p>}
              {items.map(item => (
                <div key={item.id} className="mededeling-item">
                  {bewerkId === item.id ? (
                    <>
                      <div className="field"><textarea value={bewerkTekst} onChange={e => setBewerkTekst(e.target.value)} /></div>
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button type="button" className="btn btn-secondary" onClick={bewaarBewerk}>Opslaan</button>
                        <button type="button" className="btn btn-danger" onClick={() => setBewerkId(null)}>Annuleren</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "var(--ink)" }}>{item.tekst}</div>
                      <div className="meta">{item.auteur || "—"} · {item.datum}</div>
                      {canEdit && (
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button type="button" className="btn btn-secondary" onClick={() => startBewerk(item)}>Bewerk</button>
                          <button type="button" className="btn btn-danger" onClick={() => verwijder(item.id)}>Wis</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
