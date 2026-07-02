import { useState, useEffect, useCallback } from "react";
import { getUsers, createUser, updateUser, deleteUser } from "../api.js";

const ROLES = [
  { id: "forecaster", label: "Forecaster" },
  { id: "observer", label: "Observer" },
  { id: "administratie", label: "Administratie (Overzicht lezen + downloaden)" },
  { id: "chef", label: "Chef (Overzicht + bewerken/verwijderen)" },
  { id: "admin", label: "Admin (Beheer)" },
];

const DEF_NEW = { username: "", naam: "", password: "", role: "forecaster" };

export default function UserAdmin({ showToast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(DEF_NEW);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    getUsers()
      .then(setUsers)
      .catch(err => setError(err.message || "Kon gebruikers niet laden."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.username.trim() || !form.naam.trim() || !form.password) {
      setError("Gebruikersnaam, naam en wachtwoord zijn verplicht.");
      return;
    }
    try {
      await createUser(form);
      showToast?.("✓ Gebruiker aangemaakt");
      setForm(DEF_NEW);
      load();
    } catch (err) {
      setError(err.message || "Aanmaken mislukt.");
    }
  };

  const startEdit = u => {
    setEditingId(u.id);
    setEditForm({ naam: u.naam, role: u.role, actief: u.actief, password: "" });
  };

  const handleSaveEdit = async id => {
    try {
      const payload = { ...editForm };
      if (!payload.password) delete payload.password;
      await updateUser(id, payload);
      showToast?.("✓ Gebruiker bijgewerkt");
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.message || "Bijwerken mislukt.");
    }
  };

  const handleDelete = async id => {
    if (!window.confirm("Weet u zeker dat u deze gebruiker wilt verwijderen?")) return;
    try {
      await deleteUser(id);
      showToast?.("Gebruiker verwijderd");
      load();
    } catch (err) {
      setError(err.message || "Verwijderen mislukt.");
    }
  };

  return (
    <div className="section">
      <div className="card">
        <div className="card-header"><span>➕ Nieuwe gebruiker</span></div>
        <div className="card-body">
          <div className="field-grid">
            <div className="field"><label>Gebruikersnaam</label><input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} /></div>
            <div className="field"><label>Volledige naam</label><input value={form.naam} onChange={e => setForm(f => ({ ...f, naam: e.target.value }))} /></div>
          </div>
          <div className="field-grid">
            <div className="field"><label>Wachtwoord</label><input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
            <div className="field"><label>Rol</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
          </div>
          {error && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 4 }}>{error}</p>}
          <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={handleCreate}>Gebruiker aanmaken</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span>👥 Gebruikers</span></div>
        <div className="card-body">
          {loading && <div className="loading-state">Laden…</div>}
          {!loading && users.map(u => (
            <div key={u.id} style={{ borderBottom: "1px solid var(--paperMid)", padding: "10px 0" }}>
              {editingId === u.id ? (
                <div className="field-grid">
                  <div className="field"><label>Naam</label><input value={editForm.naam} onChange={e => setEditForm(f => ({ ...f, naam: e.target.value }))} /></div>
                  <div className="field"><label>Rol</label>
                    <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                      {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Nieuw wachtwoord (optioneel)</label><input type="password" value={editForm.password} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} /></div>
                  <div className="field"><label>Status</label>
                    <select value={editForm.actief ? "1" : "0"} onChange={e => setEditForm(f => ({ ...f, actief: e.target.value === "1" }))}>
                      <option value="1">Actief</option>
                      <option value="0">Geblokkeerd</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <button className="btn btn-primary" onClick={() => handleSaveEdit(u.id)}>Opslaan</button>
                    <button className="btn btn-secondary" onClick={() => setEditingId(null)}>Annuleren</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{u.naam} {!u.actief && <span style={{ color: "var(--danger)" }}>(geblokkeerd)</span>}</div>
                    <div style={{ fontSize: 12, color: "var(--inkLo)" }}>@{u.username} — {ROLES.find(r => r.id === u.role)?.label || u.role}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-secondary" onClick={() => startEdit(u)}>Bewerk</button>
                    <button className="btn btn-danger" onClick={() => handleDelete(u.id)}>Wis</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!loading && users.length === 0 && <p style={{ fontSize: 13, color: "var(--inkLo)" }}>Geen gebruikers gevonden.</p>}
        </div>
      </div>
    </div>
  );
}
