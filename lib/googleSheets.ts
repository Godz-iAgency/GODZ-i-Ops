import { randomUUID, sign } from "node:crypto";

type Scalar = string | number | boolean;
type Fields = Record<string, unknown>;

type SheetRecord = {
  id: string;
  fields: Fields;
  rowNumber?: number;
};

type SortRule = { field: string; direction?: "asc" | "desc" };
type SelectOptions = {
  filterByFormula?: string;
  sort?: SortRule[];
  maxRecords?: number;
};

export type SheetSchema = {
  title: string;
  headers: string[];
  numericColumns?: string[];
  booleanColumns?: string[];
  dropdowns?: Record<string, string[]>;
};

const SPLITMIC_STAGES = [
  "Research Needed",
  "Ready for Outreach",
  "Contacted",
  "Replied",
  "Engaged",
  "Meeting",
  "Follow-up",
  "Partner",
  "Not Interested",
];

export const GOOGLE_SHEET_SCHEMAS: SheetSchema[] = [
  {
    title: "SplitMic Email",
    headers: [
      "Record ID", "Name / Target", "Organization", "Role", "Category", "Priority", "Campaign Day",
      "Daily Slot", "Phone", "Why They Matter to SplitMic", "Source / Research Starting Point", "Website",
      "City / Area", "Primary Source URL", "Secondary Source URL", "Verification Status", "Date Verified",
      "Email", "Email Status", "Email Last Contacted", "Email Follow-up Date", "LinkedIn Name", "LinkedIn URL",
      "LinkedIn Status", "LinkedIn Last Contacted", "Relationship Status", "Response Summary",
      "Feedback / Pain Point", "Next Action", "Next Action Date", "Notes", "Do Not Contact",
      "Suppression Reason", "Suppressed At",
    ],
    numericColumns: ["Priority", "Campaign Day", "Daily Slot"],
    booleanColumns: ["Do Not Contact"],
    dropdowns: {
      "Verification Status": ["Research Needed", "Partially Verified", "Verified"],
      "Email Status": ["Not Contacted", "Sent", "Replied", "No Response", "Bounced"],
      "LinkedIn Status": ["Not Contacted", "Contacted", "Connected", "Replied", "Engaged", "Follow-up", "Meeting"],
      "Relationship Status": SPLITMIC_STAGES,
    },
  },
  {
    title: "SplitMic LinkedIn",
    headers: ["Record ID", "Name", "Organization", "Role", "Category", "Location", "Email", "LinkedIn URL", "Date Contacted", "Status", "Response", "Notes", "Next Action", "Next Action Date"],
    dropdowns: { Status: ["New", "Contacted", "Connected", "Replied", "Engaged", "Follow-up", "Meeting"] },
  },
  {
    title: "Bookworm Email",
    headers: ["Record ID", "Name", "Category", "Priority", "Opportunity", "Angle", "Address", "Phone", "Email", "Channel Handle", "Relationship Status", "Next Action", "Next Action Date", "Profile URL", "Last Contact", "Notes"],
    dropdowns: {
      Priority: ["A (Top 10)", "A", "B", "C"],
      "Relationship Status": ["New", "Contacted", "Replied", "Joined Whop", "Not Interested"],
    },
  },
  {
    title: "Bookworm TikTok",
    headers: ["Record ID", "Name", "Display Name", "TikTok User ID", "TikTok Handle", "TikTok URL", "Followers", "Following", "Total Likes", "Average Views", "Average Engagement Rate %", "Follower To Avg Views Ratio", "Days Since Last Post", "Last Post Date", "Bio", "Discovery Source", "Discovery Category", "List", "Excluded", "Enriched At", "Niche", "Email", "Date Contacted", "Status", "Response", "Notes", "Next Action", "Next Action Date"],
    numericColumns: ["Followers", "Following", "Total Likes", "Average Views", "Average Engagement Rate %", "Follower To Avg Views Ratio", "Days Since Last Post"],
    booleanColumns: ["Excluded"],
    dropdowns: {
      List: ["Primary", "Reserve"],
      Status: ["New", "DM Sent", "Replied", "In Talks", "Partnered", "Not Interested"],
    },
  },
  {
    title: "Daily Progress",
    headers: ["Record ID", "Date", "Day Number", "Weekday", "Emails Sent", "LinkedIn Sent", "Bookworm Emails Sent", "Bookworm TikTok Sent", "Build Project", "Build Objective", "Build Status", "Build Completed", "Build Notes", "Delivery Objective", "Delivery Status", "Delivery Recipient", "Delivery Link", "Delivery Notes", "Deliver Completed", "Feedback Received", "Needs Follow-up", "Deliver Next Action", "Camera Practice", "Content Posted", "Content Platform", "Content Title", "Content URL", "Book", "Pages or Chapter", "Learned", "Apply", "Deep Work Completed", "Deep Work Notes", "Day Note", "Bookworm Contacted", "Bookworm Content Posted", "Bookworm Content Platform", "Bookworm Featured Person", "Bookworm Content Title", "Bookworm Content URL", "Bookworm Welcomed Members", "Bookworm Started Discussion", "Bookworm Community Notes"],
    numericColumns: ["Day Number", "Emails Sent", "LinkedIn Sent", "Bookworm Emails Sent", "Bookworm TikTok Sent", "Bookworm Contacted"],
    booleanColumns: ["Build Completed", "Deliver Completed", "Camera Practice", "Content Posted", "Deep Work Completed", "Bookworm Content Posted", "Bookworm Welcomed Members", "Bookworm Started Discussion"],
    dropdowns: {
      "Build Status": ["Not Started", "In Progress", "Completed", "Blocked"],
      "Delivery Status": ["Not Started", "In Progress", "Delivered", "Blocked"],
    },
  },
  {
    title: "Replies",
    headers: ["Record ID", "Message ID", "Source", "From Email", "From Name", "Contact Name", "Organization", "Contact Record ID", "Subject", "Body", "Thread ID", "RFC Message ID", "Received At", "Notified At", "Status", "Intent", "Suggested Reply", "My Reply", "Replied At"],
    dropdowns: { Status: ["New", "Reviewed", "Replied", "Archived"] },
  },
  {
    title: "Austin Hubs",
    headers: ["Record ID", "Name", "Category", "Who They Reach", "Phone", "Email", "Website", "Why Call", "Status", "Last Contacted", "Notes"],
    dropdowns: { Status: ["Not Contacted", "Called", "Connected", "Follow Up", "Partnership", "Not Relevant"] },
  },
  {
    title: "Settings",
    headers: ["Record ID", "Name", "SplitMic LinkedIn Target", "SplitMic Email Target", "Bookworm TikTok Target", "Bookworm Email Target"],
    numericColumns: ["SplitMic LinkedIn Target", "SplitMic Email Target", "Bookworm TikTok Target", "Bookworm Email Target"],
  },
];

