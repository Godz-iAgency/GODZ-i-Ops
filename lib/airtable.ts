import Airtable from "airtable";

const PAT = process.env.AIRTABLE_PAT;
const BASE_MUSIC = process.env.AIRTABLE_BASE_MUSIC;
const BASE_APPS = process.env.AIRTABLE_BASE_APPS;

if (!PAT || !BASE_MUSIC || !BASE_APPS) {
  throw new Error("Missing Airtable env vars: AIRTABLE_PAT, AIRTABLE_BASE_MUSIC, AIRTABLE_BASE_APPS");
}

Airtable.configure({ apiKey: PAT });

export type Tier = "godzi" | "splitmic" | "gbombs" | "bookworm" | "hotcake";

export const TIERS: Record<Tier, { label: string; baseId: string; table: string; tableId: string; color: string }> = {
  godzi: { label: "GODZ-i", baseId: BASE_MUSIC, table: "Website", tableId: "tblggdK3pO76ELx0v", color: "#F2C94C" },
  splitmic: { label: "SplitMic", baseId: BASE_MUSIC, table: "SplitMic", tableId: "tblTDMthhQVuKEyzJ", color: "#56CCF2" },
  gbombs: { label: "gBOMBS", baseId: BASE_APPS, table: "g-BOMBS Leads", tableId: "tblGKon7vSpqaPkWm", color: "#EF6C9E" },
  bookworm: { label: "Bookworm", baseId: BASE_APPS, table: "BookWorm Leads", tableId: "tblcLI6qSrZDdzkjt", color: "#C9A66B" },
  hotcake: { label: "HotCake", baseId: BASE_APPS, table: "HotCake Leads", tableId: "tbl60EXsrcQ8zgXGw", color: "#5FBF7A" },
};

export function getTable(tier: Tier) {
  const cfg = TIERS[tier];
  return new Airtable().base(cfg.baseId)(cfg.table);
}

// Fields shared across all 5 tables after schema unification.
export const FIELDS = [
  "Name",
  "Category",
  "Channel",
  "Channel Handle",
  "Email",
  "Phone",
  "Address",
  "Stage",
  "Last Contact",
  "Next Action",
  "Notes",
] as const;

export type LeadFields = {
  Name?: string;
  Category?: string;
  Channel?: string[];
  "Channel Handle"?: string;
  Email?: string;
  Phone?: string;
  Address?: string;
  Stage?: string;
  "Last Contact"?: string;
  "Next Action"?: string;
  Notes?: string;
};

export type Lead = { id: string; fields: LeadFields };

const CONTENT_QUEUE_TABLE_ID = "tbll3yXqFpeCw0j6S";

export function getContentQueueTable() {
  return new Airtable().base(BASE_APPS as string)(CONTENT_QUEUE_TABLE_ID);
}

const NOTIFICATION_LOG_TABLE_ID = "tblj1yr9DEpiXRPqm";

function getNotificationLogTable() {
  return new Airtable().base(BASE_APPS as string)(NOTIFICATION_LOG_TABLE_ID);
}

export async function wasAlreadyNotified(messageId: string): Promise<boolean> {
  const table = getNotificationLogTable();
  const records = await table
    .select({ filterByFormula: `{Message ID} = '${messageId}'`, maxRecords: 1 })
    .all();
  return records.length > 0;
}

export async function markNotified(messageId: string, fromEmail: string): Promise<void> {
  const table = getNotificationLogTable();
  await table.create([
    { fields: { "Message ID": messageId, "From Email": fromEmail, "Notified At": new Date().toISOString() } },
  ]);
}

// Pulls every lead with an Email set, across all 5 tiers, for reply-matching.
export async function getAllLeadsWithEmail(): Promise<Array<{ tier: Tier; id: string; fields: LeadFields }>> {
  const tiers = Object.keys(TIERS) as Tier[];
  const results = await Promise.all(
    tiers.map(async (tier) => {
      const table = getTable(tier);
      const records = await table
        .select({ pageSize: 100, filterByFormula: "NOT({Email} = '')" })
        .all();
      return records.map((r) => ({ tier, id: r.id, fields: r.fields as LeadFields }));
    })
  );
  return results.flat();
}

export type QueuedContent = { id: string; content: string; status: string; notes?: string };

export async function getContentQueue(): Promise<QueuedContent[]> {
  const table = getContentQueueTable();
  const records = await table.select({ pageSize: 50 }).all();
  return records.map((r) => ({
    id: r.id,
    content: (r.fields.Content as string) || "",
    status: (r.fields.Status as string) || "New",
    notes: r.fields.Notes as string | undefined,
  }));
}

export async function addContentToQueue(content: string): Promise<QueuedContent> {
  const table = getContentQueueTable();
  const created = await table.create([{ fields: { Content: content, Status: "New" } as any }]);
  const r = created[0];
  return { id: r.id, content: (r.fields.Content as string) || "", status: (r.fields.Status as string) || "New" };
}

export async function deleteQueuedContent(id: string): Promise<void> {
  const table = getContentQueueTable();
  await table.destroy([id]);
}

// Counts of leads sitting in "New" stage with an email, i.e. what the next
// outreach run would actually send to.
export async function getPendingOutreachCounts(): Promise<Record<Tier, number>> {
  const tiers = Object.keys(TIERS) as Tier[];
  const entries = await Promise.all(
    tiers.map(async (tier) => {
      const table = getTable(tier);
      const records = await table
        .select({ filterByFormula: "AND({Stage} = 'New', NOT({Email} = ''))", pageSize: 100 })
        .all();
      return [tier, records.length] as const;
    })
  );
  return Object.fromEntries(entries) as Record<Tier, number>;
}
