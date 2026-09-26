import { GOOGLE_SHEET_SCHEMAS, getGoogleSheetsTable } from "../lib/googleSheets.ts";

const verificationDate = "2099-12-31";
const counts: Record<string, number> = {};

for (const schema of GOOGLE_SHEET_SCHEMAS) {
  const rows = await getGoogleSheetsTable(schema.title).select().all();
  counts[schema.title] = rows.length;
}

const progress = getGoogleSheetsTable("Daily Progress");
const temporaryRows = await progress
  .select({ filterByFormula: `{Date} = '${verificationDate}'` })
  .all();

if (temporaryRows.length) {
  await progress.destroy(temporaryRows.map((row) => row.id));
  counts["Daily Progress"] -= temporaryRows.length;
}

const settings = await getGoogleSheetsTable("Settings").select({ maxRecords: 1 }).all();
if (!settings.length) throw new Error("The default Settings row is missing.");

console.log(JSON.stringify({
  verified: true,
  tabs: GOOGLE_SHEET_SCHEMAS.length,
  counts,
  temporaryRowsRemoved: temporaryRows.length,
}, null, 2));
