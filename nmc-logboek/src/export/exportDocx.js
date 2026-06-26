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
  const rows = [
    kv("Datum", e.datum),
    kv("Shift", e.shift),
    kv(isF ? "Meteoroloog" : "Adjunct-meteorologen", isF ? e.meteoroloog : (e.personen || []).map(p => p.naam).filter(Boolean).join(", ")),
  ];
  if (isF) {
    rows.push(kv("Werktijd", `${e.werktijd_van || "?"} - ${e.werktijd_tot || "?"}`));
    if (e.verwachtingen) rows.push(kv("Verwachtingen uitgebracht", e.verwachtingen));
  }
  rows.push(kv("Ingevuld door", e.ingevuld_door || ""));
  return [heading("Basisgegevens"), table(rows)];
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

function bijzonderhedenSection(e) {
  const isF = e.type === "forecaster";
  const fields = isF
    ? [["Dienstauto", e.byz_dienstauto], ["Dienstbus", e.byz_dienstbus], ["Hydrofoor", e.byz_hydrofoor],
       ["Stroomonderbrekingen", e.byz_stroom], ["Levering SWM water", e.byz_swm],
       ["Airlines", e.byz_airlines], ["Operations", e.byz_operations], ["ATC", e.byz_atc], ["Toren", e.byz_toren]]
    : [];
  const rows = fields.filter(([, v]) => v).map(([l, v]) => kv(l, v));
  const blocks = [];
  if (rows.length) blocks.push(heading("Bijzonderheden", HeadingLevel.HEADING_3), table(rows));
  if (e.byz_algemeen) {
    blocks.push(new Paragraph({ text: "Algemeen", heading: HeadingLevel.HEADING_4 }));
    blocks.push(new Paragraph({ text: e.byz_algemeen }));
  }
  return blocks;
}

function entrySections(e, sectionIds) {
  const isF = e.type === "forecaster";
  const commLabels = isF
    ? { com_telefoon: "Telefoon", com_internet: "Internet", com_amhs: "AMHS", com_awos: "AWOS" }
    : { com_telefoon: "Telefoon", com_internet: "Internet", com_amhs: "AMHS", com_awos: "AWOS", com_werkmobiel: "Werkmobiel", com_charger: "Charger" };
  const instLabels = isF
    ? { inst_aws: "AWS", inst_awos: "AWOS", inst_pc_lhb: "PC LHB", inst_radar: "RADAR", inst_werkmobiel: "Werkmobiel", inst_charger: "Charger" }
    : { inst_conventioneel: "Conventioneel", inst_aws: "AWS", inst_awos: "AWOS", inst_radar: "RADAR" };

  const sec = id => sectionIds.includes(id);
  const blocks = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: `${e.datum} — ${e.shift} — ${isF ? "Forecaster" : "Observer"}` })],
    }),
  ];
  if (sec("basis")) blocks.push(...basisgegevensSection(e));
  if (sec("communicatie")) blocks.push(...communicatieSection(e, commLabels));
  if (sec("instrumenten")) blocks.push(...instrumentenSection(e, instLabels));
  if (sec("werkzaamheden")) blocks.push(...werkzaamhedenSection(e));
  if (sec("webupload")) blocks.push(...webUploadSection(e));
  if (sec("notams")) blocks.push(...notamSection(e));
  if (sec("logistiek") || sec("operationeel") || sec("algemeen")) blocks.push(...bijzonderhedenSection(e));
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
