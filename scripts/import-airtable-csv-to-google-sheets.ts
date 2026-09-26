import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  GOOGLE_SHEET_SCHEMAS,
  GoogleSheetsTable,
  ensureGoogleSheetsSchema,
  type SheetSchema,
} from "../lib/googleSheets.ts";

const FILE_TO_TAB: Record<string, string> = {
  "SplitMic Outreach-Grid view.csv": "SplitMic Email",
  "LinkedIn Outreach-Grid view.csv": "SplitMic LinkedIn",
  "Bookworm Outreach-Grid view.csv": "Bookworm Email",
  "Bookworm TikTok Creators-Grid view.csv": "Bookworm TikTok",
  "Daily Progress-Grid view.csv": "Daily Progress",
  "Reply Notification Log-Grid view.csv": "Replies",
  "Austin Music Hubs-Grid view.csv": "Austin Hubs",
  "Execution Settings-Grid view.csv": "Settings",
};

type CsvFile = {
  fileName: string;
  tab: string;
  headers: string[];
  rows: Record<string, string>[];
};

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) throw new Error(`Missing required argument: ${name}`);
  return value;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index++;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  if (quoted) throw new Error("CSV ended inside a quoted value.");
  if (value || row.length) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim();
}

async function loadCsv(sourceDir: string, fileName: string, tab: string): Promise<CsvFile> {
  const text = await readFile(resolve(sourceDir, fileName), "utf8");
  const parsed = parseCsv(text);
  if (!parsed.length) throw new Error(`${fileName} is empty.`);
  const headers = parsed[0].map(normalizeHeader);
  if (headers.some((header) => !header)) throw new Error(`${fileName} contains a blank column header.`);
  if (new Set(headers).size !== headers.length) throw new Error(`${fileName} contains duplicate column headers.`);

  const rows = parsed.slice(1)
    .filter((values) => values.some((item) => item !== ""))
    .map((values, rowIndex) => {
      if (values.length > headers.length) throw new Error(`${fileName} row ${rowIndex + 2} has more values than headers.`);
      return Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]));
    });
  return { fileName, tab, headers, rows };
}

function importSchema(tab: string, csvHeaders: string[]): SheetSchema {
  const existing = GOOGLE_SHEET_SCHEMAS.find((schema) => schema.title === tab);
  if (!existing) throw new Error(`No Google Sheets schema exists for ${tab}.`);
  const headers = [...existing.headers];
  for (const header of csvHeaders) if (!headers.includes(header)) headers.push(header);
  return { ...existing, headers };
}

function normalizeValue(value: string, header: string, schema: SheetSchema): unknown {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (schema.booleanColumns?.includes(header)) {
    return ["checked", "true", "1", "yes"].includes(trimmed.toLowerCase());
  }
  if (schema.numericColumns?.includes(header)) {
    const number = Number(trimmed.replace(/,/g, "").replace(/%$/, ""));
    return Number.isFinite(number) ? number : value;
  }
  return value;
}

function recordId(tab: string, rowIndex: number, row: Record<string, string>): string {
  const hash = createHash("sha256")
    .update(`${tab}\u0000${rowIndex}\u0000${JSON.stringify(row)}`)
    .digest("hex")
    .slice(0, 24);
  return `csv_${hash}`;
}

function comparable(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

async function main() {
  const sourceDir = resolve(argument("--source-dir"));
  const files: CsvFile[] = [];
  for (const [fileName, tab] of Object.entries(FILE_TO_TAB)) {
    files.push(await loadCsv(sourceDir, fileName, tab));
  }

  const backupDir = resolve(".local-backups");
  await mkdir(backupDir, { recursive: true });
  const before: Record<string, unknown> = {};
  for (const file of files) {
    const schema = importSchema(file.tab, file.headers);
    before[file.tab] = await new GoogleSheetsTable(schema).select().all();
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = resolve(backupDir, `google-sheets-before-csv-import-${timestamp}.json`);
  await writeFile(backupPath, JSON.stringify({ exportedAt: new Date().toISOString(), tabs: before }, null, 2), "utf8");

  const results: Array<Record<string, unknown>> = [];
  for (const file of files) {
    const schema = importSchema(file.tab, file.headers);
    await ensureGoogleSheetsSchema(schema, Math.max(2000, file.rows.length + 100));
    const table = new GoogleSheetsTable(schema);
    const existing = await table.select().all();
    if (existing.length) await table.destroy(existing.map((record) => record.id));

    const records = file.rows.map((row, rowIndex) => ({
      id: recordId(file.tab, rowIndex, row),
      fields: Object.fromEntries(
        file.headers.flatMap((header) => {
          const value = normalizeValue(row[header], header, schema);
          return value === undefined ? [] : [[header, value]];
        })
      ),
    }));
    for (let index = 0; index < records.length; index += 200) {
      await table.create(records.slice(index, index + 200));
    }

    const verified = await table.select().all();
    if (verified.length !== records.length) {
      throw new Error(`Verification failed for ${file.tab}: expected ${records.length}, found ${verified.length}.`);
    }
    const verifiedById = new Map(verified.map((record) => [record.id, record]));
    for (const record of records) {
      const target = verifiedById.get(record.id);
      if (!target) throw new Error(`Verification failed for ${file.tab}: missing ${record.id}.`);
      for (const [field, value] of Object.entries(record.fields)) {
        if (comparable(target.fields[field]) !== comparable(value)) {
          throw new Error(`Verification failed for ${file.tab}: ${record.id} field ${field} did not match.`);
        }
      }
    }
    results.push({ source: basename(file.fileName), destination: file.tab, imported: records.length, verified: verified.length });
  }

  console.log(JSON.stringify({ imported: true, backupPath, results }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
