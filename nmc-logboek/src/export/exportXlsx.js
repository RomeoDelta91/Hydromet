import * as XLSX from "xlsx";

const COLUMNS = [
  "datum", "shift", "type", "naam", "werktijd_van", "werktijd_tot",
  "synop_totaal", "metar_totaal", "taf_totaal", "storingen",
  "notam_verzonden", "notam_shifts", "byz_algemeen",
];

function storingenVoor(e) {
  const isF = e.type === "forecaster";
  return [
    e.com_telefoon !== "OK" && `Telefoon: ${e.com_telefoon}`,
    e.com_internet !== "OK" && `Internet: ${e.com_internet}`,
    e.com_amhs !== "OK" && `AMHS: ${e.com_amhs}`,
    e.com_awos !== "OK" && `AWOS: ${e.com_awos}`,
    !isF && e.com_werkmobiel !== "OK" && `Werkmobiel: ${e.com_werkmobiel}`,
    !isF && e.com_charger !== "OK" && `Charger: ${e.com_charger}`,
    e.inst_aws !== "OK" && `AWS: ${e.inst_aws}`,
    e.inst_awos !== "OK" && `AWOS inst: ${e.inst_awos}`,
    e.inst_radar !== "OK" && `RADAR: ${e.inst_radar}`,
    isF && e.inst_pc_lhb !== "OK" && `PC LHB: ${e.inst_pc_lhb}`,
    !isF && e.inst_conventioneel !== "OK" && `Conventioneel: ${e.inst_conventioneel}`,
  ].filter(Boolean).join("; ");
}

function rowsForEntry(e) {
  const storingen = storingenVoor(e);
  if (e.type === "forecaster") {
    return [{
      datum: e.datum,
      shift: e.shift,
      type: e.type,
      naam: (e.personen || []).map(p => p.naam).filter(Boolean).join(", ") || e.meteoroloog || "",
      werktijd_van: "",
      werktijd_tot: "",
      synop_totaal: "",
      metar_totaal: "",
      taf_totaal: "",
      storingen,
      notam_verzonden: e.notam_verzonden ? "Ja" : "Nee",
      notam_shifts: (e.notam_shifts || []).join(", "),
      byz_algemeen: e.byz_algemeen || "",
    }];
  }
  const personen = e.personen?.length ? e.personen : [{}];
  return personen.map(p => ({
    datum: e.datum,
    shift: e.shift,
    type: e.type,
    naam: p.naam || "",
    werktijd_van: p.werktijd_van || "",
    werktijd_tot: p.werktijd_tot || "",
    synop_totaal: p.synop_gedaan?.length || 0,
    metar_totaal: p.metar_gedaan?.length || 0,
    taf_totaal: p.taf_gedaan?.length || 0,
    storingen,
    notam_verzonden: "",
    notam_shifts: "",
    byz_algemeen: e.byz_algemeen || "",
  }));
}

export function exportXlsx(entries, periodeNaam) {
  const rows = entries.flatMap(rowsForEntry);
  const ws = XLSX.utils.json_to_sheet(rows, { header: COLUMNS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Logboek");
  XLSX.writeFile(wb, `NMC_Logboek_${periodeNaam}.xlsx`);
}
