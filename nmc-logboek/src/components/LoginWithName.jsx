import { useState } from "react";
import { login as apiLogin } from "../api.js";

export default function LoginWithName({ label, onLogin }) {
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const attempt = async () => {
    if (!username.trim()) { setErr("Vul uw gebruikersnaam in."); return; }
    if (!pw) { setErr("Vul uw wachtwoord in."); return; }
    setErr("");
    setLoading(true);
    const result = await apiLogin(username.trim(), pw);
    setLoading(false);
    if (!result.success) {
      setErr(result.error || "Onjuiste gebruikersnaam of wachtwoord.");
      setPw("");
      return;
    }
    onLogin(result.naam);
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h2>🔒 {label}</h2>
        <div className="field">
          <label>Gebruikersnaam</label>
          <input
            value={username}
            onChange={e => { setUsername(e.target.value); setErr(""); }}
            onKeyDown={e => e.key === "Enter" && attempt()}
            placeholder="WordPress gebruikersnaam"
          />
        </div>
        <div className="field">
          <label>Wachtwoord</label>
          <input
            className="pw-input"
            type="password"
            value={pw}
            onChange={e => { setPw(e.target.value); setErr(""); }}
            onKeyDown={e => e.key === "Enter" && attempt()}
            placeholder="Wachtwoord"
          />
        </div>
        {err && <div className="login-err">{err}</div>}
        <button className="btn btn-primary" onClick={attempt} disabled={loading}>
          {loading ? "Bezig met inloggen…" : "Inloggen"}
        </button>
      </div>
    </div>
  );
}
