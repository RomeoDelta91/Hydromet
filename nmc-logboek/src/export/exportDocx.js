import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, PageBreak, BorderStyle,
} from "docx";

const BAD_STATUS = ["Storing", "Defect", "Uitgevallen"];
// Rood voor velden die de chef/admin achteraf gewijzigd heeft.
const CHEF_RED = "D94040";
// Oranje voor een eigen correctie door de invoerder binnen het correctievenster.
const CORRECTIE_ORANJE = "C87F0A";

const chefEditsVan = e => e.chef_edits || [];
// Rood (chef) weegt zwaarder dan oranje (eigen correctie) als een veld in beide staat.
const chefOpts = (e, key) => {
  if ((e.chef_edits || []).includes(key)) return { color: CHEF_RED, bold: true };
  if ((e.correctie_velden || []).includes(key)) return { color: CORRECTIE_ORANJE, bold: true };
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
  const rows = [kv("Datum", e.datum)];
  if (!isAdmin) rows.push(kv("Dienst", e.shift));
  if (!isAdmin && e.shift_code) rows.push(kv("Shift", e.shift_code));
  if (isAdmin) {
    rows.push(kv("Administratie", (e.administratie || []).filter(Boolean).join(", ") || "-"));
  } else {
    rows.push(kv(isF ? "Meteoroloog" : "Adjunct-meteorologen", isF ? (personenNamen || e.meteoroloog || "") : personenNamen));
  }
  if ((isAdmin || e.type === "observer") && (e.onderhoud || []).filter(Boolean).length) {
    rows.push(kv("Onderhoudmedewerker", e.onderhoud.filter(Boolean).join(", ")));
  }
  if (isF) {
    if ((e.verwachtingen_checks || []).length) rows.push(kv("Verwachtingen uitgebracht", e.verwachtingen_checks.join(", ")));
    if (e.verwachtingen) rows.push(kv("Anders (omschrijf)", e.verwachtingen));
  }
  rows.push(kv("Ingevuld door", e.ingevuld_door || ""));
  return [heading("Basisgegevens"), table(rows)];
}

function administratieWerkSection(e) {
  const blocks = [];
  // Oudere entries hadden werkzaamheden als per-uur object; toon die nog als
  // er geen `werkzaamheden`-tekstveld is (nieuw formaat).
  const tekst = typeof e.werkzaamheden === "string" && e.werkzaamheden
    ? e.werkzaamheden
    : Object.entries(e.werkzaamheden_per_uur || {}).filter(([, v]) => v).map(([uur, v]) => `${uur}: ${v}`).join("\n");
  if (tekst) {
    blocks.push(new Paragraph({ text: "Werkzaamheden-Admin", heading: HeadingLevel.HEADING_3 }));
    blocks.push(new Paragraph({ text: tekst }));
  }
  if (e.onderhoud_notities) {
    blocks.push(new Paragraph({ text: "Werkzaamheden-Onderhoud", heading: HeadingLevel.HEADING_4 }));
    blocks.push(new Paragraph({ text: e.onderhoud_notities }));
  }
  if (e.spullen_ontvangen) {
    blocks.push(new Paragraph({ text: "Spullen ontvangen", heading: HeadingLevel.HEADING_4 }));
    blocks.push(new Paragraph({ text: e.spullen_ontvangen }));
  }
  if (e.spullen_verzonden) {
    blocks.push(new Paragraph({ text: "Spullen verzonden", heading: HeadingLevel.HEADING_4 }));
    blocks.push(new Paragraph({ text: e.spullen_verzonden }));
  }
  return blocks;
}

// `andersKey` is het vrije tekstveld ("Anders") dat onder de statusrijen komt
// voor zaken die buiten de vaste categorieën vallen.
function statusSection(titel, labels, e, ids, andersKey) {
  const rows = statusRows(labels, e);
  if (ids.includes(andersKey) && e[andersKey]) rows.push(kv("Anders", e[andersKey], chefOpts(e, andersKey)));
  if (!rows.length) return [];
  return [heading(titel, HeadingLevel.HEADING_3), table(rows)];
}

function werkzaamhedenSection(e) {
  if (e.type !== "observer") return [];
  const blocks = [heading("Werkzaamheden per persoon", HeadingLevel.HEADING_3)];
  (e.personen || []).forEach((p, idx) => {
    blocks.push(new Paragraph({ text: p.naam || `Persoon ${idx + 1}`, heading: HeadingLevel.HEADING_4 }));
    // Elk tijdstip met de bijbehorende initialen: "12 UTC (AB), 13 UTC (CD)".
    const withInit = (arr, initMap) => (arr || []).map(t => `${t}${initMap?.[t] ? ` (${initMap[t]})` : ""}`).join(", ") || "-";
    const rows = [
      kv("Werktijd", `${p.werktijd_van || "?"} - ${p.werktijd_tot || "?"}`),
      kv("Synop-boek", withInit(p.synop_gedaan, p.synop_init)),
      kv("Synop-AMHS", withInit(p.synop_amhs_gedaan, p.synop_amhs_init)),
      kv("Metar-AMHS", withInit(p.metar_gedaan, p.metar_init)),
      kv("Klimawaarneming-boek", withInit(p.klima_gedaan, p.klima_init)),
      kv("TAF", withInit(p.taf_gedaan, p.taf_init)),
      kv("Digitaal SPECI", p.digitaal_speci_gedaan ? (p.digitaal_speci_welke || "Ja") + (p.digitaal_speci_init ? ` (${p.digitaal_speci_init})` : "") : "-"),
      kv("RR naar Klima", p.rr_gedaan ? "Verzonden" + (p.rr_init ? ` (${p.rr_init})` : "") : "-"),
    ];
    blocks.push(table(rows));
  });
  return blocks;
}

