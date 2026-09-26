import { initializeGoogleSheetsDatabase } from "../lib/googleSheets.ts";

const tabs = await initializeGoogleSheetsDatabase();
console.log(JSON.stringify({ initialized: true, tabs }, null, 2));
