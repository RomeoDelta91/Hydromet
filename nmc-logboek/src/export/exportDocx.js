import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, PageBreak, BorderStyle,
} from "docx";
import { chefAantekeningVelden } from "../utils.js";

const BAD_STATUS = ["Storing", "Defect", "Uitgevallen"];
// Rood voor velden die de chef/admin achteraf gewijzigd heeft.
const CHEF_RED = "D94040";
// Groen voor een eigen correctie door de invoerder binnen het correctievenster.
const CORRECTIE_GROEN = "0B7A57";

// Lege velden worden niet overgeslagen maar als streepje getoond, zodat het
// document laat zien dat het veld bestond en niet is ingevuld.
const LEEG = "\u2014";
const w = v => (v === undefined || v === null || v === "" ? LEEG : v);
const lijst = v => (Array.isArray(v) && v.length ? v.join(", ") : LEEG);

const chefEditsVan = e => chefAantekeningVelden(e);
// Rood (chef) weegt zwaarder dan groen (eigen correctie) als een veld in beide staat.
const chefOpts = (e, key) => {
  if (chefEditsVan(e).includes(key)) return { color: CHEF_RED, bold: true };
  if ((e.correctie_velden || []).includes(key)) return { color: CORRECTIE_GROEN, bold: true };
  return {};
};

function cell(text, { bold = false, color, width } = {}) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text: String(text ?? ""), bold, color })] })],
  });
}

// `rows` is een array van al gebouwde TableRow-objecten (bijv. via kv()).
function table(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
}

function kv(label, value, opts = {}) {
  return new TableRow({ children: [cell(label, { bold: true, width: 35 }), cell(value, opts)] });
}

function heading(text, level = HeadingLevel.HEADING_2) {
  return new Paragraph({ text, heading: level, spacing: { before: 200, after: 100 } });
}

function statusRows(labels, entry) {
  const chefEdits = chefEditsVan(entry);
  return Object.entries(labels).map(([key, label]) => {
    const val = entry[key];
    const bad = BAD_STATUS.includes(val);
    const gemarkeerd = chefOpts(entry, key);
    const opts = Object.keys(gemarkeerd).length
      ? gemarkeerd
      : bad ? { color: "C0392B", bold: true } : {};
    return new TableRow({
      children: [cell(label, { bold: true, width: 35 }), cell(val ?? "OK", opts)],
    });
  });
}

function basisgegevensSection(e) {
  const isF = e.type === "forecaster";
  const isAdmin = e.type === "administratie";
  const personenNamen = (e.personen || []).map(p => p.naam).filter(Boolean).join(", ");
  const rows = [kv("Datum", w(e.datum))];
  if (!isAdmin) {
    rows.push(kv("Dienst", w(e.shift)));
    rows.push(kv("Shift", w(e.shift_code)));
  }
  if (isAdmin) {
    rows.push(kv("Administratie", w((e.administratie || []).filter(Boolean).join(", "))));
  } else {
    rows.push(kv(isF ? "Meteoroloog" : "Adjunct-meteorologen", w(isF ? (personenNamen || e.meteoroloog) : personenNamen)));
  }
  if (e.type === "observer") rows.push(kv("Security", w((e.security || []).filter(Boolean).join(", "))));
  if (isAdmin || e.type === "observer") {
    rows.push(kv("Onderhoudmedewerker", w((e.onderhoud || []).filter(Boolean).join(", "))));
  }
  if (isF) {
    rows.push(kv("Verwachtingen uitgebracht", lijst(e.verwachtingen_checks)));
    rows.push(kv("Anders (omschrijf)", w(e.verwachtingen)));
  }
  rows.push(kv("Ingevuld door", w(e.ingevuld_door)));
  return [heading("Basisgegevens"), table(rows)];
}