function env(name: string): string {
  const value = process.env[name]?.trim().replace(/^"|"$/g, "");
  if (!value) throw new Error(`Missing Google Sheets environment variable: ${name}`);
  return value;
}

function privateKey(): string {
  let key = env("GOOGLE_SHEETS_PRIVATE_KEY").replace(/\\n/g, "\n");
  if (!key.includes("BEGIN PRIVATE KEY")) {
    const body = key.replace(/\s/g, "");
    const lines = body.match(/.{1,64}/g) || [];
    key = `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----\n`;
  }
  return key;
}

function base64Url(value: object | string): string {
  return Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
}

let accessTokenCache: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (accessTokenCache && Date.now() < accessTokenCache.expiresAt - 60_000) return accessTokenCache.token;
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64Url({ alg: "RS256", typ: "JWT" })}.${base64Url({
    iss: env("GOOGLE_SHEETS_CLIENT_EMAIL"),
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = sign("RSA-SHA256", Buffer.from(unsigned), privateKey()).toString("base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
    cache: "no-store",
  });
  const payload = (await response.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !payload.access_token) throw new Error(`Google authentication failed: ${payload.error || response.status}`);
  accessTokenCache = { token: payload.access_token, expiresAt: Date.now() + (payload.expires_in || 3600) * 1000 };
  return payload.access_token;
}

async function sheetsFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${env("GOOGLE_SHEETS_SPREADSHEET_ID")}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`Google Sheets API ${response.status}: ${payload.error?.message || "Request failed"}`);
  return payload as T;
}

