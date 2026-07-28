import fs from "fs";
let cap;
globalThis.URL.createObjectURL = b => { cap = b; return "blob:x"; };
globalThis.URL.revokeObjectURL = () => {};
globalThis.document = { createElement: () => ({ click(){}, style:{} }), body:{appendChild(){},removeChild(){}} };
const { exportDocx } = await import("./src/export/exportDocx.js");
const { ALL_EXPORT_IDS } = await import("./src/constants.js");
console.log("com_anders in export-tree:", ALL_EXPORT_IDS.includes("com_anders"));
console.log("inst_anders in export-tree:", ALL_EXPORT_IDS.includes("inst_anders"));
const e = {
  type:"observer", datum:"2026-07-01", shift:"Nachtdienst (22:00–08:00 LT)", ingevuld_door:"Jan",
  personen:[{naam:"R. Bidesie"}],
  com_telefoon:"OK", com_amhs:"Storing", com_anders:"Marifoon kraakt",
  inst_aws:"OK", inst_anders:"Regenmeter scheef",
  chef_edits:["com_anders"], chef_edit_door:"Bidesie R.", chef_edit_datum:"2026-07-28",
};
await exportDocx([e], ALL_EXPORT_IDS, "T");
fs.writeFileSync("/tmp/o.docx", Buffer.from(await cap.arrayBuffer()));
