import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, PageBreak, BorderStyle,
} from "docx";

const BAD_STATUS = ["Storing", "Defect", "Uitgevallen"];

function cell(text, { bold = false, color, width } = {}) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text: String(text ?? ""), bold, color })] })],
  });
}

function table(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(r => new TableRow({ children: r })),
  });
}

function kv(label, value, opts = {}) {
  return new TableRow({ children: [cell(label, { bold: true, width: 35 }), cell(value, opts)] });
}

function heading(text, level = HeadingLevel.HEADING_2) {
  return new Paragraph({ text, heading: level, spacing: { before: 200, after: 100 } });
}

function statusRows(labels, entry) {
  return Object.entries(labels).map(([key, label]) => {
    const val = entry[key];
    const bad = BAD_STATUS.includes(val);
    return new TableRow({
      children: [cell(label, { bold: true, width: 35 }), cell(val ?? "OK", bad ? { color: "C0392B", bold: true } : {})],
    });
  });
}

function basisgegevensSection(e) {
  const isF = e.type === "forecaster";
  const isAdmin = e.type === "administratie";
  const personenNamen = (e.personen || []).map(p => p.naam).filter(Boolean).join(", ");
  const rows = [kv("Datum", e.datum)];
  if (!isAdmin) rows.push(kv("Shift", e.shift));
  if (isAdmin) {
    rows.push(kv("Administratie", (e.administratie || []).filter(Boolean).join(", ") || "-"));
    rows.push(kv("Onderhoudmedewerker", (e.onderhoud || []).filter(Boolean).join(", ") || "-"));
  } else {
    rows.push(kv(isF ? "Meteoroloog" : "Adjunct-meteorologen", isF ? (personenNamen || e.meteoroloog || "") : personenNamen));
  }
  if (isF) {
    if ((e.verwachtingen_checks || []).length) rows.push(kv("Verwachtingen uitgebracht", e.verwachtingen_checks.join(", ")));
    if (e.verwachtingen) rows.push(kv("Anders (omschrijf)", e.verwachtingen));
  }
  rows.push(kv("Ingevuld door", e.ingevuld_door || ""));
  return [heading("Basisgegevens"), table(rows)];
}

function administratieWerkSection(e) {
  const per = e.werkzaamheden_per_uur || {};
  const rows = Object.entries(per).filter(([, v]) => v).map(([uur, v]) => kv(uur, v));
  if (!rows.length) return [];
  return [heading("Werkzaamheden per uur", HeadingLevel.HEADING_3), table(rows)];
}

function communicatieSection(e, commLabels) {
  return [heading("Communicatie", HeadingLevel.HEADING_3), table(statusRows(commLabels, e))];
}

function instrumentenSection(e, instLabels) {
  return [heading("Instrumenten", HeadingLevel.HEADING_3), table(statusRows(instLabels, e))];
}

function werkzaamhedenSection(e) {
  if (e.type !== "observer") return [];
  const blocks = [heading("Werkzaamheden per persoon", HeadingLevel.HEADING_3)];
  (e.personen || []).forEach((p, idx) => {
    blocks.push(new Paragraph({ text: p.naam || `Persoon ${idx + 1}`, heading: HeadingLevel.HEADING_4 }));
    const rows = [
      kv("Werktijd", `${p.werktijd_van || "?"} - ${p.werktijd_tot || "?"}`),
      kv("Synop", (p.synop_gedaan || []).join(", ") || "-"),
      kv("Metar", (p.metar_gedaan || []).join(", ") || "-"),
      kv("Klima", (p.klima_gedaan || []).join(", ") || "-"),
      kv("TAF", (p.taf_gedaan || []).join(", ") || "-"),
      kv("Digitaal SPECI", p.digitaal_speci_gedaan ? (p.digitaal_speci_welke || "Ja") : "-"),
      kv("RR naar Klima", p.rr_gedaan ? "Verzonden" : "-"),
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
    ["byz_airlines", "Airlines"], ["byz_operations", "Operations"], ["byz_atc", "ATC"], ["byz_toren", "Toren"],
  ];
  const rows = fields.filter(([k]) => has(k) && e[k]).map(([k, l]) => kv(l, e[k]));
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
    blocks.push(new Paragraph({ text: e.byz_algemeen }));
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
  if (sec("basis")) blocks.push(...basisgegevensSection(e));
  if (Object.keys(commLabels).length) blocks.push(...communicatieSection(e, commLabels));
  if (Object.keys(instLabels).length) blocks.push(...instrumentenSection(e, instLabels));
  if (sec("werkzaamheden") && e.type === "observer") blocks.push(...werkzaamhedenSection(e));
  if (sec("werkzaamheden") && isAdmin) blocks.push(...administratieWerkSection(e));
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
