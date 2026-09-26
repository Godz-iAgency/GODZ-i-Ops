import Airtable from "airtable";

const PAT = process.env.AIRTABLE_PAT;
const BASE = process.env.AIRTABLE_BASE_MUSIC;

if (!PAT || !BASE) {
  throw new Error("Missing Airtable env vars: AIRTABLE_PAT, AIRTABLE_BASE_MUSIC");
}

// Never let a rate-limited serverless request retry for minutes. Read-heavy
// paths below pace their own pagination; single-request paths fail fast so the
// UI can show Retry instead of leaving a Vercel function alive indefinitely.
Airtable.configure({ apiKey: PAT, noRetryIfRateLimited: true, requestTimeout: 15_000 });

// Everything the Command Center touches lives in one base ("GODZ-i CRM" --
// renamed 2026-09-07 from "GODZ-i Music CRM" now that it also holds Bookworm
// data, not just SplitMic). The old multi-business tables (Website/gBOMBS/
// HotCake) are retired and prefixed "DELETE - " in Airtable for manual
// review; BookWorm Leads was migrated forward into Bookworm Outreach below
// rather than retired, since that data is still live.
export const BASE_ID = BASE;
export const OUTREACH_TABLE_ID = "tblryUfFc1oBsKtDa";
export const OUTREACH_CACHE_TAG = "airtable-outreach";
export const PROGRESS_TABLE_ID = "tbls02Ih2kaa9fhQ6";
export const REPLY_LOG_TABLE_ID = "tblegcIUuI3ow1Cgy";
export const LINKEDIN_TABLE_ID = "tbljLKppcc89M5Iz1";
export const HUBS_TABLE_ID = "tblolqShJlWbCHoX4";
export const BOOKWORM_OUTREACH_TABLE_ID = "tbl7Otn4SbdJpF97E";
export const BOOKWORM_TIKTOK_TABLE_ID = "tblKOYrjzZS8xdl60";
export const EXECUTION_SETTINGS_TABLE = "Execution Settings";

export function getOutreachTable() {
  return new Airtable().base(BASE as string)(OUTREACH_TABLE_ID);
}

export function getLinkedInTable() {
  return new Airtable().base(BASE as string)(LINKEDIN_TABLE_ID);
}

export function getBookwormOutreachTable() {
  return new Airtable().base(BASE as string)(BOOKWORM_OUTREACH_TABLE_ID);
}

export function getBookwormTikTokTable() {
  return new Airtable().base(BASE as string)(BOOKWORM_TIKTOK_TABLE_ID);
}

export function getHubsTable() {
  return new Airtable().base(BASE as string)(HUBS_TABLE_ID);
}

export function getProgressTable() {
  return new Airtable().base(BASE as string)(PROGRESS_TABLE_ID);
}

export function getExecutionSettingsTable() {
  return new Airtable().base(BASE as string)(EXECUTION_SETTINGS_TABLE);
}

function getReplyLogTable() {
  return new Airtable().base(BASE as string)(REPLY_LOG_TABLE_ID);
}

// ---------------------------------------------------------------- contacts

export type ContactFields = {
  "Name / Target"?: string;
  Organization?: string;
  Role?: string;
  Category?: string;
  Priority?: number;
  "Campaign Day"?: number;
  "Daily Slot"?: number;
  Phone?: string;
  "Why They Matter to SplitMic"?: string;
  "Source / Research Starting Point"?: string;
  Website?: string;
  "City / Area"?: string;
  "Primary Source URL"?: string;
  "Secondary Source URL"?: string;
  "Verification Status"?: string;
  "Date Verified"?: string;
  Email?: string;
  "Email Status"?: string;
  "Email Last Contacted"?: string;
  "Email Follow-up Date"?: string;
  "LinkedIn Name"?: string;
  "LinkedIn URL"?: string;
  "LinkedIn Status"?: string;
  "LinkedIn Last Contacted"?: string;
  "Relationship Status"?: string;
  "Response Summary"?: string;
  "Feedback / Pain Point"?: string;
  "Next Action"?: string;
  "Next Action Date"?: string;
  Notes?: string;
  "Do Not Contact"?: boolean;
  "Suppression Reason"?: string;
  "Suppressed At"?: string;
};

