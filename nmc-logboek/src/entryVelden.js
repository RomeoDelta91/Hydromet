// Eén gedeelde bron voor het tonen van een volledig logboek-record.
// Zowel het Overzicht (EntryCard) als de leesweergave "Vorige Records"
// gebruiken deze lijst, zodat beide altijd exact hetzelfde laten zien.
//
// Uitgangspunt: er wordt niets weggelaten. Elk kopstuk en elk veld komt in
// beeld — ook als het niet is ingevuld (dan blijft de waarde leeg) en ook als
// het op de standaardwaarde "OK" staat.

const BAD_STATUS = ["Storing", "Defect", "Uitgevallen"];

const lijst = v => (Array.isArray(v) ? v.filter(Boolean).join(", ") : "");
const tekst = v => (v === undefined || v === null ? "" : String(v));

// Eén regel. `waarschuwing` markeert een storing/defect (oranje), los van de
// rode chef-aantekening en de groene eigen correctie.
const rij = (key, label, waarde, waarschuwing = false) => ({ key, label, waarde: tekst(waarde), waarschuwing });

const statusRij = (key, label, waarde) => rij(key, label, waarde || "OK", BAD_STATUS.includes(waarde));

// Tijdstippen met de bijbehorende initialen: "12 UTC (AB), 13 UTC (CD)".
const metInit = (arr, initMap) =>
  (arr || []).map(t => `${t}${initMap?.[t] ? ` (${initMap[t]})` : ""}`).join(", ");

const fmtZiek = arr => (arr || [])
  .filter(z => z.tijd || z.naam || z.periode)
  .map(z => [z.tijd, z.naam, z.periode].filter(Boolean).join(" — "))
  .join("\n");

const fmtAanvraag = arr => (arr || [])
  .filter(a => a.type || a.naam || a.periode)
  .map(a => [a.type, a.naam, a.periode].filter(Boolean).join(" — "))
  .join("\n");

const LOGISTIEK = [
  ["byz_dienstauto", "Dienstauto"],
  ["byz_dienstbus", "Dienstbus"],
  ["byz_hydrofoor", "Hydrofoor"],
  ["byz_stroom", "Stroomonderbrekingen"],
  ["byz_swm", "Levering SWM water"],
  ["byz_toilet", "Toilet"],
  ["byz_maaiwerkzaamheden", "Maaiwerkzaamheden"],
  ["byz_logistiek_anders", "Anders"],
];

const OPERATIONEEL = [
  ["byz_airlines", "Airlines"],
  ["byz_operations", "Operations"],
  ["byz_atc", "ATC"],
  ["byz_toren", "Toren"],
];

// Werkzaamheden per persoon (observer): categorie met tijdstippen + initialen.
const WERK_CATS = [
  ["synop_gedaan", "synop_init", "Synop-boek"],
  ["synop_amhs_gedaan", "synop_amhs_init", "Synop-AMHS"],
  ["metar_gedaan", "metar_init", "Metar-AMHS"],
  ["klima_gedaan", "klima_init", "Klimawaarneming-boek"],
  ["upload_metar_gedaan", "upload_metar_init", "Upload Metar website"],
  ["digitaal_wx_gedaan", "digitaal_wx_init", "Digitale invoer WX website"],
  ["digitaal_klima_gedaan", "digitaal_klima_init", "Digitale invoer Klima website"],
  ["wis_synop_gedaan", "wis_synop_init", "Upload Synop WIS 2.0"],
  ["taf_gedaan", "taf_init", "Verzenden TAF"],
];

const OVERIGE_WERK = [
  ["wz_climate", "wz_climate_maand", "wz_climate_init", "Climate Report"],
  ["wz_act", "wz_act_maand", "wz_act_init", "ACT"],
  ["wz_acs", "wz_acs_maand", "wz_acs_init", "ACS"],
];

function logistiekSectie(e) {
  return { titel: "Bijzonderheden – Logistiek", rijen: LOGISTIEK.map(([k, l]) => rij(k, l, e[k])) };
}

