export const SHIFTS = [
  "Ochtenddienst (08:00–15:00 LT)",
  "Middagdienst (15:00–22:00 LT)",
  "Nachtdienst (22:00–08:00 LT)",
];

export const STATUS_OPTS = ["OK", "Storing", "Defect", "Uitgevallen", "N.v.t."];
export const WZ_OPTS = ["Niet gemaakt", "Gemaakt", "N.v.t."];

// Maaiwerkzaamheden (Logistiek): uitgevoerd door LHB of intern.
export const MAAIWERK_OPTS = ["", "LHB", "Intern"];

// Aanvragen: soorten die een medewerker kan indienen.
export const AANVRAAG_OPTS = ["Compensatie", "Verlof"];

export const MONTHS_NL = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];

// Nachtdienst loopt tot 08:00 LT (11 UTC) — 12 UTC hoort niet meer bij deze
// shift en is overal verwijderd (Synop-boek, Metar-AMHS, Upload Metar website,
// Digitale invoer WX website delen deze tijden allemaal).
export const SYNOP_TIMES = {
  "Ochtenddienst (08:00–15:00 LT)": ["12 UTC", "13 UTC", "14 UTC", "15 UTC", "16 UTC", "17 UTC", "18 UTC"],
  "Middagdienst (15:00–22:00 LT)": ["19 UTC", "20 UTC", "21 UTC", "22 UTC", "23 UTC", "00 UTC", "01 UTC"],
  "Nachtdienst (22:00–08:00 LT)": ["02 UTC", "03 UTC", "04 UTC", "05 UTC", "06 UTC", "07 UTC", "08 UTC", "09 UTC", "10 UTC", "11 UTC"],
};

// Synop-AMHS: eigen, beperktere set synop-tijden per shift (los van het
// volledige Synop-boek hierboven).
export const SYNOP_AMHS_TIMES = {
  "Ochtenddienst (08:00–15:00 LT)": ["12 UTC", "15 UTC", "18 UTC"],
  "Middagdienst (15:00–22:00 LT)": ["21 UTC", "00 UTC"],
  "Nachtdienst (22:00–08:00 LT)": ["03 UTC", "06 UTC", "09 UTC"],
};

export const KLIMA_SHIFT = {
  "Ochtenddienst (08:00–15:00 LT)": ["11:30 UTC", "17:30 UTC"],
  "Middagdienst (15:00–22:00 LT)": ["17:30 UTC", "21:30 UTC"],
  "Nachtdienst (22:00–08:00 LT)": [],
};

// WIS 2.0 Synop-upload is nu uurlijks, gelijk aan de volledige Synop-boek-tijden.
export const WIS_TIMES = {
  "Ochtenddienst (08:00–15:00 LT)": ["12 UTC", "13 UTC", "14 UTC", "15 UTC", "16 UTC", "17 UTC", "18 UTC"],
  "Middagdienst (15:00–22:00 LT)": ["19 UTC", "20 UTC", "21 UTC", "22 UTC", "23 UTC", "00 UTC", "01 UTC"],
  "Nachtdienst (22:00–08:00 LT)": ["02 UTC", "03 UTC", "04 UTC", "05 UTC", "06 UTC", "07 UTC", "08 UTC", "09 UTC", "10 UTC", "11 UTC"],
};

export const TAF_TIMES = {
  "Ochtenddienst (08:00–15:00 LT)": ["12 UTC", "18 UTC"],
  "Middagdienst (15:00–22:00 LT)": ["18 UTC", "00 UTC"],
  "Nachtdienst (22:00–08:00 LT)": ["00 UTC", "06 UTC", "12 UTC"],
};

export const WEB_PRODUCTS = [
  "Homepage", "Marineverwachting", "TAF", "Tabular Forecast",
  "Alert", "SIGMET", "Meerdaagse verwachting",
];

export const NOTAM_SHIFTS = [...SHIFTS];

// Verwachtingen die per shift uitgebracht kunnen worden (aanvinkopties in
// Basisgegevens bij Forecaster).
export const VERWACHTINGEN_PER_SHIFT = {
  "Ochtenddienst (08:00–15:00 LT)": ["TAF", "Verw OW/NCCR", "Media", "Tabular"],
  "Middagdienst (15:00–22:00 LT)": ["TAF", "WBS"],
  "Nachtdienst (22:00–08:00 LT)": ["TAF 06 UTC", "TAF 12 UTC", "Tabular"],
};

// Administratie werkt ma–vr 08:00–15:00 LT, zonder shiften. De shift-waarde
// wordt intern gebruikt (o.a. voor de duplicaat-check) maar niet aan de
// gebruiker getoond.
export const ADMIN_SHIFT = "Kantoordienst (08:00–15:00 LT)";

export const VERWACHT_PER_SHIFT = {
  "Ochtenddienst (08:00–15:00 LT)": { synop: 7, synop_amhs: 3, metar: 7, klima: 2, upload_metar: 7, digitaal_wx: 7, digitaal_klima: 2, wis: 7, rr: 1, taf: 2 },
  "Middagdienst (15:00–22:00 LT)": { synop: 7, synop_amhs: 2, metar: 7, klima: 2, upload_metar: 7, digitaal_wx: 7, digitaal_klima: 2, wis: 7, rr: 0, taf: 2 },
  "Nachtdienst (22:00–08:00 LT)": { synop: 10, synop_amhs: 3, metar: 10, klima: 0, upload_metar: 10, digitaal_wx: 10, digitaal_klima: 0, wis: 10, rr: 0, taf: 3 },
};