function webUploadSection(e) {
  if (e.type !== "forecaster") return [];
  if (!e.wu_products?.length && !e.wu_anders) return [];
  const items = [...(e.wu_products || []), e.wu_anders && `Anders: ${e.wu_anders}`].filter(Boolean).join(", ");
  return [heading("Web Upload", HeadingLevel.HEADING_3), new Paragraph({ text: items })];
}

function gemaildeVerwachtingenSection(e) {
  if (e.type !== "forecaster" || !(e.gemailde_verwachtingen || []).length) return [];
  return [heading("Gemailde Verwachtingen", HeadingLevel.HEADING_3), new Paragraph({ text: e.gemailde_verwachtingen.join(", ") })];
}

function notamSection(e) {
  if (e.type !== "forecaster" || !e.notam_verzonden) return [];
  const rows = (e.notam_shifts || []).map(s => new TableRow({ children: [cell("Shift", { bold: true, width: 35 }), cell(s)] }));
  if (e.notam_opmerkingen) rows.push(kv("Opmerkingen", e.notam_opmerkingen));
  return [heading("NOTAMs verzonden", HeadingLevel.HEADING_3), table(rows)];
}

// `ids` bevat de geselecteerde leaf-id's; alleen die elementen komen mee.
function bijzonderhedenSection(e, ids) {
  const has = id => ids.includes(id);
  const fields = [
    ["byz_dienstauto", "Dienstauto"], ["byz_dienstbus", "Dienstbus"], ["byz_hydrofoor", "Hydrofoor"],
    ["byz_stroom", "Stroomonderbrekingen"], ["byz_swm", "Levering SWM water"], ["byz_maaiwerkzaamheden", "Maaiwerkzaamheden"],
    ["byz_toilet", "Toilet"], ["byz_logistiek_anders", "Anders"],
    ["byz_airlines", "Airlines"], ["byz_operations", "Operations"], ["byz_atc", "ATC"], ["byz_toren", "Toren"],
  ];
  const rows = fields.filter(([k]) => has(k) && e[k]).map(([k, l]) => kv(l, e[k], chefOpts(e, k)));
  const blocks = [];
  if (rows.length) blocks.push(heading("Bijzonderheden", HeadingLevel.HEADING_3), table(rows));

  const ziek = has("ziekmeldingen") ? (e.ziekmeldingen || []).filter(z => z.tijd || z.naam || z.periode) : [];
  if (ziek.length) {
    blocks.push(heading("Ziektemeldingen", HeadingLevel.HEADING_3));
    blocks.push(table([
      new TableRow({ children: [cell("Tijd", { bold: true, width: 20 }), cell("Naam", { bold: true, width: 40 }), cell("Periode", { bold: true, width: 40 })] }),
      ...ziek.map(z => new TableRow({ children: [cell(z.tijd), cell(z.naam), cell(z.periode)] })),
    ]));
  }

  const aanvr = has("aanvragen") ? (e.aanvragen || []).filter(a => a.type || a.naam || a.periode) : [];
  if (aanvr.length) {
    blocks.push(heading("Aanvragen", HeadingLevel.HEADING_3));
    blocks.push(table([
      new TableRow({ children: [cell("Type", { bold: true, width: 20 }), cell("Naam", { bold: true, width: 40 }), cell("Periode", { bold: true, width: 40 })] }),
      ...aanvr.map(a => new TableRow({ children: [cell(a.type), cell(a.naam), cell(a.periode)] })),
    ]));
  }

  if (has("byz_algemeen") && e.byz_algemeen) {
    blocks.push(new Paragraph({ text: "Algemeen", heading: HeadingLevel.HEADING_4 }));
    blocks.push(new Paragraph({ children: [new TextRun({ text: e.byz_algemeen, ...chefOpts(e, "byz_algemeen") })] }));
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
        text: `Gecorrigeerd door ${laatste?.door || e.ingevuld_door || "—"}${laatste?.tijdstip ? ` · ${laatste.tijdstip}` : ""} — correcties staan in het oranje.`,
        color: CORRECTIE_ORANJE, bold: true, italics: true, size: 18,
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
  if (sec("werkzaamheden") && e.type === "observer") blocks.push(...werkzaamhedenSection(e));
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