const quote = (title: string) => `'${title.replace(/'/g, "''")}'`;

function serialize(value: unknown): Scalar | "" {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return JSON.stringify(value);
}

function deserialize(value: unknown, header: string, schema: SheetSchema): unknown {
  if (value == null || value === "") return undefined;
  if (schema.numericColumns?.includes(header)) {
    const number = Number(value);
    return Number.isFinite(number) ? number : value;
  }
  if (schema.booleanColumns?.includes(header)) {
    return value === true || String(value).toLowerCase() === "true";
  }
  return value;
}

function matchesFormula(fields: Fields, formula?: string): boolean {
  if (!formula) return true;
  const lowerEmail = formula.match(/LOWER\(\{Email\}\) = '([^']*)'/i);
  if (lowerEmail) return String(fields.Email || "").toLowerCase() === lowerEmail[1].toLowerCase();

  const dateFormat = formula.match(/DATETIME_FORMAT\(\{([^}]+)\}, 'YYYY-MM-DD'\) = '([^']+)'/i);
  if (dateFormat) return String(fields[dateFormat[1]] || "").slice(0, 10) === dateFormat[2];

  const simpleEqual = formula.match(/^\{([^}]+)\} = '([^']*)'$/);
  if (simpleEqual) return String(fields[simpleEqual[1]] || "") === simpleEqual[2];

  if (formula.includes("NOT({Email} = '')") && formula.includes("Email Status")) {
    const status = String(fields["Email Status"] || "Not Contacted");
    return !!String(fields.Email || "").trim() && !fields["Do Not Contact"] && status === "Not Contacted";
  }
  if (formula.includes("{Email} = ''") && formula.includes("Relationship Status")) {
    const stage = String(fields["Relationship Status"] || "");
    return !String(fields.Email || "").trim() && (!stage || stage === "Research Needed");
  }
  return true;
}

function compare(left: unknown, right: unknown): number {
  if (left == null || left === "") return 1;
  if (right == null || right === "") return -1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
}

export class GoogleSheetsTable {
  private readonly schema: SheetSchema;

  constructor(schema: SheetSchema) {
    this.schema = schema;
  }

  private async rows(): Promise<SheetRecord[]> {
    const result = await sheetsFetch<{ values?: unknown[][] }>(`/values/${encodeURIComponent(`${quote(this.schema.title)}!A:ZZ`)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`);
    const values = result.values || [];
    const headers = (values[0] || []).map(String);
    return values.slice(1).flatMap((row, index) => {
      const id = String(row[0] || "").trim();
      if (!id) return [];
      const fields: Fields = {};
      for (let column = 1; column < headers.length; column++) {
        const header = headers[column];
        if (!header) continue;
        const value = deserialize(row[column], header, this.schema);
        if (value !== undefined) fields[header] = value;
      }
      return [{ id, fields, rowNumber: index + 2 }];
    });
  }

  select(options: SelectOptions = {}) {
    return {
      all: async () => {
        let records = (await this.rows()).filter((record) => matchesFormula(record.fields, options.filterByFormula));
        if (options.sort?.length) {
          records = [...records].sort((a, b) => {
            for (const rule of options.sort || []) {
              const result = compare(a.fields[rule.field], b.fields[rule.field]);
              if (result) return rule.direction === "desc" ? -result : result;
            }
            return 0;
          });
        }
        if (options.maxRecords) records = records.slice(0, options.maxRecords);
        return records;
      },
    };
  }