export const WZ_LABELS = {
  taf: "TAF verzonden",
  synop: "Synop-boek",
  synop_amhs: "Synop-AMHS",
  metar: "Metar-AMHS",
  klima: "Klimawaarneming-boek",
  upload_metar: "Upload Metar website",
  digitaal_wx: "Digitaal WX website",
  digitaal_klima: "Digitaal Klima website",
  wis: "WIS 2.0 Synop upload",
  rr: "Verzenden RR Klima",
};

export const STATUS_KEYS_COMM_OBS = ["com_telefoon", "com_internet", "com_amhs", "com_awos", "com_werkmobiel", "com_charger"];
export const STATUS_KEYS_INST_OBS = ["inst_conventioneel", "inst_aws", "inst_awos", "inst_radar"];
export const STATUS_KEYS_COMM_F = ["com_telefoon", "com_internet", "com_amhs", "com_awos"];
export const STATUS_KEYS_INST_F = ["inst_aws", "inst_awos", "inst_pc_lhb", "inst_radar"];

export const SYSTEM_LABELS = {
  com_telefoon: "Telefoon", com_internet: "Internet", com_amhs: "AMHS", com_awos: "AWOS comm.",
  com_werkmobiel: "Werkmobiel", com_charger: "Charger",
  inst_conventioneel: "Conventioneel", inst_aws: "AWS", inst_awos: "AWOS inst.",
  inst_radar: "RADAR", inst_pc_lhb: "PC LHB",
};

// Export-selectie op twee niveaus: een sectie (kopstuk) met daaronder losse
// elementen. In Overzicht kun je een heel kopstuk of individuele elementen
// aan/uit zetten. De leaf-`id`'s komen 1-op-1 overeen met de veldnamen in een
// entry, zodat de Word/Excel-export precies de gekozen elementen kan tonen.
// Secties zonder losbare elementen hebben één element met dezelfde id.
export const EXPORT_TREE = [
  { id: "basis", label: "Basisgegevens", elements: [{ id: "basis", label: "Basisgegevens" }] },
  { id: "communicatie", label: "Communicatie", elements: [
    { id: "com_telefoon", label: "Telefoon" },
    { id: "com_internet", label: "Internet" },
    { id: "com_amhs", label: "AMHS" },
    { id: "com_awos", label: "AWOS" },
    { id: "com_werkmobiel", label: "Werkmobiel" },
    { id: "com_charger", label: "Charger" },
  ] },
  { id: "instrumenten", label: "Instrumenten", elements: [
    { id: "inst_conventioneel", label: "Conventioneel" },
    { id: "inst_aws", label: "AWS" },
    { id: "inst_awos", label: "AWOS" },
    { id: "inst_pc_lhb", label: "PC LHB" },
    { id: "inst_radar", label: "RADAR" },
  ] },
  { id: "werkzaamheden", label: "Werkzaamheden", elements: [{ id: "werkzaamheden", label: "Werkzaamheden" }] },
  { id: "webupload", label: "Web Upload", elements: [{ id: "webupload", label: "Web Upload" }] },
  { id: "notams", label: "NOTAMs", elements: [{ id: "notams", label: "NOTAMs" }] },
  { id: "logistiek", label: "Logistiek", elements: [
    { id: "byz_dienstauto", label: "Dienstauto" },
    { id: "byz_dienstbus", label: "Dienstbus" },
    { id: "byz_hydrofoor", label: "Hydrofoor" },
    { id: "byz_stroom", label: "Stroomonderbrekingen" },
    { id: "byz_swm", label: "Levering SWM water" },
    { id: "byz_maaiwerkzaamheden", label: "Maaiwerkzaamheden" },
    { id: "byz_toilet", label: "Toilet" },
  ] },
  { id: "operationeel", label: "Operationeel", elements: [
    { id: "byz_airlines", label: "Airlines" },
    { id: "byz_operations", label: "Operations" },
    { id: "byz_atc", label: "ATC" },
    { id: "byz_toren", label: "Toren" },
  ] },
  { id: "ziekmeldingen", label: "Ziektemeldingen", elements: [{ id: "ziekmeldingen", label: "Ziektemeldingen" }] },
  { id: "aanvragen", label: "Aanvragen", elements: [{ id: "aanvragen", label: "Aanvragen" }] },
  { id: "algemeen", label: "Algemene Byz.", elements: [{ id: "byz_algemeen", label: "Algemene Byz." }] },
];

// Platte lijst van alle leaf-id's (standaard staat alles aan).
export const ALL_EXPORT_IDS = EXPORT_TREE.flatMap(s => s.elements.map(el => el.id));

// `roles` bepaalt welke ingelogde rol dit tabblad mag zien. Forecasters en
// observers zijn elk beperkt tot hun eigen sectie; chef/admin hebben volledige
// controle (Overzicht + Analyse). De administratie-rol mag het Overzicht alleen
// bekijken en downloaden (niet bewerken/verwijderen). Beheer is enkel voor admin.
export const TABS = [
  { id: "forecaster", label: "Forecaster", loginLabel: "Forecaster Login", roles: ["forecaster", "chef", "admin"] },
  { id: "observer", label: "Observer", loginLabel: "Observer Login", roles: ["observer", "chef", "admin"] },
  { id: "administratie", label: "Administratie", loginLabel: "Administratie Login", roles: ["administratie", "chef", "admin"] },
  { id: "overzicht", label: "Overzicht", loginLabel: "Overzicht Login", roles: ["administratie", "chef", "admin"] },
  { id: "analyse", label: "Analyse", loginLabel: "Analyse Login", roles: ["chef", "admin"] },
  { id: "beheer", label: "Beheer", loginLabel: "Beheer Login", roles: ["admin"] },
];

export const STORAGE_KEY = "nmc_logboek_v7";
