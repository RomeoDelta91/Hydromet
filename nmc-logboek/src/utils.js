export const today = () => new Date().toISOString().slice(0, 10);
export const nowId = () => Date.now().toString(36);

// Een chef-aantekening hoort bij het bijwerken van een bestaand record, niet
// bij het aanmaken ervan. Bij het aanmaken wordt er nooit iets gestempeld, dus
// is de aanwezigheid van chef_edits genoeg — ook als de chef zijn eigen
// eerdere invoer aanpast, want ook dat is een aanpassing achteraf.
export function chefAantekeningVelden(e) {
  return Array.isArray(e?.chef_edits) ? e.chef_edits : [];
}

// Technische/meta-velden die niet meetellen bij het bepalen wat de chef
// inhoudelijk gewijzigd heeft.
const DIFF_SKIP = new Set([
  "id", "uuid", "ts", "ts_created", "ts_updated", "deleted_at", "data_json",
  "type", "ingevuld_door", "chef_edits", "chef_edit_door", "chef_edit_datum",
]);

// Vergelijkt een bewerkte entry met het origineel en geeft de veldnamen terug
// die inhoudelijk gewijzigd zijn, zodat die daarna rood getoond kunnen worden.
// Een ontbrekend veld, null, een lege tekst en een lege lijst betekenen
// allemaal "niets ingevuld". Zonder deze gelijkstelling zou het openen en
// opslaan van een ouder record elk veld dat sindsdien is toegevoegd als
// wijziging aanmerken, terwijl de chef er niets aan gedaan heeft.
function genormaliseerd(v) {
  if (v === undefined || v === null || v === "") return null;
  if (Array.isArray(v) && v.length === 0) return null;
  if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) return null;
  return v;
}

export function gewijzigdeVelden(origineel, bewerkt) {
  const keys = new Set([...Object.keys(origineel || {}), ...Object.keys(bewerkt || {})]);
  const uit = [];
  keys.forEach(k => {
    if (DIFF_SKIP.has(k)) return;
    const a = JSON.stringify(genormaliseerd(origineel?.[k]));
    const b = JSON.stringify(genormaliseerd(bewerkt?.[k]));
    if (a !== b) uit.push(k);
  });
  return uit;
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