export type Contact = { id: string; fields: ContactFields };

type AirtableListResponse = {
  records?: Array<{ id: string; fields: ContactFields }>;
  offset?: string;
  error?: { type?: string; message?: string };
};

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

// The SplitMic table spans six Airtable pages. Airtable allows five requests
// per second per base, so the SDK's immediate page chaining can rate-limit the
// sixth request even when no other dashboard tab is open. Pace the pages and
// bound 429 retries so a failed request always finishes.
async function getAllContactsPaced(): Promise<Contact[]> {
  const contacts: Contact[] = [];
  let offset: string | undefined;
  let page = 0;
  do {
    if (page > 0) await wait(275);
    const query = new URLSearchParams({ pageSize: "100" });
    if (offset) query.set("offset", offset);
    const url = `https://api.airtable.com/v0/${encodeURIComponent(BASE as string)}/${OUTREACH_TABLE_ID}?${query}`;

    let payload: AirtableListResponse | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${PAT}` },
        next: { revalidate: false, tags: [OUTREACH_CACHE_TAG] },
        signal: AbortSignal.timeout(15_000),
      });
      payload = (await response.json().catch(() => ({}))) as AirtableListResponse;
      if (response.status === 429 && attempt < 2) {
        await wait(5_000);
        continue;
      }
      if (!response.ok) {
        throw new Error(payload.error?.message || `Airtable returned HTTP ${response.status}`);
      }
      break;
    }
    if (!payload?.records) throw new Error("Airtable returned no contact records");
    contacts.push(...payload.records.map((record) => ({ id: record.id, fields: record.fields })));
    offset = payload.offset;
    page++;
  } while (offset);

  return contacts.sort(
    (a, b) =>
      (a.fields["Campaign Day"] ?? Number.MAX_SAFE_INTEGER) -
        (b.fields["Campaign Day"] ?? Number.MAX_SAFE_INTEGER) ||
      (a.fields["Daily Slot"] ?? Number.MAX_SAFE_INTEGER) -
        (b.fields["Daily Slot"] ?? Number.MAX_SAFE_INTEGER)
  );
}

// The email pipeline is a research funnel first: a row earns its way from
// "Research Needed" to "Ready for Outreach" only once it has a real person or
// organization and a usable email address.
export const RELATIONSHIP_STAGES = [
  "Research Needed",
  "Ready for Outreach",
  "Contacted",
  "Replied",
  "Engaged",
  "Meeting",
  "Follow-up",
  "Partner",
  "Not Interested",
] as const;

export const EMAIL_STATUSES = ["Not Contacted", "Sent", "Replied", "No Response", "Bounced"] as const;

export async function getAllContacts(): Promise<Contact[]> {
  return getAllContactsPaced();
}

// The gate for TODAY'S 10: a record only qualifies once it has a usable email
// address and has not been emailed yet. Research targets without an address
// deliberately never surface here -- there is nobody to legitimately write to.
// Anyone who unsubscribed, bounced, or complained is excluded outright: the
// suppression list wins over every other pipeline rule.
const READY_TO_EMAIL =
  "AND(NOT({Email} = ''), NOT({Do Not Contact}), OR({Email Status} = 'Not Contacted', {Email Status} = ''))";

// The next N contacts ready for a first email, in the campaign order baked into
// the CSV. Deliberately sends nothing -- it only decides who is up next.
export async function getTodaysContacts(limit = 10): Promise<Contact[]> {
  const records = await getOutreachTable()
    .select({
      pageSize: limit,
      maxRecords: limit,
      filterByFormula: READY_TO_EMAIL,
      sort: [
        { field: "Campaign Day", direction: "asc" },
        { field: "Daily Slot", direction: "asc" },
      ],
    })
    .all();
  return records.map((r) => ({ id: r.id, fields: r.fields as ContactFields }));
}

const NEEDS_EMAIL =
  "AND({Email} = '', OR({Relationship Status} = 'Research Needed', {Relationship Status} = ''))";

// Feeds the quick-entry list on the Today page: the next batch of targets that
// only need an email address typed in to become sendable. Ordered the same
// way as the outreach queue so filling these in feeds today's 10 first.
export async function getContactsNeedingEmail(limit = 20): Promise<Contact[]> {
  const records = await getOutreachTable()
    .select({
      pageSize: limit,
      maxRecords: limit,
      filterByFormula: NEEDS_EMAIL,
      sort: [
        { field: "Campaign Day", direction: "asc" },
        { field: "Daily Slot", direction: "asc" },
      ],
    })
    .all();
  return records.map((r) => ({ id: r.id, fields: r.fields as ContactFields }));
}

// Counts for the Today page: how many are actually sendable vs still needing
// research, so the number 0/10 is never a mystery.
export async function getEmailPipelineCounts(): Promise<{ ready: number; researchNeeded: number }> {
  const all = await getAllContactsPaced();
  let ready = 0;
  let researchNeeded = 0;
  for (const r of all) {
    const email = (r.fields.Email || "").trim();
    const status = r.fields["Email Status"] || "Not Contacted";
    if (!email) researchNeeded++;
    else if (status === "Not Contacted") ready++;
  }
  return { ready, researchNeeded };
}

export async function getContactById(id: string): Promise<Contact | null> {
  try {
    const record = await getOutreachTable().find(id);
    return { id: record.id, fields: record.fields as ContactFields };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------- suppression
// One switch -- "Do Not Contact" -- gates every send. It is set from three
// places: an unsubscribe click, an SES bounce, and an SES complaint. Nothing
// clears it automatically; a person who opted out stays opted out.

export async function suppressContact(id: string, reason: string): Promise<void> {
  await getOutreachTable().update(
    [
      {
        id,
        fields: {
          "Do Not Contact": true,
          "Suppression Reason": reason,
          "Suppressed At": new Date().toISOString().slice(0, 10),
        } as never,
      },
    ],
    { typecast: true }
  );
}

// Bounce and complaint notifications identify people by address, not by record
// id, and the same address can legitimately appear on more than one row.
export async function suppressByEmail(email: string, reason: string, markBounced: boolean): Promise<number> {
  const safe = email.replace(/'/g, "\\'");
  const records = await getOutreachTable()
    .select({ pageSize: 100, filterByFormula: `LOWER({Email}) = '${safe.toLowerCase()}'` })
    .all();
  if (!records.length) return 0;

  await getOutreachTable().update(
    records.map((r) => ({
      id: r.id,
      fields: {
        "Do Not Contact": true,
        "Suppression Reason": reason,
        "Suppressed At": new Date().toISOString().slice(0, 10),
        ...(markBounced ? { "Email Status": "Bounced" } : {}),
      } as never,
    })),
    { typecast: true }
  );
  return records.length;
}

// Enforces EMAIL_DAILY_LIMIT server-side. Date fields need DATETIME_FORMAT --
// Airtable compares them as dates, so a bare string equality matches nothing.
export async function countEmailsSentOn(date: string): Promise<number> {
  const records = await getOutreachTable()
    .select({
      pageSize: 100,
      filterByFormula: `DATETIME_FORMAT({Email Last Contacted}, 'YYYY-MM-DD') = '${date}'`,
      fields: ["Email Last Contacted"],
    })
    .all();
  return records.length;
}

// Used by the reply checker to match an inbound sender back to a contact.
export async function getAllContactsWithEmail(): Promise<Contact[]> {
  return (await getAllContactsPaced()).filter((record) => !!record.fields.Email?.trim());
}

// --------------------------------------------------------------- linkedin
// A completely separate pipeline. Prospects are found by hand on LinkedIn each
// day using the Search tab's terms, then typed in here. Nothing links these
// records to the 500 email research rows, and nothing needs to.

export const LINKEDIN_STATUSES = [
  "New",
  "Contacted",
  "Connected",
  "Replied",
  "Engaged",
  "Follow-up",
  "Meeting",
] as const;

export type LinkedInFields = {
  Name?: string;
  Organization?: string;
  Role?: string;
  Category?: string;
  Location?: string;
  Email?: string;
  "LinkedIn URL"?: string;
  "Date Contacted"?: string;
  Status?: string;
  Response?: string;
  Notes?: string;
  "Next Action"?: string;
  "Next Action Date"?: string;
};

export type LinkedInProspect = { id: string; fields: LinkedInFields };

export async function getAllLinkedInProspects(): Promise<LinkedInProspect[]> {
  const records = await getLinkedInTable()
    .select({ pageSize: 100, sort: [{ field: "Date Contacted", direction: "desc" }] })
    .all();
  return records.map((r) => ({ id: r.id, fields: r.fields as LinkedInFields }));
}

// Drives the Today page's LinkedIn counter without any manual tallying.
// DATETIME_FORMAT is required here: Airtable compares date fields as dates, so
// a bare `{Date Contacted} = '2026-08-25'` silently matches nothing.
export async function countLinkedInContactedOn(date: string): Promise<number> {
  const records = await getLinkedInTable()
    .select({
      pageSize: 100,
      filterByFormula: `DATETIME_FORMAT({Date Contacted}, 'YYYY-MM-DD') = '${date}'`,
      fields: ["Date Contacted"],
    })
    .all();
  return records.length;
}

// ------------------------------------------------------- austin music hubs
// A third dataset, kept deliberately separate from both outreach pipelines.
// Optional resource: organizations worth a phone call in a spare 20 minutes.
// Nothing here feeds the daily quota or the 100-day completion logic.

export const HUB_STATUSES = [
  "Not Contacted",
  "Called",
  "Connected",
  "Follow Up",
  "Partnership",
  "Not Relevant",
] as const;

export type HubFields = {
  Name?: string;
  Category?: string;
  "Who They Reach"?: string;
  Phone?: string;
  Email?: string;
  Website?: string;
  "Why Call"?: string;
  Status?: string;
  "Last Contacted"?: string;
  Notes?: string;
};

export type Hub = { id: string; fields: HubFields };

export async function getAllHubs(): Promise<Hub[]> {
  const records = await getHubsTable()
    .select({ pageSize: 100, sort: [{ field: "Name", direction: "asc" }] })
    .all();
  return records.map((r) => ({ id: r.id, fields: r.fields as HubFields }));
}

// ------------------------------------------------------------ day progress

export type ProgressFields = {
  Date?: string;
  "Day Number"?: number;
  Weekday?: string;
  "Emails Sent"?: number;
  "LinkedIn Sent"?: number;
  "Bookworm Emails Sent"?: number;
  "Bookworm TikTok Sent"?: number;
  "Build Project"?: string;
  "Build Objective"?: string;
  "Build Status"?: string;
  "Build Completed"?: boolean;
  "Build Notes"?: string;
  "Delivery Objective"?: string;
  "Delivery Status"?: string;
  "Delivery Recipient"?: string;
  "Delivery Link"?: string;
  "Delivery Notes"?: string;
  "Deliver Completed"?: boolean;
  "Feedback Received"?: string;
  "Needs Follow-up"?: string;
  "Deliver Next Action"?: string;
  "Camera Practice"?: boolean;
  "Content Posted"?: boolean;
  "Content Platform"?: string;
  "Content Title"?: string;
  "Content URL"?: string;
  Book?: string;
  "Pages or Chapter"?: string;
  Learned?: string;
  Apply?: string;
  "Deep Work Completed"?: boolean;
  "Deep Work Notes"?: string;
  "Day Note"?: string;
};

export async function getProgressForDate(date: string): Promise<ProgressFields | null> {
  const records = await getProgressTable()
    .select({ filterByFormula: `{Date} = '${date}'`, maxRecords: 1 })
    .all();
  return records.length ? (records[0].fields as ProgressFields) : null;
}

export async function getAllProgress(): Promise<ProgressFields[]> {
  const records = await getProgressTable().select({ pageSize: 100 }).all();
  return records.map((r) => r.fields as ProgressFields);
}

// One row per calendar date: updates in place if the day already exists so
// hitting Save Today twice never creates a duplicate day.
export async function saveProgress(date: string, fields: ProgressFields): Promise<ProgressFields> {
  const table = getProgressTable();
  const existing = await table
    .select({ filterByFormula: `{Date} = '${date}'`, maxRecords: 1 })
    .all();

  const payload = { ...fields, Date: date };
  const saved = existing.length
    ? await table.update([{ id: existing[0].id, fields: payload as never }], { typecast: true })
    : await table.create([{ fields: payload as never }], { typecast: true });
  return saved[0].fields as ProgressFields;
}

// --------------------------------------------------------------- reply log
// Every inbound reply from someone in the outreach list becomes a row here.
// It doubles as the dedupe ledger for the cron (Message ID is the key) and as
// the triage queue the Replies tab reads.

export type ReplyFields = {
  "Message ID"?: string;
  Source?: string;
  "From Email"?: string;
  "From Name"?: string;
  "Contact Name"?: string;
  Organization?: string;
  "Contact Record ID"?: string;
  Subject?: string;
  Body?: string;
  "Thread ID"?: string;
  "RFC Message ID"?: string;
  "Received At"?: string;
  "Notified At"?: string;
  Status?: string;
  Intent?: string;
  "Suggested Reply"?: string;
  "My Reply"?: string;
  "Replied At"?: string;
};

export type Reply = { id: string; fields: ReplyFields };

export async function wasAlreadyNotified(messageId: string): Promise<boolean> {
  const records = await getReplyLogTable()
    .select({ filterByFormula: `{Message ID} = '${messageId}'`, maxRecords: 1 })
    .all();
  return records.length > 0;
}

export async function createReply(fields: ReplyFields): Promise<Reply> {
  const created = await getReplyLogTable().create([{ fields: fields as never }], { typecast: true });
  return { id: created[0].id, fields: created[0].fields as ReplyFields };
}

export async function updateReply(id: string, fields: ReplyFields): Promise<Reply> {
  const updated = await getReplyLogTable().update([{ id, fields: fields as never }], { typecast: true });
  return { id: updated[0].id, fields: updated[0].fields as ReplyFields };
}

export async function getReplyById(id: string): Promise<Reply | null> {
  try {
    const record = await getReplyLogTable().find(id);
    return { id: record.id, fields: record.fields as ReplyFields };
  } catch {
    return null;
  }
}

export async function getAllReplies(): Promise<Reply[]> {
  const records = await getReplyLogTable()
    .select({ pageSize: 100, sort: [{ field: "Received At", direction: "desc" }] })
    .all();
  return records.map((r) => ({ id: r.id, fields: r.fields as ReplyFields }));
}

// --------------------------------------------------------- bookworm outreach
// A separate, deliberately lighter pipeline from the SplitMic 500: Bookworm
// has no cold-sales funnel, just a short list of Austin book clubs, stores,
// libraries, authors, and influencers to point at the free Whop community.

export const BOOKWORM_RELATIONSHIP_STAGES = ["New", "Contacted", "Replied", "Joined Whop", "Not Interested"] as const;

export type BookwormContactFields = {
  Name?: string;
  Category?: string;
  Priority?: string;
  Opportunity?: string;
  Angle?: string;
  Address?: string;
  Phone?: string;
  Email?: string;
  "Channel Handle"?: string;
  "Relationship Status"?: string;
  "Next Action"?: string;
  "Next Action Date"?: string;
  "Profile URL"?: string;
  "Last Contact"?: string;
  Notes?: string;
};

export type BookwormContact = { id: string; fields: BookwormContactFields };

export async function getAllBookwormContacts(): Promise<BookwormContact[]> {
  const records = await getBookwormOutreachTable().select({ pageSize: 100, sort: [{ field: "Name", direction: "asc" }] }).all();
  return records.map((r) => ({ id: r.id, fields: r.fields as BookwormContactFields }));
}

export async function getBookwormContactById(id: string): Promise<BookwormContact | null> {
  try {
    const record = await getBookwormOutreachTable().find(id);
    return { id: record.id, fields: record.fields as BookwormContactFields };
  } catch {
    return null;
  }
}

// ------------------------------------------------------- bookworm tiktok
// Bookworm's social channel, the counterpart to SplitMic's LinkedIn. Creators
// in personal development and book/e-book niches are found by hand on TikTok
// each day (goal 10) using the Search tab's terms, then logged here. Separate
// from Bookworm Outreach (Austin local targets) on purpose: different audience,
// different stages, and it feeds its own Today counter.

export const BOOKWORM_TIKTOK_STATUSES = ["New", "DM Sent", "Replied", "In Talks", "Partnered", "Not Interested"] as const;

export type BookwormTikTokFields = {
  Name?: string;
  "Display Name"?: string;
  "TikTok User ID"?: string;
  "TikTok Handle"?: string;
  "TikTok URL"?: string;
  Followers?: number;
  Following?: number;
  "Total Likes"?: number;
  "Average Views"?: number;
  "Average Engagement Rate %"?: number;
  "Follower To Avg Views Ratio"?: number;
  "Days Since Last Post"?: number;
  "Last Post Date"?: string;
  Bio?: string;
  "Discovery Source"?: string;
  "Discovery Category"?: string;
  List?: string;
  Excluded?: boolean;
  "Enriched At"?: string;
  Niche?: string;
  Email?: string;
  "Date Contacted"?: string;
  Status?: string;
  Response?: string;
  Notes?: string;
  "Next Action"?: string;
  "Next Action Date"?: string;
};

export type BookwormTikTokCreator = { id: string; fields: BookwormTikTokFields };

export async function getAllBookwormTikTokCreators(): Promise<BookwormTikTokCreator[]> {
  const records = await getBookwormTikTokTable()
    .select({ pageSize: 100, sort: [{ field: "Date Contacted", direction: "desc" }] })
    .all();
  return records.map((r) => ({ id: r.id, fields: r.fields as BookwormTikTokFields }));
}

// ------------------------------------------------------ execution settings

export type ExecutionSettings = {
  "SplitMic LinkedIn Target": number;
  "SplitMic Email Target": number;
  "Bookworm TikTok Target": number;
  "Bookworm Email Target": number;
};

export const DEFAULT_EXECUTION_SETTINGS: ExecutionSettings = {
  "SplitMic LinkedIn Target": 10,
  "SplitMic Email Target": 5,
  "Bookworm TikTok Target": 10,
  "Bookworm Email Target": 5,
};

export async function getExecutionSettings(): Promise<{ id: string | null; settings: ExecutionSettings }> {
  const records = await getExecutionSettingsTable().select({ maxRecords: 1 }).all();
  if (!records.length) return { id: null, settings: DEFAULT_EXECUTION_SETTINGS };
  const fields = records[0].fields as Partial<ExecutionSettings>;
  return {
    id: records[0].id,
    settings: {
      "SplitMic LinkedIn Target": Number(fields["SplitMic LinkedIn Target"] ?? 10),
      "SplitMic Email Target": Number(fields["SplitMic Email Target"] ?? 5),
      "Bookworm TikTok Target": Number(fields["Bookworm TikTok Target"] ?? 10),
      "Bookworm Email Target": Number(fields["Bookworm Email Target"] ?? 5),
    },
  };
}

export async function saveExecutionSettings(settings: ExecutionSettings): Promise<ExecutionSettings> {
  const current = await getExecutionSettings();
  const fields = { Name: "Default", ...settings };
  if (current.id) {
    await getExecutionSettingsTable().update([{ id: current.id, fields: fields as never }], { typecast: true });
  } else {
    await getExecutionSettingsTable().create([{ fields: fields as never }], { typecast: true });
  }
  return settings;
}
