import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  GOOGLE_SHEET_SCHEMAS,
  GoogleSheetsTable,
  ensureGoogleSheetsSchema,
  type SheetSchema,
} from "../lib/googleSheets.ts";

type AirtableField = { id: string; name: string; type: string };
type AirtableTable = { id: string; name: string; fields: AirtableField[] };
type AirtableRecord = { id: string; fields: Record<string, unknown>; createdTime?: string };

const ACTIVE_TABLES: Record<string, string> = {
  tblryUfFc1oBsKtDa: "SplitMic Email",
  tbljLKppcc89M5Iz1: "SplitMic LinkedIn",
  tbl7Otn4SbdJpF97E: "Bookworm Email",
  tblKOYrjzZS8xdl60: "Bookworm TikTok",
  tbls02Ih2kaa9fhQ6: "Daily Progress",
  tblegcIUuI3ow1Cgy: "Replies",
  tblolqShJlWbCHoX4: "Austin Hubs",
};

function required(name: string): string {
  const value = process.env[name]?.trim().replace(/^"|"$/g, "");
  if (!value) throw new Error(`Missing migration-only environment variable: ${name}`);
  return value;
}

async function airtableFetch<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.airtable.com/v0${path}`, {
    headers: { Authorization: `Bearer ${required("AIRTABLE_PAT")}` },
    cache: "no-store",
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = payload.error?.message || payload.error?.type || `HTTP ${response.status}`;
    if (response.status === 429) {
      throw new Error("Airtable is still returning 429. No migration writes were made; retry after its API allowance resets or use exported files.");
    }
    throw new Error(`Airtable migration read failed: ${message}`);
  }
  return payload as T;
}

async function allRecords(baseId: string, tableId: string): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const query = new URLSearchParams({ pageSize: "100" });
    if (offset) query.set("offset", offset);
    const page = await airtableFetch<{ records?: AirtableRecord[]; offset?: string }>(
      `/${encodeURIComponent(baseId)}/${encodeURIComponent(tableId)}?${query}`
    );
    records.push(...(page.records || []));
    offset = page.offset;
  } while (offset);
  return records;
}

function archiveTitle(table: AirtableTable): string {
  const clean = table.name.replace(/[\\/?*:[\]]/g, " ").replace(/\s+/g, " ").trim();
  const suffix = table.id.slice(-6);
  return `Archive - ${clean}`.slice(0, 91) + ` ${suffix}`;
}

function destinationTitle(table: AirtableTable): string {
  if (ACTIVE_TABLES[table.id]) return ACTIVE_TABLES[table.id];
  if (table.name.trim().toLowerCase() === "execution settings") return "Settings";
  return archiveTitle(table);
}

function schemaFor(table: AirtableTable): SheetSchema {
  const title = destinationTitle(table);
  const existing = GOOGLE_SHEET_SCHEMAS.find((schema) => schema.title === title);
  const sourceHeaders = table.fields.map((field) => field.name).filter((name) => name !== "Record ID");
  const headers = ["Record ID", ...(existing?.headers || []).filter((header) => header !== "Record ID")];
  for (const header of sourceHeaders) if (!headers.includes(header)) headers.push(header);
  const numeric = table.fields
    .filter((field) => ["number", "currency", "percent", "rating", "duration", "count", "autoNumber"].includes(field.type))
    .map((field) => field.name);
  const boolean = table.fields.filter((field) => field.type === "checkbox").map((field) => field.name);
  return {
    title,
    headers,
    numericColumns: [...new Set([...(existing?.numericColumns || []), ...numeric])],
    booleanColumns: [...new Set([...(existing?.booleanColumns || []), ...boolean])],
    dropdowns: existing?.dropdowns,
  };
}

function comparable(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

async function main() {
  const auditOnly = process.argv.includes("--audit-only");
  const baseId = required("AIRTABLE_BASE_MUSIC");
  const metadata = await airtableFetch<{ tables?: AirtableTable[] }>(`/meta/bases/${encodeURIComponent(baseId)}/tables`);
  const sourceTables = metadata.tables || [];
  if (!sourceTables.length) throw new Error("Airtable returned no tables; migration stopped.");

  const exports: Array<{ table: AirtableTable; records: AirtableRecord[] }> = [];
  for (const table of sourceTables) {
    exports.push({ table, records: await allRecords(baseId, table.id) });
  }

  const backupDir = resolve(".local-backups");
  await mkdir(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = resolve(backupDir, `airtable-full-export-${timestamp}.json`);
  await writeFile(backupPath, JSON.stringify({ baseId, exportedAt: new Date().toISOString(), tables: exports }, null, 2), "utf8");

  const audit = exports.map(({ table, records }) => ({
    sourceTable: table.name,
    sourceTableId: table.id,
    destinationTab: destinationTitle(table),
    records: records.length,
    fields: table.fields.length,
  }));
  console.log(JSON.stringify({ audit, backupPath }, null, 2));
  if (auditOnly) return;

  const results: Array<Record<string, unknown>> = [];
  for (const { table: sourceTable, records } of exports) {
    const schema = schemaFor(sourceTable);
    await ensureGoogleSheetsSchema(schema, records.length + 100);
    const destination = new GoogleSheetsTable(schema);
    let existing = await destination.select().all();

    if (schema.title === "Settings" && records.length && existing.length === 1 && existing[0].id.startsWith("gs_")) {
      await destination.destroy([existing[0].id]);
      existing = [];
    }

    const existingIds = new Set(existing.map((record) => record.id));
    const creates = records.filter((record) => !existingIds.has(record.id)).map((record) => ({ id: record.id, fields: record.fields }));
    const updates = records.filter((record) => existingIds.has(record.id)).map((record) => ({ id: record.id, fields: record.fields }));
    for (let index = 0; index < creates.length; index += 200) await destination.create(creates.slice(index, index + 200));
    for (let index = 0; index < updates.length; index += 200) await destination.update(updates.slice(index, index + 200));

    const verified = await destination.select().all();
    const verifiedById = new Map(verified.map((record) => [record.id, record]));
    const missing = records.filter((record) => !verifiedById.has(record.id)).map((record) => record.id);
    const mismatched = records.flatMap((record) => {
      const target = verifiedById.get(record.id);
      if (!target) return [];
      const fields = Object.entries(record.fields).filter(([field, value]) => comparable(target.fields[field]) !== comparable(value));
      return fields.length ? [{ id: record.id, fields: fields.map(([field]) => field) }] : [];
    });
    if (missing.length || mismatched.length) {
      throw new Error(`Verification failed for ${sourceTable.name}: ${missing.length} missing, ${mismatched.length} mismatched.`);
    }
    results.push({ sourceTable: sourceTable.name, destinationTab: schema.title, source: records.length, created: creates.length, updated: updates.length, verified: records.length });
  }

  console.log(JSON.stringify({ migrated: true, tables: results.length, results, backupPath }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
