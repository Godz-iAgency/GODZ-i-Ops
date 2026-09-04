import Airtable from "airtable";

const PAT = process.env.AIRTABLE_PAT;
const BASE = process.env.AIRTABLE_BASE_MUSIC;

if (!PAT || !BASE) {
  throw new Error("Missing Airtable env vars: AIRTABLE_PAT, AIRTABLE_BASE_MUSIC");
}

Airtable.configure({ apiKey: PAT });

// Everything the Command Center touches now lives in one base. The old
// multi-business tables (Website/gBOMBS/BookWorm/HotCake) are retired and
// prefixed "DELETE - " in Airtable for manual review.
export const BASE_ID = BASE;
export const OUTREACH_TABLE_ID = "tblryUfFc1oBsKtDa";
export const PROGRESS_TABLE_ID = "tbls02Ih2kaa9fhQ6";
export const REPLY_LOG_TABLE_ID = "tblegcIUuI3ow1Cgy";
export const LINKEDIN_TABLE_ID = "tbljLKppcc89M5Iz1";
export const HUBS_TABLE_ID = "tblolqShJlWbCHoX4";

export function getOutreachTable() {
  return new Airtable().base(BASE as string)(OUTREACH_TABLE_ID);
}

export function getLinkedInTable() {
  return new Airtable().base(BASE as string)(LINKEDIN_TABLE_ID);
}

export function getHubsTable() {
  return new Airtable().base(BASE as string)(HUBS_TABLE_ID);
}

export function getProgressTable() {
  return new Airtable().base(BASE as string)(PROGRESS_TABLE_ID);
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
  const records = await getOutreachTable()
    .select({
      pageSize: 100,
      sort: [
        { field: "Campaign Day", direction: "asc" },
        { field: "Daily Slot", direction: "asc" },
      ],
    })
    .all();
  return records.map((r) => ({ id: r.id, fields: r.fields as ContactFields }));
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

// Counts for the Today page: how many are actually sendable vs still needing
// research, so the number 0/10 is never a mystery.
export async function getEmailPipelineCounts(): Promise<{ ready: number; researchNeeded: number }> {
  const all = await getOutreachTable()
    .select({ pageSize: 100, fields: ["Email", "Email Status"] })
    .all();
  let ready = 0;
  let researchNeeded = 0;
  for (const r of all) {
    const email = ((r.fields.Email as string) || "").trim();
    const status = (r.fields["Email Status"] as string) || "Not Contacted";
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
  const records = await getOutreachTable()
    .select({ pageSize: 100, filterByFormula: "NOT({Email} = '')" })
    .all();
  return records.map((r) => ({ id: r.id, fields: r.fields as ContactFields }));
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
  "Build Objective"?: string;
  "Build Completed"?: boolean;
  "Build Notes"?: string;
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
