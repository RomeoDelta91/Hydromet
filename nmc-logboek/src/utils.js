export const today = () => new Date().toISOString().slice(0, 10);
export const nowId = () => Date.now().toString(36);

// Een chef-aantekening hoort bij het bijwerken van een bestaand record, niet
// bij het aanmaken ervan. Bij het aanmaken wordt er nooit iets gestempeld, dus
// is de aanwezigheid van chef_edits genoeg — ook als de chef zijn eigen
// eerdere invoer aanpast, want ook dat is een aanpassing achteraf.
export function chefAantekeningVelden(e) {
  return Array.isArray(e?.chef_edits) ? e.chef_edits : [];
}

// Aanpassingen door de beheerder worden los van die van de chef bijgehouden:
// rood is een inhoudelijke aantekening van de chef, blauw een ingreep van de
// beheerder.
export function beheerAanpassingVelden(e) {
  return Array.isArray(e?.admin_edits) ? e.admin_edits : [];
}

// Technische/meta-velden die niet meetellen bij het bepalen wat de chef
// inhoudelijk gewijzigd heeft.
const DIFF_SKIP = new Set([
  "id", "uuid", "ts", "ts_created", "ts_updated", "deleted_at", "data_json",
  "type", "ingevuld_door",
  "chef_edits", "chef_edit_door", "chef_edit_datum", "chef_vorige_waarden",
  "admin_edits", "admin_edit_datum",
  "originele_versie", "correcties", "correctie_velden",
]);

// Vergelijkt een bewerkte entry met het origineel en geeft de veldnamen terug
// die inhoudelijk gewijzigd zijn, zodat die daarna rood getoond kunnen worden.
// Een ontbrekend veld, null, een lege tekst en een lege lijst betekenen
// allemaal "niets ingevuld". De vergelijking gaat door tot in geneste objecten
// en lijsten, zodat een veld dat pas later aan het formulier is toegevoegd en
// leeg wordt opgeslagen niet als wijziging telt.
function genormaliseerd(v) {
  if (v === undefined || v === null || v === "") return null;
  if (Array.isArray(v)) {
    const arr = v.map(genormaliseerd).filter(x => x !== null);
    return arr.length ? arr : null;
  }
  if (typeof v === "object") {
    const uit = {};
    Object.keys(v).sort().forEach(k => {
      const nv = genormaliseerd(v[k]);
      if (nv !== null) uit[k] = nv;
    });
    return Object.keys(uit).length ? uit : null;
  }
  return v;
}

const gelijk = (a, b) => JSON.stringify(genormaliseerd(a)) === JSON.stringify(genormaliseerd(b));

// `personen` is één veld met daarin alle namen en werkzaamheden. Zonder deze
// uitsplitsing zou één gewijzigd tijdstip het hele blok rood kleuren, inclusief
// de namen en alle andere categorieen. Daarom per persoon en per veld.
function diffPersonen(oud, nieuw) {
  const a = Array.isArray(oud) ? oud : [];
  const b = Array.isArray(nieuw) ? nieuw : [];
  const uit = [];
  if (a.length !== b.length) uit.push("personen");
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const pa = a[i] || {}, pb = b[i] || {};
    new Set([...Object.keys(pa), ...Object.keys(pb)]).forEach(k => {
      if (!gelijk(pa[k], pb[k])) uit.push(`personen.${i}.${k}`);
    });
  }
  return uit;
}

export function gewijzigdeVelden(origineel, bewerkt) {
  const keys = new Set([...Object.keys(origineel || {}), ...Object.keys(bewerkt || {})]);
  const uit = [];
  keys.forEach(k => {
    if (DIFF_SKIP.has(k)) return;
    if (k === "personen") {
      uit.push(...diffPersonen(origineel?.personen, bewerkt?.personen));
      return;
    }
    if (!gelijk(origineel?.[k], bewerkt?.[k])) uit.push(k);
  });
  return uit;
}

// Heeft de chef tekst tóégevoegd aan wat er al stond, geef dan het
// oorspronkelijke deel en de toevoeging apart terug. Zo hoeft alleen de
// aantekening rood, en niet de tekst van de invuller ervoor.
export function splitsAanvulling(waarde, vorigeWaarde) {
  if (typeof waarde !== "string" || typeof vorigeWaarde !== "string") return null;
  const oud = vorigeWaarde.trim();
  if (!oud || oud === waarde.trim()) return null;
  if (!waarde.startsWith(vorigeWaarde) && !waarde.startsWith(oud)) return null;
  const knip = waarde.startsWith(vorigeWaarde) ? vorigeWaarde.length : oud.length;
  const toevoeging = waarde.slice(knip);
  if (!toevoeging.trim()) return null;
  return { origineel: waarde.slice(0, knip), toevoeging };
}

// Een markering geldt als een van de opgegeven veldnamen in de lijst staat.
export function heeftMarkering(key, lijst) {
  if (!key || !lijst?.length) return false;
  return Array.isArray(key) ? key.some(k => lijst.includes(k)) : lijst.includes(key);
}


// Geeft { van, tot } (maandag t/m zondag, YYYY-MM-DD) van de week waarin
// `dateStr` valt.
export function getWeekRange(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const dag = d.getDay(); // 0 = zondag
  const offsetMaandag = dag === 0 ? -6 : 1 - dag;
  const maandag = new Date(d);
  maandag.setDate(d.getDate() + offsetMaandag);
  const zondag = new Date(maandag);
  zondag.setDate(maandag.getDate() + 6);
  const fmt = x => x.toISOString().slice(0, 10);
  return { van: fmt(maandag), tot: fmt(zondag) };
}

// Suriname = UTC-3. "08:30" LT → "11:30" UTC
export function ltToUtcMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  return ((h * 60 + m) + 3 * 60) % (24 * 60);
}

// "12 UTC" → minutes since midnight UTC
export function utcLabelToMinutes(label) {
  const h = parseInt(label.replace(" UTC", ""));
  return h * 60;
}

// Klima tijden naar minuten (hh:mm UTC format)
export function klimaToMinutes(label) {
  const [h, m] = label.replace(" UTC", "").split(":").map(Number);
  return h * 60 + m;
}

// Does a time range [vanMin, totMin] contain a UTC moment? Handles overnight ranges.
export function inRange(utcMin, vanMin, totMin) {
  if (vanMin === null || totMin === null) return true; // geen venster = volledig verantwoordelijk
  if (vanMin <= totMin) {
    return utcMin >= vanMin && utcMin < totMin;
  }
  return utcMin >= vanMin || utcMin < totMin;
}

export function inRangeKlima(label, vanMin, totMin) {
  if (vanMin === null || totMin === null) return true;
  return inRange(klimaToMinutes(label), vanMin, totMin);
}

// Filtert de shift-tijden op de werktijden van één persoon
export function filterTijdenVoorPersoon(shiftTijden, werktijdVan, werktijdTot) {
  if (!werktijdVan || !werktijdTot) return shiftTijden;
  const vanMin = ltToUtcMinutes(werktijdVan);
  const totMin = ltToUtcMinutes(werktijdTot);
  return shiftTijden.filter(t => inRange(utcLabelToMinutes(t), vanMin, totMin));
}