function operationeelSectie(e) {
  return { titel: "Bijzonderheden – Operationeel", rijen: OPERATIONEEL.map(([k, l]) => rij(k, l, e[k])) };
}

function personeelSecties(e) {
  return [
    { titel: "Ziektemeldingen", rijen: [rij("ziekmeldingen", "Meldingen", fmtZiek(e.ziekmeldingen))] },
    { titel: "Aanvragen", rijen: [rij("aanvragen", "Aanvragen", fmtAanvraag(e.aanvragen))] },
    { titel: "Algemene Bijzonderheden", rijen: [rij("byz_algemeen", "Algemeen", e.byz_algemeen)] },
  ];
}

function forecasterSecties(e) {
  const namen = lijst((e.personen || []).map(p => p.naam)) || tekst(e.meteoroloog);
  return [
    { titel: "Basisgegevens", rijen: [
      rij("datum", "Datum", e.datum),
      rij("shift", "Dienst", e.shift),
      rij("shift_code", "Shift", e.shift_code),
      rij(["personen", "meteoroloog", ...(e.personen || []).map((_, i) => `personen.${i}.naam`)], "Meteoroloog(en)", namen),
      rij("verwachtingen_checks", "Verwachtingen uitgebracht", lijst(e.verwachtingen_checks)),
      rij("verwachtingen", "Verwachtingen – Anders", e.verwachtingen),
      rij("ingevuld_door", "Ingevuld door", e.ingevuld_door),
    ] },
    { titel: "Communicatie", rijen: [
      statusRij("com_telefoon", "Telefoon", e.com_telefoon),
      statusRij("com_internet", "Internet", e.com_internet),
      statusRij("com_amhs", "AMHS", e.com_amhs),
      statusRij("com_awos", "AWOS", e.com_awos),
      rij("com_anders", "Anders", e.com_anders),
    ] },
    { titel: "Instrumenten", rijen: [
      statusRij("inst_aws", "AWS", e.inst_aws),
      statusRij("inst_awos", "AWOS", e.inst_awos),
      statusRij("inst_pc_lhb", "PC LHB", e.inst_pc_lhb),
      statusRij("inst_radar", "RADAR", e.inst_radar),
      rij("inst_anders", "Anders", e.inst_anders),
    ] },
    { titel: "Gemailde Verwachtingen", rijen: [
      rij("gemailde_verwachtingen", "Gemailde producten", lijst(e.gemailde_verwachtingen)),
    ] },
    { titel: "Web Upload", rijen: [
      rij("wu_products", "Producten geüpload", lijst(e.wu_products)),
      rij("wu_anders", "Anders", e.wu_anders),
    ] },
    { titel: "NOTAMs", rijen: [
      rij("notam_verzonden", "Verzonden deze shift", e.notam_verzonden ? "Ja" : "Nee"),
      rij("notam_shifts", "Voor shift(s)", lijst(e.notam_shifts)),
      rij("notam_opmerkingen", "Opmerkingen", e.notam_opmerkingen),
    ] },
    logistiekSectie(e),
    operationeelSectie(e),
    ...personeelSecties(e),
  ];
}

