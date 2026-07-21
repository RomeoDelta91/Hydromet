import { useState, useCallback } from "react";
import { TABS } from "./constants.js";
import { logout as apiLogout, saveEntry } from "./api.js";
import LoginWithName from "./components/LoginWithName.jsx";
import ForecasterForm from "./components/ForecasterForm.jsx";
import ObserverForm from "./components/ObserverForm.jsx";
import AdministratieForm from "./components/AdministratieForm.jsx";
import Overzicht from "./components/Overzicht.jsx";
import AnalysePanel from "./components/AnalysePanel.jsx";
import UserAdmin from "./components/UserAdmin.jsx";
import Toast from "./components/ui/Toast.jsx";

function tabsForRole(role) {
  return TABS.filter(t => t.roles.includes(role));
}

export default function App() {
  const [gebruiker, setGebruiker] = useState(() => localStorage.getItem("nmc_user_naam") || "");
  const [role, setRole] = useState(() => localStorage.getItem("nmc_user_role") || "");
  const [tab, setTab] = useState(() => tabsForRole(localStorage.getItem("nmc_user_role") || "")[0]?.id || "");
  const [toast, setToast] = useState("");

  const showToast = useCallback(msg => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

  const handleLogin = (naam, loginRole) => {
    setGebruiker(naam);
    setRole(loginRole);
    setTab(tabsForRole(loginRole)[0]?.id || "");
  };

  const handleLogout = () => {
    apiLogout();
    setGebruiker("");
    setRole("");
    setTab("");
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

  // Administratie mag het overzicht lezen en exporteren, maar niets bewerken of
  // verwijderen. Alleen chef/admin krijgen die knoppen.
  const canModify = role === "chef" || role === "admin";
  const visibleTabs = tabsForRole(role);

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

  if (!gebruiker) {
    return (
      <div className="app-shell">
        {header}
        <LoginWithName label="NMC Logboek Login" onLogin={handleLogin} />
      </div>
    );
  }

  const nav = (
    <div className="nav">
      {visibleTabs.map(t => (
        <button key={t.id} className={`nav-tab${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="app-shell">
      {header}
      {nav}

      {tab === "forecaster" && <ForecasterForm onSave={handleSaveForecaster} gebruiker={gebruiker} />}
      {tab === "observer" && <ObserverForm onSave={handleSaveForecaster} gebruiker={gebruiker} />}
      {tab === "administratie" && <AdministratieForm onSave={handleSaveForecaster} gebruiker={gebruiker} />}
      {tab === "overzicht" && <Overzicht canDelete={canModify} canEdit={canModify} showToast={showToast} />}
      {tab === "analyse" && <AnalysePanel />}
      {tab === "beheer" && <UserAdmin showToast={showToast} />}

      <Toast message={toast} />
    </div>
  );
}
