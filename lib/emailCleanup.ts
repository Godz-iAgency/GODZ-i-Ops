import { randomUUID } from "node:crypto";
import {
  applyGmailLabel,
  getAccessToken,
  getMessageTriageMeta,
  listAllMessageIds,
  trashGmailMessages,
} from "./gmail";
import {
  GOOGLE_SHEET_SCHEMAS,
  ensureGoogleSheetsSchema,
  getGoogleSheetsTable,
} from "./googleSheets";

export const EMAIL_RETENTION_DAYS = 30;
export const EMAIL_REVIEW_BUFFER_DAYS = 7;
export const EMAIL_CLEANUP_BATCH_LIMIT = 400;
export const EMAIL_CLEANUP_LABEL = "Cleanup Review";

const PROTECTED_SUBJECT =
  /security|billing|invoice|receipt|payment|password|recovery|verify|verification|sign[ -]?in|support|case|order|contract|document|domain|tax|refund|legal|suspend|terminated|account access/i;

const SOURCE_QUERIES: Record<string, string> = {
  LinkedIn: "from:(linkedin.com)",
  Reddit: "from:(redditmail.com)",
  Vercel: "from:(vercel.com)",
  GitHub: "from:(github.com)",
  Buffer: "from:(buffer.com OR bufferapp.com)",
  Oracle: "from:(oracle-mail.com OR vanillaforums.email)",
  FlightAware: "from:(flightaware.com)",
  Alignable: "from:(alignable.com)",
  Salesforce: "from:(salesforce.com)",
  AnymailFinder: "from:(anymailfinder.com)",
  CalendarNotifications: "from:(calendar-notification@google.com)",
  DeliveryFailures: "from:(mailer-daemon@googlemail.com)",
};

const PROTECTED_QUERY =
  '-label:SplitMic -label:Bookworm -label:GODZ-i -label:"Finance & Receipts" -is:starred -in:trash -in:spam';

type CleanupLogFields = {
  "Run At"?: string;
  Trigger?: string;
  "Retention Days"?: number;
  "Review Buffer Days"?: number;
  "New Candidates"?: number;
  "Moved to Trash"?: number;
  "Remaining Review"?: number;
  "Recoverable in Trash"?: number;
  Status?: string;
  Error?: string;
};

export type EmailCleanupStatus = {
  retentionDays: number;
  reviewBufferDays: number;
  reviewQueue: number;
  readyToTrash: number;
  recoverableInTrash: number;
  batchLimit: number;
  lastRun: CleanupLogFields | null;
  schedule: string;
};

export type EmailCleanupResult = EmailCleanupStatus & {
  trigger: "Manual" | "Scheduled";
  newCandidates: number;
  movedToTrash: number;
};

const cleanupLogSchema = GOOGLE_SHEET_SCHEMAS.find((schema) => schema.title === "Email Cleanup Log")!;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, worker));
  return results;
}

async function count(accessToken: string, query: string): Promise<number> {
  return (await listAllMessageIds(accessToken, { q: query })).length;
}

async function getLastRun(): Promise<CleanupLogFields | null> {
  try {
    const records = await getGoogleSheetsTable("Email Cleanup Log")
      .select({ sort: [{ field: "Run At", direction: "desc" }], maxRecords: 1 })
      .all();
    return records.length ? (records[0].fields as CleanupLogFields) : null;
  } catch {
    return null;
  }
}

async function writeLog(fields: CleanupLogFields): Promise<void> {
  await ensureGoogleSheetsSchema(cleanupLogSchema, 500);
  await getGoogleSheetsTable("Email Cleanup Log").create([
    { id: `cleanup_${randomUUID()}`, fields },
  ]);
}

export async function getEmailCleanupStatus(): Promise<EmailCleanupStatus> {
  const readyAge = EMAIL_RETENTION_DAYS + EMAIL_REVIEW_BUFFER_DAYS;
  const accessToken = await getAccessToken();
  const [reviewQueue, readyToTrash, recoverableInTrash, lastRun] = await Promise.all([
    count(accessToken, `label:"${EMAIL_CLEANUP_LABEL}" -in:trash`),
    count(accessToken, `label:"${EMAIL_CLEANUP_LABEL}" older_than:${readyAge}d ${PROTECTED_QUERY}`),
    count(accessToken, `label:"${EMAIL_CLEANUP_LABEL}" in:trash`),
    getLastRun(),
  ]);
  return {
    retentionDays: EMAIL_RETENTION_DAYS,
    reviewBufferDays: EMAIL_REVIEW_BUFFER_DAYS,
    reviewQueue,
    readyToTrash,
    recoverableInTrash,
    batchLimit: EMAIL_CLEANUP_BATCH_LIMIT,
    lastRun,
    schedule: "Every Sunday around 3–4 AM Central",
  };
}

async function stageNewCandidates(): Promise<number> {
  const accessToken = await getAccessToken();
  const staged = new Set<string>();
  const withoutReviewLabel = `-label:"${EMAIL_CLEANUP_LABEL}"`;

  for (const sourceQuery of Object.values(SOURCE_QUERIES)) {
    const ids = await listAllMessageIds(accessToken, {
      q: `older_than:${EMAIL_RETENTION_DAYS}d ${sourceQuery} ${withoutReviewLabel} ${PROTECTED_QUERY}`,
    });
    const metadata = await mapWithConcurrency(ids, 6, (id) => getMessageTriageMeta(accessToken, id));
    for (const message of metadata) {
      if (!PROTECTED_SUBJECT.test(message.subject)) staged.add(message.id);
    }
  }

  if (staged.size) await applyGmailLabel([...staged], EMAIL_CLEANUP_LABEL);
  return staged.size;
}

export async function runEmailCleanup(trigger: "Manual" | "Scheduled"): Promise<EmailCleanupResult> {
  const runAt = new Date().toISOString();
  try {
    const newCandidates = await stageNewCandidates();
    const accessToken = await getAccessToken();
    const readyAge = EMAIL_RETENTION_DAYS + EMAIL_REVIEW_BUFFER_DAYS;
    const readyIds = await listAllMessageIds(accessToken, {
      q: `label:"${EMAIL_CLEANUP_LABEL}" older_than:${readyAge}d ${PROTECTED_QUERY}`,
    });
    const movedToTrash = await trashGmailMessages(accessToken, readyIds.slice(0, EMAIL_CLEANUP_BATCH_LIMIT));
    const status = await getEmailCleanupStatus();
    await writeLog({
      "Run At": runAt,
      Trigger: trigger,
      "Retention Days": EMAIL_RETENTION_DAYS,
      "Review Buffer Days": EMAIL_REVIEW_BUFFER_DAYS,
      "New Candidates": newCandidates,
      "Moved to Trash": movedToTrash,
      "Remaining Review": status.reviewQueue,
      "Recoverable in Trash": status.recoverableInTrash,
      Status: "Completed",
      Error: "",
    });
    return { ...status, lastRun: { "Run At": runAt, Trigger: trigger, Status: "Completed" }, trigger, newCandidates, movedToTrash };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email cleanup failed";
    try {
      await writeLog({
        "Run At": runAt,
        Trigger: trigger,
        "Retention Days": EMAIL_RETENTION_DAYS,
        "Review Buffer Days": EMAIL_REVIEW_BUFFER_DAYS,
        Status: "Failed",
        Error: message,
      });
    } catch {
      // Preserve the original cleanup error if logging also fails.
    }
    throw error;
  }
}
