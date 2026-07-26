import * as XLSX from "xlsx";

// Kolomdefinities. `id: null` = altijd zichtbaar; anders alleen als die
// leaf-id in de Overzicht-selectie staat (zelfde ids als EXPORT_TREE).
const COLUMN_DEFS = [
  { id: null, key: "datum", label: "Datum" },
  { id: null, key: "shift", label: "Dienst" },
  { id: null, key: "shift_code", label: "Shift" },
  { id: null, key: "type", label: "Type" },
  { id: null, key: "naam", label: "Naam" },
  { id: null, key: "onderhoud_namen", label: "Onderhoudmedewerker" },
  { id: "com_telefoon", key: "com_telefoon", label: "Telefoon" },
  { id: "com_internet", key: "com_internet", label: "Internet" },
  { id: "com_amhs", key: "com_amhs", label: "AMHS" },
  { id: "com_awos", key: "com_awos", label: "AWOS (comm.)" },
  { id: "com_werkmobiel", key: "com_werkmobiel", label: "Werkmobiel" },
  { id: "com_charger", key: "com_charger", label: "Charger" },
  { id: "inst_conventioneel", key: "inst_conventioneel", label: "Conventioneel" },
  { id: "inst_aws", key: "inst_aws", label: "AWS" },
  { id: "inst_awos", key: "inst_awos", label: "AWOS (inst.)" },
  { id: "inst_pc_lhb", key: "inst_pc_lhb", label: "PC LHB" },
  { id: "inst_radar", key: "inst_radar", label: "RADAR" },
  { id: "werkzaamheden", key: "werkzaamheden", label: "Werkzaamheden-Admin" },
  { id: "werkzaamheden", key: "onderhoud_notities", label: "Werkzaamheden-Onderhoud" },
  { id: "werkzaamheden", key: "spullen_ontvangen", label: "Spullen ontvangen" },
  { id: "werkzaamheden", key: "spullen_verzonden", label: "Spullen verzonden" },
  { id: "gemailde_verwachtingen", key: "gemailde_verwachtingen", label: "Gemailde Verwachtingen" },
  { id: "webupload", key: "webupload", label: "Web Upload" },
  { id: "notams", key: "notams", label: "NOTAMs" },
  { id: "byz_dienstauto", key: "byz_dienstauto", label: "Dienstauto" },
  { id: "byz_dienstbus", key: "byz_dienstbus", label: "Dienstbus" },
  { id: "byz_hydrofoor", key: "byz_hydrofoor", label: "Hydrofoor" },
  { id: "byz_stroom", key: "byz_stroom", label: "Stroomonderbrekingen" },
  { id: "byz_swm", key: "byz_swm", label: "Levering SWM water" },
  { id: "byz_maaiwerkzaamheden", key: "byz_maaiwerkzaamheden", label: "Maaiwerkzaamheden" },
  { id: "byz_toilet", key: "byz_toilet", label: "Toilet" },
  { id: "byz_logistiek_anders", key: "byz_logistiek_anders", label: "Logistiek – Anders" },
  { id: "byz_airlines", key: "byz_airlines", label: "Airlines" },
  { id: "byz_operations", key: "byz_operations", label: "Operations" },
  { id: "byz_atc", key: "byz_atc", label: "ATC" },
  { id: "byz_toren", key: "byz_toren", label: "Toren" },
  { id: "ziekmeldingen", key: "ziekmeldingen", label: "Ziektemeldingen" },
  { id: "aanvragen", key: "aanvragen", label: "Aanvragen" },
  { id: "byz_algemeen", key: "byz_algemeen", label: "Algemeen" },
];

const fmtZiek = arr => (arr || []).map(z => [z.tijd, z.naam, z.periode].filter(Boolean).join(" ")).filter(Boolean).join(" | ");
const fmtAanvr = arr => (arr || []).map(a => [a.type, a.naam, a.periode].filter(Boolean).join(" ")).filter(Boolean).join(" | ");

function werkzaamhedenVoor(e, persoon) {
  if (e.type === "observer" && persoon) {
    const withInit = (arr, initMap) => (arr || []).map(t => `${t}${initMap?.[t] ? ` (${initMap[t]})` : ""}`).join(", ");
    return [
      `Synop-boek: ${withInit(persoon.synop_gedaan, persoon.synop_init) || "-"}`,
      `Synop-AMHS: ${withInit(persoon.synop_amhs_gedaan, persoon.synop_amhs_init) || "-"}`,
      `Metar-AMHS: ${withInit(persoon.metar_gedaan, persoon.metar_init) || "-"}`,
      `Klimawaarneming-boek: ${withInit(persoon.klima_gedaan, persoon.klima_init) || "-"}`,
      `TAF: ${withInit(persoon.taf_gedaan, persoon.taf_init) || "-"}`,
      persoon.digitaal_speci_gedaan ? `SPECI: ${persoon.digitaal_speci_welke || "Ja"}${persoon.digitaal_speci_init ? ` (${persoon.digitaal_speci_init})` : ""}` : "",
      persoon.rr_gedaan ? `RR naar Klima: Verzonden${persoon.rr_init ? ` (${persoon.rr_init})` : ""}` : "",
    ].filter(Boolean).join(" | ");
  }
  if (e.type === "administratie") {
    if (typeof e.werkzaamheden === "string" && e.werkzaamheden) return e.werkzaamheden;
    return Object.entries(e.werkzaamheden_per_uur || {})
      .filter(([, v]) => v)
      .map(([uur, v]) => `${uur}: ${v}`)
      .join(" | ");
  }
  return "";
}