function administratieWerkSection(e) {
  const tekst = typeof e.werkzaamheden === "string" && e.werkzaamheden
    ? e.werkzaamheden
    : Object.entries(e.werkzaamheden_per_uur || {}).filter(([, v]) => v).map(([uur, v]) => `${uur}: ${v}`).join("\n");
  const blocks = [table([
    kv("Werkzaamheden-Admin", w(tekst), chefOpts(e, "werkzaamheden")),
    kv("Werkzaamheden-Onderhoud", w(e.onderhoud_notities), chefOpts(e, "onderhoud_notities")),
    kv("Spullen ontvangen", w(e.spullen_ontvangen), chefOpts(e, "spullen_ontvangen")),
    kv("Spullen verzonden", w(e.spullen_verzonden), chefOpts(e, "spullen_verzonden")),
  ])];
  return blocks;
}

// `andersKey` is het vrije tekstveld ("Anders") dat onder de statusrijen komt
// voor zaken die buiten de vaste categorieën vallen.
function statusSection(titel, labels, e, ids, andersKey) {
  const rows = statusRows(labels, e);
  if (ids.includes(andersKey)) rows.push(kv("Anders", w(e[andersKey]), chefOpts(e, andersKey)));
  if (!rows.length) return [];
  return [heading(titel, HeadingLevel.HEADING_3), table(rows)];
}

function werkzaamhedenSection(e) {
  if (e.type !== "observer") return [];
  const blocks = [heading("Werkzaamheden per persoon", HeadingLevel.HEADING_3)];
  (e.personen || []).forEach((p, idx) => {
    blocks.push(new Paragraph({ text: p.naam || `Persoon ${idx + 1}`, heading: HeadingLevel.HEADING_4 }));
    // Elk tijdstip met de bijbehorende initialen: "12 UTC (AB), 13 UTC (CD)".
    const withInit = (arr, initMap) => (arr || []).map(t => `${t}${initMap?.[t] ? ` (${initMap[t]})` : ""}`).join(", ") || LEEG;
    const rows = [
      kv("Synop-boek", withInit(p.synop_gedaan, p.synop_init)),
      kv("Synop-AMHS", withInit(p.synop_amhs_gedaan, p.synop_amhs_init)),
      kv("Metar-AMHS", withInit(p.metar_gedaan, p.metar_init)),
      kv("Klimawaarneming-boek", withInit(p.klima_gedaan, p.klima_init)),
      kv("Upload Metar website", withInit(p.upload_metar_gedaan, p.upload_metar_init)),
      kv("Digitale invoer WX website", withInit(p.digitaal_wx_gedaan, p.digitaal_wx_init)),
      kv("Digitale invoer Klima website", withInit(p.digitaal_klima_gedaan, p.digitaal_klima_init)),
      kv("Upload Synop WIS 2.0", withInit(p.wis_synop_gedaan, p.wis_synop_init)),
      kv("Verzenden TAF", withInit(p.taf_gedaan, p.taf_init)),
      kv("Digitale invoer SPECI website", p.digitaal_speci_gedaan ? (p.digitaal_speci_welke || "Ja") + (p.digitaal_speci_init ? ` (${p.digitaal_speci_init})` : "") : LEEG),
      kv("Verzenden RR naar Klima", p.rr_gedaan ? "Verzonden" + (p.rr_init ? ` (${p.rr_init})` : "") : LEEG),
    ];
    blocks.push(table(rows));
  });
  return blocks;
}

// Overige Werkzaamheden (Climate Report, ACT, ACS, Temp) ontbrak eerder
// volledig in de Word-export.
function overigeWerkSection(e) {
  if (e.type !== "observer") return [];
  const combineer = (status, extra, init) =>
    [status, extra, init && `(${init})`].filter(Boolean).join(" \u00b7 ") || LEEG;
  return [heading("Overige Werkzaamheden", HeadingLevel.HEADING_3), table([
    kv("Climate Report", combineer(e.wz_climate, e.wz_climate_maand, e.wz_climate_init), chefOpts(e, "wz_climate")),
    kv("ACT", combineer(e.wz_act, e.wz_act_maand, e.wz_act_init), chefOpts(e, "wz_act")),
    kv("ACS", combineer(e.wz_acs, e.wz_acs_maand, e.wz_acs_init), chefOpts(e, "wz_acs")),
    kv("Temp", combineer(e.wz_temp, [e.wz_temp_dag, e.wz_temp_tijd].filter(Boolean).join(" "), e.wz_temp_init), chefOpts(e, "wz_temp")),
  ])];
}

