export const SHIFTS = [
  "Ochtenddienst (08:00–15:00 LT)",
  "Middagdienst (15:00–22:00 LT)",
  "Nachtdienst (22:00–08:00 LT)",
];

export const STATUS_OPTS = ["OK", "Storing", "Defect", "Uitgevallen", "N.v.t."];
export const WZ_OPTS = ["Niet gemaakt", "Gemaakt", "N.v.t."];

export const MONTHS_NL = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];

export const SYNOP_TIMES = {
  "Ochtenddienst (08:00–15:00 LT)": ["12 UTC", "13 UTC", "14 UTC", "15 UTC", "16 UTC", "17 UTC", "18 UTC"],
  "Middagdienst (15:00–22:00 LT)": ["19 UTC", "20 UTC", "21 UTC", "22 UTC", "23 UTC", "00 UTC", "01 UTC"],
  "Nachtdienst (22:00–08:00 LT)": ["02 UTC", "03 UTC", "04 UTC", "05 UTC", "06 UTC", "07 UTC", "08 UTC", "09 UTC", "10 UTC", "11 UTC", "12 UTC"],
};

export const KLIMA_SHIFT = {
  "Ochtenddienst (08:00–15:00 LT)": ["11:30 UTC", "17:30 UTC"],
  "Middagdienst (15:00–22:00 LT)": ["17:30 UTC", "21:30 UTC"],
  "Nachtdienst (22:00–08:00 LT)": [],
};

export const WIS_TIMES = {
  "Ochtenddienst (08:00–15:00 LT)": ["12 UTC", "15 UTC", "18 UTC"],
  "Middagdienst (15:00–22:00 LT)": ["21 UTC", "00 UTC"],
  "Nachtdienst (22:00–08:00 LT)": ["03 UTC", "06 UTC", "09 UTC"],
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

export const VERWACHT_PER_SHIFT = {
  "Ochtenddienst (08:00–15:00 LT)": { synop: 7, metar: 7, klima: 2, upload_metar: 7, digitaal_wx: 7, digitaal_klima: 2, wis: 3, rr: 1, taf: 2 },
  "Middagdienst (15:00–22:00 LT)": { synop: 7, metar: 7, klima: 2, upload_metar: 7, digitaal_wx: 7, digitaal_klima: 2, wis: 2, rr: 0, taf: 2 },
  "Nachtdienst (22:00–08:00 LT)": { synop: 11, metar: 11, klima: 0, upload_metar: 11, digitaal_wx: 11, digitaal_klima: 0, wis: 3, rr: 0, taf: 3 },
};

export const WZ_LABELS = {
  taf: "TAF verzonden",
  synop: "Synop",
  metar: "Metar",
  klima: "Klima waarneming",
  upload_metar: "Upload Metar website",
  digitaal_wx: "Digitaal WX website",
  digitaal_klima: "Digitaal Klima website",
  wis: "WIS 2.0 Synop upload",
  rr: "Verzenden RR Klima",
};

export const STATUS_KEYS_COMM_OBS = ["com_telefoon", "com_internet", "com_amhs", "com_awos", "com_werkmobiel", "com_charger"];
export const STATUS_KEYS_INST_OBS = ["inst_conventioneel", "inst_aws", "inst_awos", "inst_radar"];
export const STATUS_KEYS_COMM_F = ["com_telefoon", "com_internet", "com_amhs", "com_awos"];
export const STATUS_KEYS_INST_F = ["inst_aws", "inst_awos", "inst_pc_lhb", "inst_radar", "inst_werkmobiel", "inst_charger"];

export const SYSTEM_LABELS = {
  com_telefoon: "Telefoon", com_internet: "Internet", com_amhs: "AMHS", com_awos: "AWOS comm.",
  com_werkmobiel: "Werkmobiel", com_charger: "Charger",
  inst_conventioneel: "Conventioneel", inst_aws: "AWS", inst_awos: "AWOS inst.",
  inst_radar: "RADAR", inst_pc_lhb: "PC LHB",
};

export const EXPORT_SECTIONS = [
  { id: "basis", label: "Basisgegevens" },
  { id: "communicatie", label: "Communicatie" },
  { id: "instrumenten", label: "Instrumenten" },
  { id: "werkzaamheden", label: "Werkzaamheden" },
  { id: "overige_wz", label: "Overige WZ" },
  { id: "webupload", label: "Web Upload" },
  { id: "notams", label: "NOTAMs" },
  { id: "logistiek", label: "Logistiek" },
  { id: "operationeel", label: "Operationeel" },
  { id: "algemeen", label: "Algemene Byz." },
];

export const TABS = [
  { id: "forecaster", label: "Forecaster", loginLabel: "Forecaster Login" },
  { id: "observer", label: "Observer", loginLabel: "Observer Login" },
  { id: "overzicht", label: "Overzicht", loginLabel: "Overzicht Login" },
  { id: "analyse", label: "Analyse", loginLabel: "Analyse Login" },
  { id: "beheer", label: "Beheer", loginLabel: "Beheer Login", adminOnly: true },
];

export const STORAGE_KEY = "nmc_logboek_v7";