  async find(id: string): Promise<SheetRecord> {
    const record = (await this.rows()).find((item) => item.id === id);
    if (!record) throw new Error(`Record ${id} was not found in ${this.schema.title}`);
    return record;
  }

  async create(items: Array<{ fields: Fields }>): Promise<SheetRecord[]> {
    const created = items.map((item) => ({ id: `gs_${randomUUID()}`, fields: item.fields }));
    await sheetsFetch(`/values/${encodeURIComponent(`${quote(this.schema.title)}!A:ZZ`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: "POST",
      body: JSON.stringify({
        majorDimension: "ROWS",
        values: created.map((record) => this.schema.headers.map((header) => header === "Record ID" ? record.id : serialize(record.fields[header]))),
      }),
    });
    return created;
  }

  async update(items: Array<{ id: string; fields: Fields }>): Promise<SheetRecord[]> {
    const existing = await this.rows();
    const updates = items.map((item) => {
      const current = existing.find((record) => record.id === item.id);
      if (!current?.rowNumber) throw new Error(`Record ${item.id} was not found in ${this.schema.title}`);
      const merged = { ...current.fields, ...item.fields };
      return {
        record: { id: item.id, fields: merged },
        range: `${quote(this.schema.title)}!A${current.rowNumber}:${columnName(this.schema.headers.length)}${current.rowNumber}`,
        values: [this.schema.headers.map((header) => header === "Record ID" ? item.id : serialize(merged[header]))],
      };
    });
    await sheetsFetch(`/values:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ valueInputOption: "RAW", data: updates.map(({ range, values }) => ({ range, values })) }),
    });
    return updates.map((item) => item.record);
  }

  async destroy(ids: string[]): Promise<string[]> {
    const existing = await this.rows();
    const ranges = ids.flatMap((id) => {
      const record = existing.find((item) => item.id === id);
      return record?.rowNumber ? [`${quote(this.schema.title)}!A${record.rowNumber}:${columnName(this.schema.headers.length)}${record.rowNumber}`] : [];
    });
    if (ranges.length) await sheetsFetch(`/values:batchClear`, { method: "POST", body: JSON.stringify({ ranges }) });
    return ids;
  }
}