function webUploadSection(e) {
  if (e.type !== "forecaster") return [];
  return [heading("Web Upload", HeadingLevel.HEADING_3), table([
    kv("Producten geüpload", lijst(e.wu_products), chefOpts(e, "wu_products")),
    kv("Anders", w(e.wu_anders), chefOpts(e, "wu_anders")),
  ])];
}

function gemaildeVerwachtingenSection(e) {
  if (e.type !== "forecaster") return [];
  return [heading("Gemailde Verwachtingen", HeadingLevel.HEADING_3), table([
    kv("Gemailde producten", lijst(e.gemailde_verwachtingen), chefOpts(e, "gemailde_verwachtingen")),
  ])];
}

function notamSection(e) {
  if (e.type !== "forecaster") return [];
  return [heading("NOTAMs", HeadingLevel.HEADING_3), table([
    kv("Verzonden deze shift", e.notam_verzonden ? "Ja" : "Nee", chefOpts(e, "notam_verzonden")),
    kv("Voor shift(s)", lijst(e.notam_shifts), chefOpts(e, "notam_shifts")),
    kv("Opmerkingen", w(e.notam_opmerkingen), chefOpts(e, "notam_opmerkingen")),
  ])];
}

// `ids` bevat de geselecteerde leaf-id's; alleen die elementen komen mee.
function bijzonderhedenSection(e, ids) {
  const has = id => ids.includes(id);
  const logistiek = [
    ["byz_dienstauto", "Dienstauto"], ["byz_dienstbus", "Dienstbus"], ["byz_hydrofoor", "Hydrofoor"],
    ["byz_stroom", "Stroomonderbrekingen"], ["byz_swm", "Levering SWM water"],
    ["byz_toilet", "Toilet"], ["byz_maaiwerkzaamheden", "Maaiwerkzaamheden"], ["byz_logistiek_anders", "Anders"],
  ];
  const operationeel = [
    ["byz_airlines", "Airlines"], ["byz_operations", "Operations"], ["byz_atc", "ATC"], ["byz_toren", "Toren"],
  ];
  const blocks = [];

  // Geselecteerde velden komen altijd mee, ook als ze leeg zijn.
  const groep = (titel, velden) => {
    const rows = velden.filter(([k]) => has(k)).map(([k, l]) => kv(l, w(e[k]), chefOpts(e, k)));
    if (rows.length) blocks.push(heading(titel, HeadingLevel.HEADING_3), table(rows));
  };
  groep("Bijzonderheden \u2013 Logistiek", logistiek);
  groep("Bijzonderheden \u2013 Operationeel", operationeel);

  if (has("ziekmeldingen")) {
    const ziek = (e.ziekmeldingen || []).filter(z => z.tijd || z.naam || z.periode);
    blocks.push(heading("Ziektemeldingen", HeadingLevel.HEADING_3));
    blocks.push(ziek.length
      ? table([
          new TableRow({ children: [cell("Tijd", { bold: true, width: 20 }), cell("Naam", { bold: true, width: 40 }), cell("Periode", { bold: true, width: 40 })] }),
          ...ziek.map(z => new TableRow({ children: [cell(w(z.tijd)), cell(w(z.naam)), cell(w(z.periode))] })),
        ])
      : table([kv("Meldingen", LEEG, chefOpts(e, "ziekmeldingen"))]));
  }

  if (has("aanvragen")) {
    const aanvr = (e.aanvragen || []).filter(a => a.type || a.naam || a.periode);
    blocks.push(heading("Aanvragen", HeadingLevel.HEADING_3));
    blocks.push(aanvr.length
      ? table([
          new TableRow({ children: [cell("Type", { bold: true, width: 20 }), cell("Naam", { bold: true, width: 40 }), cell("Periode", { bold: true, width: 40 })] }),
          ...aanvr.map(a => new TableRow({ children: [cell(w(a.type)), cell(w(a.naam)), cell(w(a.periode))] })),
        ])
      : table([kv("Aanvragen", LEEG, chefOpts(e, "aanvragen"))]));
  }

  if (has("byz_algemeen")) {
    blocks.push(heading("Algemene Bijzonderheden", HeadingLevel.HEADING_3));
    blocks.push(table([kv("Algemeen", w(e.byz_algemeen), chefOpts(e, "byz_algemeen"))]));
  }
  return blocks;
}

