import { useState, useCallback, useEffect, useRef } from "react";
import { TABS } from "./constants.js";
import { logout as apiLogout, saveEntry, corrigeerEntry, getUserRole, ruimOudeSessieOp } from "./api.js";
import LoginWithName from "./components/LoginWithName.jsx";
import ForecasterForm from "./components/ForecasterForm.jsx";
import ObserverForm from "./components/ObserverForm.jsx";
import AdministratieForm from "./components/AdministratieForm.jsx";
import Overzicht from "./components/Overzicht.jsx";
import AnalysePanel from "./components/AnalysePanel.jsx";
import UserAdmin from "./components/UserAdmin.jsx";
import EigenCorrectie from "./components/EigenCorrectie.jsx";
import Toast from "./components/ui/Toast.jsx";

// Automatisch uitloggen bij inactiviteit — het grootste risico op een gedeelde
// werkplek is een scherm dat open blijft staan, niet een gesloten tabblad.
const INACTIEF_UITLOG_MIN = 30;
const INACTIEF_WAARSCHUW_MIN = 25;

function tabsForRole(role) {
  return TABS.filter(t => t.roles.includes(role));
}

export default function App() {
  const [gebruiker, setGebruiker] = useState(() => sessionStorage.getItem("nmc_user_naam") || "");
  const [role, setRole] = useState(() => sessionStorage.getItem("nmc_user_role") || "");
  const [tab, setTab] = useState(() => tabsForRole(sessionStorage.getItem("nmc_user_role") || "")[0]?.id || "");
  const [toast, setToast] = useState("");
  const [correctie, setCorrectie] = useState(null);
  const [verversToken, setVerversToken] = useState(0);
  const [inactiefWaarschuwing, setInactiefWaarschuwing] = useState(false);
  const laatsteActiviteit = useRef(Date.now());

  const showToast = useCallback(msg => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

  const handleLogout = useCallback(() => {
    apiLogout();
    setGebruiker("");
    setRole("");
    setTab("");
    setCorrectie(null);
    setInactiefWaarschuwing(false);
  }, []);

  // Oude sessies stonden in localStorage en overleefden het sluiten van de
  // browser; die resten worden hier eenmalig opgeruimd.
  useEffect(() => { ruimOudeSessieOp(); }, []);

  // Token is 12 uur geldig. Is die verlopen terwijl het tabblad open stond,
  // dan hier meteen uitloggen in plaats van bij de eerste mislukte API-aanroep.
  useEffect(() => {
    if (!gebruiker) return;
    getUserRole().then(r => { if (!r) handleLogout(); }).catch(() => {});
  }, [gebruiker, handleLogout]);

  const meldActiviteit = useCallback(() => {
    laatsteActiviteit.current = Date.now();
    setInactiefWaarschuwing(false);
  }, []);

  useEffect(() => {
    if (!gebruiker) return;
    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, meldActiviteit, { passive: true }));
    const t = setInterval(() => {
      const min = (Date.now() - laatsteActiviteit.current) / 60000;
      if (min >= INACTIEF_UITLOG_MIN) {
        handleLogout();
        showToast("Automatisch uitgelogd wegens inactiviteit.");
      } else if (min >= INACTIEF_WAARSCHUW_MIN) {
        setInactiefWaarschuwing(true);
      }
    }, 15000);
    return () => {
      events.forEach(e => window.removeEventListener(e, meldActiviteit));
      clearInterval(t);
    };
  }, [gebruiker, handleLogout, meldActiviteit, showToast]);

  const handleLogin = (naam, loginRole) => {
    setGebruiker(naam);
    setRole(loginRole);
    setTab(tabsForRole(loginRole)[0]?.id || "");
    laatsteActiviteit.current = Date.now();
  };

  const handleSaveForecaster = async entry => {
    try {
      await saveEntry(entry);
      showToast("✓ Logboek opgeslagen");
      setVerversToken(v => v + 1);
    } catch (err) {
      const msg = (err.message || "").replace(/^DUPLICATE:/, "");
      showToast(msg || "Opslaan mislukt.");
      throw err;
    }
  };

  const handleCorrectieSave = async entry => {
    try {
      // Een correctie werkt het bestaande record bij; zonder uuid zou er een
      // los record kunnen ontstaan, dus dat wordt hier hard tegengehouden.
      if (!entry.uuid) {
        showToast("Correctie mislukt: het oorspronkelijke record ontbreekt.");
        return;
      }
      await corrigeerEntry(entry.uuid, entry);
      showToast("✓ Correctie opgeslagen");
      setCorrectie(null);
      setVerversToken(v => v + 1);
    } catch (err) {
      showToast(err.message || "Corrigeren mislukt.");
      throw err;
    }
  };

  // Administratie mag het overzicht lezen en exporteren, maar niets bewerken of
  // verwijderen. Alleen chef/admin krijgen die knoppen.
  const canModify = role === "chef" || role === "admin";
  // Viewer mag uitsluitend lezen: geen Word/Excel-download.
  const canExport = role !== "viewer";
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

  const footer = <div className="app-footer">Developed by: R. Rajai &amp; R. Bidesie</div>;

  if (!gebruiker) {
    return (
      <div className="app-shell">
        {header}
        <LoginWithName label="NMC Logboek Login" onLogin={handleLogin} />
        {footer}
      </div>
    );
  }

  const nav = (
    <div className="nav">
      {visibleTabs.map(t => (
        <button key={t.id} className={`nav-tab${tab === t.id ? " active" : ""}`} onClick={() => { setTab(t.id); setCorrectie(null); }}>
          {t.label}
        </button>
      ))}
    </div>
  );

  // Forecaster- en observertab: bij een lopende correctie het formulier in
  // correctiestand tonen, anders het correctieblok boven het lege formulier.
  // De `key` is essentieel: zonder een verschillende key hergebruikt React
  // hetzelfde formulier-component bij het wisselen tussen nieuw invullen en
  // corrigeren. Het formulier vult zijn velden alleen bij het aanmaken, dus
  // zou de opgehaalde invoer dan niet in beeld komen en bleef het scherm leeg.
  const formTab = (type, FormComp) => {
    if (correctie && correctie.type === type) {
      return (
        <>
          <button className="btn btn-secondary" style={{ marginBottom: 12 }} onClick={() => setCorrectie(null)}>
            ← Correctie annuleren
          </button>
          <FormComp
            key={`correctie-${correctie.uuid || correctie.id}`}
            initial={correctie}
            gebruiker={gebruiker}
            onSave={handleCorrectieSave}
            correctieMode
          />
        </>
      );
    }
    return (
      <>
        <EigenCorrectie onStart={setCorrectie} verversToken={verversToken} />
        <FormComp key="nieuw" onSave={handleSaveForecaster} gebruiker={gebruiker} />
      </>
    );
  };

  return (
    <div className="app-shell">
      {header}
      {nav}

      {inactiefWaarschuwing && (
        <div className="inactief-banner">
          U bent al een tijd niet actief. Over enkele minuten wordt u automatisch uitgelogd.
          <button type="button" className="btn btn-secondary" style={{ marginLeft: 10 }} onClick={meldActiviteit}>
            Ingelogd blijven
          </button>
        </div>
      )}

      {tab === "forecaster" && formTab("forecaster", ForecasterForm)}
      {tab === "observer" && formTab("observer", ObserverForm)}
      {tab === "administratie" && <AdministratieForm onSave={handleSaveForecaster} gebruiker={gebruiker} />}
      {tab === "overzicht" && <Overzicht canDelete={canModify} canEdit={canModify} canExport={canExport} showToast={showToast} gebruiker={gebruiker} role={role} />}
      {tab === "analyse" && <AnalysePanel canExport={canExport} />}
      {tab === "beheer" && <UserAdmin showToast={showToast} />}

      <Toast message={toast} />
      {footer}
    </div>
  );
}
