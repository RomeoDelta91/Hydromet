import { useState, useCallback } from "react";
import { TABS } from "./constants.js";
import { logout as apiLogout, saveEntry } from "./api.js";
import LoginWithName from "./components/LoginWithName.jsx";
import ForecasterForm from "./components/ForecasterForm.jsx";
import ObserverForm from "./components/ObserverForm.jsx";
import Overzicht from "./components/Overzicht.jsx";
import AnalysePanel from "./components/AnalysePanel.jsx";
import UserAdmin from "./components/UserAdmin.jsx";
import Toast from "./components/ui/Toast.jsx";

export default function App() {
  const [tab, setTab] = useState("forecaster");
  const [gebruiker, setGebruiker] = useState(() => localStorage.getItem("nmc_user_naam") || "");
  const [role, setRole] = useState(() => localStorage.getItem("nmc_user_role") || "");
  const [toast, setToast] = useState("");

  const showToast = useCallback(msg => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

  const handleLogin = (naam, role) => {
    setGebruiker(naam);
    setRole(role);
  };

  const handleLogout = () => {
    apiLogout();
    setGebruiker("");
    setRole("");
  };

  const handleSaveForecaster = async entry => {
    try {
      await saveEntry(entry);
      showToast("✓ Logboek opgeslagen");
    } catch (err) {
      const msg = (err.message || "").replace(/^DUPLICATE:/, "");
      showToast(msg || "Opslaan mislukt.");
      throw err;
    }
  };

  const canDelete = role === "chef" || role === "admin";
  const visibleTabs = TABS.filter(t => !t.adminOnly || role === "admin");

  const header = (
    <div className="app-header">
      <div className="app-header-row">
        <div>
          <h1>NMC Digitaal Logboek</h1>
          <p>Meteorologische Dienst Suriname</p>
        </div>
        {gebruiker && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "var(--inkLo)" }}>👤 {gebruiker}</span>
            <button className="btn btn-secondary" onClick={handleLogout}>Uitloggen</button>
          </div>
        )}
      </div>
    </div>
  );

  const nav = (
    <div className="nav">
      {visibleTabs.map(t => (
        <button key={t.id} className={`nav-tab${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );

  if (!gebruiker) {
    const current = TABS.find(t => t.id === tab) || TABS[0];
    return (
      <div className="app-shell">
        {header}
        <div className="nav">
          {TABS.filter(t => !t.adminOnly).map(t => (
            <button key={t.id} className={`nav-tab${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <LoginWithName label={current.loginLabel} onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      {header}
      {nav}

      {tab === "forecaster" && <ForecasterForm onSave={handleSaveForecaster} gebruiker={gebruiker} />}
      {tab === "observer" && <ObserverForm onSave={handleSaveForecaster} gebruiker={gebruiker} />}
      {tab === "overzicht" && <Overzicht canDelete={canDelete} showToast={showToast} />}
      {tab === "analyse" && <AnalysePanel />}
      {tab === "beheer" && (role === "admin" ? <UserAdmin showToast={showToast} /> : <div className="section"><p>Geen toegang.</p></div>)}

      <Toast message={toast} />
    </div>
  );
}