// `ids` = geselecteerde leaf-id's (per element). Labels worden per element
// gefilterd zodat je bijv. binnen Instrumenten alleen RADAR kunt exporteren.
function entrySections(e, ids) {
  const isF = e.type === "forecaster";
  const isAdmin = e.type === "administratie";
  const filterLabels = full => Object.fromEntries(Object.entries(full).filter(([k]) => ids.includes(k)));
  const commLabels = isAdmin ? {} : filterLabels(isF
    ? { com_telefoon: "Telefoon", com_internet: "Internet", com_amhs: "AMHS", com_awos: "AWOS" }
    : { com_telefoon: "Telefoon", com_internet: "Internet", com_amhs: "AMHS", com_awos: "AWOS", com_werkmobiel: "Werkmobiel", com_charger: "Charger" });
  const instLabels = isAdmin ? {} : filterLabels(isF
    ? { inst_aws: "AWS", inst_awos: "AWOS", inst_pc_lhb: "PC LHB", inst_radar: "RADAR" }
    : { inst_conventioneel: "Conventioneel", inst_aws: "AWS", inst_awos: "AWOS", inst_radar: "RADAR" });

  const sec = id => ids.includes(id);
  const typeLabel = isF ? "Forecaster" : isAdmin ? "Administratie" : "Observer";
  const blocks = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: isAdmin ? `${e.datum} — ${typeLabel}` : `${e.datum} — ${e.shift} — ${typeLabel}` })],
    }),
  ];
  if ((e.correctie_velden || []).length) {
    const laatste = (e.correcties || [])[(e.correcties || []).length - 1];
    blocks.push(new Paragraph({
      children: [new TextRun({
        text: `Gecorrigeerd door ${laatste?.door || e.ingevuld_door || "—"}${laatste?.tijdstip ? ` · ${laatste.tijdstip}` : ""} — correcties staan in het groen.`,
        color: CORRECTIE_GROEN, bold: true, italics: true, size: 18,
      })],
    }));
  }
  if (chefEditsVan(e).length) {
    blocks.push(new Paragraph({
      children: [new TextRun({
        text: `Aantekening door chef: ${e.chef_edit_door || "—"}${e.chef_edit_datum ? ` · ${String(e.chef_edit_datum).slice(0, 10)}` : ""} — Aantekeningen staan in het rood.`,
        color: CHEF_RED, bold: true, italics: true, size: 18,
      })],
    }));
  }
  if (sec("basis")) blocks.push(...basisgegevensSection(e));
  if (!isAdmin) {
    blocks.push(...statusSection("Communicatie", commLabels, e, ids, "com_anders"));
    blocks.push(...statusSection("Instrumenten", instLabels, e, ids, "inst_anders"));
  }
  if (sec("werkzaamheden") && e.type === "observer") blocks.push(...werkzaamhedenSection(e), ...overigeWerkSection(e));
  if (sec("werkzaamheden") && isAdmin) blocks.push(...administratieWerkSection(e));
  if (sec("gemailde_verwachtingen")) blocks.push(...gemaildeVerwachtingenSection(e));
  if (sec("webupload")) blocks.push(...webUploadSection(e));
  if (sec("notams")) blocks.push(...notamSection(e));
  blocks.push(...bijzonderhedenSection(e, ids));
  return blocks;
}

export async function exportDocx(entries, sectionIds, periodeNaam) {
  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: `NMC Logboek – ${periodeNaam}` })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Gegenereerd op ${new Date().toLocaleString("nl-NL")}`, italics: true, size: 18 })],
    }),
  ];

  entries.forEach((e, idx) => {
    if (idx > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(...entrySections(e, sectionIds));
  });

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `NMC_Logboek_${periodeNaam}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