function columnName(count: number): string {
  let value = count;
  let name = "";
  while (value > 0) {
    value--;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

export function getGoogleSheetsTable(title: string): GoogleSheetsTable {
  const schema = GOOGLE_SHEET_SCHEMAS.find((item) => item.title === title);
  if (!schema) throw new Error(`Unknown Google Sheets table: ${title}`);
  return new GoogleSheetsTable(schema);
}

type SheetMetadata = {
  sheets?: Array<{
    properties: { sheetId: number; title: string };
    protectedRanges?: Array<{ description?: string }>;
  }>;
};

export async function initializeGoogleSheetsDatabase(): Promise<{ title: string; sheetId: number }[]> {
  let metadata = await sheetsFetch<SheetMetadata>("?fields=sheets(properties,protectedRanges.description)");
  const existing = new Map((metadata.sheets || []).map((sheet) => [sheet.properties.title, sheet.properties.sheetId]));
  const requests: object[] = [];

  if (!existing.has(GOOGLE_SHEET_SCHEMAS[0].title)) {
    const defaultSheet = metadata.sheets?.find((sheet) => sheet.properties.title === "Sheet1");
    if (defaultSheet && existing.size === 1) {
      requests.push({ updateSheetProperties: { properties: { sheetId: defaultSheet.properties.sheetId, title: GOOGLE_SHEET_SCHEMAS[0].title }, fields: "title" } });
    } else {
      requests.push({ addSheet: { properties: { title: GOOGLE_SHEET_SCHEMAS[0].title, gridProperties: { rowCount: 2000, columnCount: GOOGLE_SHEET_SCHEMAS[0].headers.length } } } });
    }
  }
  for (const schema of GOOGLE_SHEET_SCHEMAS.slice(1)) {
    if (!existing.has(schema.title)) {
      requests.push({ addSheet: { properties: { title: schema.title, gridProperties: { rowCount: 2000, columnCount: schema.headers.length } } } });
    }
  }
  if (requests.length) await sheetsFetch(":batchUpdate", { method: "POST", body: JSON.stringify({ requests }) });

  metadata = await sheetsFetch<SheetMetadata>("?fields=sheets(properties,protectedRanges.description)");
  const ids = new Map((metadata.sheets || []).map((sheet) => [sheet.properties.title, sheet.properties.sheetId]));
  const protectedIds = new Set(
    (metadata.sheets || [])
      .filter((sheet) => sheet.protectedRanges?.some((range) => range.description === "Stable record IDs used by GODZ-i Ops"))
      .map((sheet) => sheet.properties.sheetId)
  );
  await sheetsFetch(`/values:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      valueInputOption: "RAW",
      data: GOOGLE_SHEET_SCHEMAS.map((schema) => ({ range: `${quote(schema.title)}!A1:${columnName(schema.headers.length)}1`, values: [schema.headers] })),
    }),
  });

  const formatRequests: object[] = [];
  for (const schema of GOOGLE_SHEET_SCHEMAS) {
    const sheetId = ids.get(schema.title);
    if (sheetId == null) throw new Error(`Google Sheets tab was not created: ${schema.title}`);
    formatRequests.push(
      { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
      { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: schema.headers.length }, cell: { userEnteredFormat: { backgroundColor: { red: 0.93, green: 0.93, blue: 0.93 }, textFormat: { bold: true, foregroundColor: { red: 0.1, green: 0.1, blue: 0.1 } }, verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" } }, fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)" } },
      { updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 42 }, fields: "pixelSize" } },
      { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, endRowIndex: 2000, startColumnIndex: 0, endColumnIndex: schema.headers.length } } } },
    );
    if (!protectedIds.has(sheetId)) {
      formatRequests.push({ addProtectedRange: { protectedRange: { range: { sheetId, startRowIndex: 1, endRowIndex: 2000, startColumnIndex: 0, endColumnIndex: 1 }, description: "Stable record IDs used by GODZ-i Ops", warningOnly: true } } });
    }
    schema.headers.forEach((header, index) => {
      const width = header === "Record ID" ? 235 : /Notes|Bio|Body|Summary|Why|Source|Objective|Feedback|Learned|Apply/i.test(header) ? 260 : /URL|Link|Email/i.test(header) ? 220 : 150;
      formatRequests.push({ updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: index, endIndex: index + 1 }, properties: { pixelSize: width }, fields: "pixelSize" } });
      const options = schema.dropdowns?.[header];
      if (options) {
        formatRequests.push({ setDataValidation: { range: { sheetId, startRowIndex: 1, endRowIndex: 2000, startColumnIndex: index, endColumnIndex: index + 1 }, rule: { condition: { type: "ONE_OF_LIST", values: options.map((value) => ({ userEnteredValue: value })) }, strict: true, showCustomUi: true } } });
      }
      if (schema.booleanColumns?.includes(header)) {
        formatRequests.push({ setDataValidation: { range: { sheetId, startRowIndex: 1, endRowIndex: 2000, startColumnIndex: index, endColumnIndex: index + 1 }, rule: { condition: { type: "BOOLEAN" }, strict: true, showCustomUi: true } } });
      }
    });
  }
  await sheetsFetch(":batchUpdate", { method: "POST", body: JSON.stringify({ requests: formatRequests }) });

  const settings = new GoogleSheetsTable(GOOGLE_SHEET_SCHEMAS.find((schema) => schema.title === "Settings")!);
  if (!(await settings.select({ maxRecords: 1 }).all()).length) {
    await settings.create([{ fields: { Name: "Default", "SplitMic LinkedIn Target": 10, "SplitMic Email Target": 5, "Bookworm TikTok Target": 10, "Bookworm Email Target": 5 } }]);
  }

  return GOOGLE_SHEET_SCHEMAS.map((schema) => ({ title: schema.title, sheetId: ids.get(schema.title)! }));
}
