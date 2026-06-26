export const today = () => new Date().toISOString().slice(0, 10);
export const nowId = () => Date.now().toString(36);

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