function webUploadVoor(e) {
  if (e.type !== "forecaster") return "";
  return [...(e.wu_products || []), e.wu_anders && `Anders: ${e.wu_anders}`].filter(Boolean).join(", ");
}

function gemaildeVerwachtingenVoor(e) {
  if (e.type !== "forecaster") return "";
  return (e.gemailde_verwachtingen || []).join(", ");
}

function notamsVoor(e) {
  if (e.type !== "forecaster") return "";
  if (!e.notam_verzonden) return "Nee";
  return [`Ja (${(e.notam_shifts || []).join(", ")})`, e.notam_opmerkingen].filter(Boolean).join(" — ");
}

// Bouwt één rij (of, bij observer, één rij per persoon) met alle velden die
// van toepassing zijn op het type. Niet-toepasselijke velden blijven leeg.
function rowsForEntry(e) {
  const base = {
    shift: e.type === "administratie" ? "" : (e.shift || ""),
    shift_code: e.type === "administratie" ? "" : (e.shift_code || ""),
    type: e.type,
    com_telefoon: e.com_telefoon ?? "", com_internet: e.com_internet ?? "", com_amhs: e.com_amhs ?? "", com_awos: e.com_awos ?? "",
    com_werkmobiel: e.com_werkmobiel ?? "", com_charger: e.com_charger ?? "",
    inst_conventioneel: e.inst_conventioneel ?? "", inst_aws: e.inst_aws ?? "", inst_awos: e.inst_awos ?? "",
    inst_pc_lhb: e.inst_pc_lhb ?? "", inst_radar: e.inst_radar ?? "",
    webupload: webUploadVoor(e), notams: notamsVoor(e), gemailde_verwachtingen: gemaildeVerwachtingenVoor(e),
    byz_dienstauto: e.byz_dienstauto ?? "", byz_dienstbus: e.byz_dienstbus ?? "", byz_hydrofoor: e.byz_hydrofoor ?? "",
    byz_stroom: e.byz_stroom ?? "", byz_swm: e.byz_swm ?? "", byz_maaiwerkzaamheden: e.byz_maaiwerkzaamheden ?? "",
    byz_toilet: e.byz_toilet ?? "", byz_logistiek_anders: e.byz_logistiek_anders ?? "",
    byz_airlines: e.byz_airlines ?? "", byz_operations: e.byz_operations ?? "", byz_atc: e.byz_atc ?? "", byz_toren: e.byz_toren ?? "",
    ziekmeldingen: fmtZiek(e.ziekmeldingen), aanvragen: fmtAanvr(e.aanvragen),
    onderhoud_notities: e.onderhoud_notities ?? "",
    onderhoud_namen: e.type === "administratie" ? "" : (e.onderhoud || []).filter(Boolean).join(", "),
    spullen_ontvangen: e.spullen_ontvangen ?? "",
    spullen_verzonden: e.spullen_verzonden ?? "",
    byz_algemeen: e.byz_algemeen ?? "",
  };

  if (e.type === "forecaster") {
    const naam = (e.personen || []).map(p => p.naam).filter(Boolean).join(", ") || e.meteoroloog || "";
    return [{ datum: e.datum, naam, werkzaamheden: "", ...base }];
  }
  if (e.type === "administratie") {
    const naam = (e.administratie || []).filter(Boolean).join(", ");
    const onderhoud_namen = (e.onderhoud || []).filter(Boolean).join(", ");
    return [{ ...base, datum: e.datum, naam, onderhoud_namen, werkzaamheden: werkzaamhedenVoor(e) }];
  }
  const personen = e.personen?.length ? e.personen : [{}];
  return personen.map(p => ({ datum: e.datum, naam: p.naam || "", werkzaamheden: werkzaamhedenVoor(e, p), ...base }));
}

export function exportXlsx(entries, periodeNaam, selectedIds) {
  const cols = selectedIds ? COLUMN_DEFS.filter(c => c.id === null || selectedIds.includes(c.id)) : COLUMN_DEFS;
  const header = cols.map(c => c.label);
  const keyOrder = cols.map(c => c.key);

  const rows = entries.flatMap(rowsForEntry).map(row => {
    const out = {};
    keyOrder.forEach((key, i) => { out[header[i]] = row[key] ?? ""; });
    return out;
  });

  const ws = XLSX.utils.json_to_sheet(rows, { header });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Logboek");
  XLSX.writeFile(wb, `NMC_Logboek_${periodeNaam}.xlsx`);
}