function observerSecties(e) {
  const personen = (e.personen || []).length ? e.personen : [{}];
  return [
    { titel: "Basisgegevens", rijen: [
      rij("datum", "Datum", e.datum),
      rij("shift", "Dienst", e.shift),
      rij("shift_code", "Shift", e.shift_code),
      rij(["personen", ...personen.map((_, i) => `personen.${i}.naam`)], "Adjunct-meteorologen", lijst(personen.map(p => p.naam))),
      rij("security", "Security", lijst(e.security)),
      rij("onderhoud", "Onderhoudmedewerker", lijst(e.onderhoud)),
      rij("ingevuld_door", "Ingevuld door", e.ingevuld_door),
    ] },
    { titel: "Communicatie", rijen: [
      statusRij("com_telefoon", "Telefoon", e.com_telefoon),
      statusRij("com_internet", "Internet", e.com_internet),
      statusRij("com_amhs", "AMHS", e.com_amhs),
      statusRij("com_awos", "AWOS", e.com_awos),
      statusRij("com_werkmobiel", "Werkmobiel", e.com_werkmobiel),
      statusRij("com_charger", "Charger", e.com_charger),
      rij("com_anders", "Anders", e.com_anders),
    ] },
    { titel: "Instrumenten", rijen: [
      statusRij("inst_conventioneel", "Conventioneel", e.inst_conventioneel),
      statusRij("inst_aws", "AWS", e.inst_aws),
      statusRij("inst_awos", "AWOS", e.inst_awos),
      statusRij("inst_radar", "RADAR", e.inst_radar),
      rij("inst_anders", "Anders", e.inst_anders),
    ] },
    {
      titel: "Werkzaamheden per persoon",
      subblokken: personen.map((persoon, idx) => ({
        titel: persoon.naam || `Persoon ${idx + 1}`,
        rijen: [
          ...WERK_CATS.map(([gedaan, init, label]) =>
            rij([`personen.${idx}.${gedaan}`, `personen.${idx}.${init}`], label, metInit(persoon[gedaan], persoon[init]))),
          rij([`personen.${idx}.digitaal_speci_gedaan`, `personen.${idx}.digitaal_speci_welke`, `personen.${idx}.digitaal_speci_init`],
            "Digitale invoer SPECI website", persoon.digitaal_speci_gedaan
            ? `${persoon.digitaal_speci_welke || "Ja"}${persoon.digitaal_speci_init ? ` (${persoon.digitaal_speci_init})` : ""}`
            : ""),
          rij([`personen.${idx}.rr_gedaan`, `personen.${idx}.rr_init`], "Verzenden RR naar Klima", persoon.rr_gedaan
            ? `Verzonden${persoon.rr_init ? ` (${persoon.rr_init})` : ""}`
            : ""),
        ],
      })),
    },
    { titel: "Overige Werkzaamheden", rijen: [
      ...OVERIGE_WERK.map(([statusKey, maandKey, initKey, label]) => rij(
        statusKey, label,
        [e[statusKey], e[maandKey], e[initKey] && `(${e[initKey]})`].filter(Boolean).join(" · "),
      )),
      rij("wz_temp", "Temp", [
        e.wz_temp,
        [e.wz_temp_dag, e.wz_temp_tijd].filter(Boolean).join(" "),
        e.wz_temp_init && `(${e.wz_temp_init})`,
      ].filter(Boolean).join(" · ")),
    ] },
    logistiekSectie(e),
    operationeelSectie(e),
    ...personeelSecties(e),
  ];
}

function administratieSecties(e) {
  // Oudere entries hadden werkzaamheden als per-uur object i.p.v. één tekstveld.
  const werk = typeof e.werkzaamheden === "string" && e.werkzaamheden
    ? e.werkzaamheden
    : Object.entries(e.werkzaamheden_per_uur || {}).filter(([, v]) => v).map(([uur, v]) => `${uur}: ${v}`).join("\n");
  return [
    { titel: "Basisgegevens", rijen: [
      rij("datum", "Datum", e.datum),
      rij("administratie", "Administratie", lijst(e.administratie)),
      rij("onderhoud", "Onderhoudmedewerker", lijst(e.onderhoud)),
      rij("ingevuld_door", "Ingevuld door", e.ingevuld_door),
    ] },
    { titel: "Werkzaamheden", rijen: [
      rij("werkzaamheden", "Werkzaamheden-Admin", werk),
      rij("onderhoud_notities", "Werkzaamheden-Onderhoud", e.onderhoud_notities),
      rij("spullen_ontvangen", "Spullen ontvangen", e.spullen_ontvangen),
      rij("spullen_verzonden", "Spullen verzonden", e.spullen_verzonden),
    ] },
    logistiekSectie(e),
    ...personeelSecties(e),
  ];
}

export function sectiesVoorEntry(e) {
  if (e.type === "forecaster") return forecasterSecties(e);
  if (e.type === "administratie") return administratieSecties(e);
  return observerSecties(e);
}
