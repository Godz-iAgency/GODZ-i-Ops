import {
  getAccessToken,
  listGmailLabels,
  createGmailLabel,
  deleteGmailLabel,
  listAllMessageIds,
  batchModifyMessages,
  getMessageSenderAndUnsubscribe,
} from "./gmail";
import { getAllContactsWithEmail } from "./airtable";

// Labels from a past organizing attempt that were never actually used --
// zero messages ever carried them, so deleting them loses nothing.
const EMPTY_LABELS_TO_DELETE = [
  "SplitMic Outreach",
  "gBOMBS Outreach",
  "Follow-Up",
  "Austin Bands",
  "Others",
  "Split Mic",
  "Marketing Agency",
];

// Labels that already carry real mail but were never wired to also drop the
// INBOX label -- tagging happened without ever decluttering anything.
const ARCHIVE_ON_SIGHT_LABELS = [
  "GODZ-i",
  "LinkedIn",
  "Finance & Receipts",
  "Promotion",
  "Talent Buyers",
  "Grants for Split Mic",
];

// Kept low because this project's Gmail API quota is only 6000 units/min per
// user -- gmailFetch backs off and retries on a rate-limit hit regardless,
// but staying modest here means fewer 65s stalls along the way.
const CONCURRENCY = 4;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, worker));
  return results;
}

export type InboxTriageResult = {
  scope: "backlog" | "recent";
  emptyLabelsDeleted: string[];
  labelsCreated: string[];
  archivedAlreadyLabeled: number;
  scanned: number;
  archivedByUnsubscribe: number;
  splitMicMatched: number;
  leftInInbox: number;
};

// "backlog" does the one-time label cleanup plus a full sweep of the current
// inbox. "recent" (the daily cron) only sweeps mail from the last couple days
// and skips label deletion/creation, which only need to happen once.
export async function runInboxTriage(scope: "backlog" | "recent"): Promise<InboxTriageResult> {
  const accessToken = await getAccessToken();
  const labels = await listGmailLabels(accessToken);
  const byName = new Map(labels.map((l) => [l.name, l]));

  const emptyLabelsDeleted: string[] = [];
  const labelsCreated: string[] = [];

  if (scope === "backlog") {
    for (const name of EMPTY_LABELS_TO_DELETE) {
      const label = byName.get(name);
      if (label) {
        await deleteGmailLabel(accessToken, label.id);
        byName.delete(name);
        emptyLabelsDeleted.push(name);
      }
    }
    for (const name of ["SplitMic", "Bookworm"]) {
      if (!byName.has(name)) {
        const id = await createGmailLabel(accessToken, name);
        byName.set(name, { id, name });
        labelsCreated.push(name);
      }
    }
  }

  const godziLabel = byName.get("GODZ-i");
  const splitMicLabel = byName.get("SplitMic");
  if (!godziLabel || !splitMicLabel) {
    throw new Error("GODZ-i or SplitMic label missing -- run the backlog scope at least once first");
  }

  let archivedAlreadyLabeled = 0;
  if (scope === "backlog") {
    const archiveLabelIds = ARCHIVE_ON_SIGHT_LABELS.map((n) => byName.get(n)?.id).filter((id): id is string => !!id);
    const idsToArchive = new Set<string>();
    for (const labelId of archiveLabelIds) {
      const ids = await listAllMessageIds(accessToken, { labelIds: [labelId, "INBOX"] });
      ids.forEach((id) => idsToArchive.add(id));
    }
    if (idsToArchive.size) {
      await batchModifyMessages(accessToken, [...idsToArchive], [], ["INBOX"]);
      archivedAlreadyLabeled = idsToArchive.size;
    }
  }

  // Everything with no user label at all: check the List-Unsubscribe signal,
  // and separately match the sender against the real SplitMic contact list
  // rather than guessing "real person" from a name or subject line.
  const q = scope === "recent" ? "in:inbox newer_than:2d has:nouserlabels" : "in:inbox has:nouserlabels";
  const candidateIds = await listAllMessageIds(accessToken, { q });

  const contacts = await getAllContactsWithEmail();
  const contactEmails = new Set(
    contacts.map((c) => c.fields.Email?.toLowerCase().trim()).filter((e): e is string => !!e)
  );

  const meta = await mapWithConcurrency(candidateIds, CONCURRENCY, (id) =>
    getMessageSenderAndUnsubscribe(accessToken, id)
  );

  const toArchiveAsNotification: string[] = [];
  const toLabelSplitMic: string[] = [];
  for (const m of meta) {
    if (m.hasUnsubscribe) {
      toArchiveAsNotification.push(m.id);
    } else if (contactEmails.has(m.fromEmail.toLowerCase())) {
      toLabelSplitMic.push(m.id);
    }
  }

  if (toArchiveAsNotification.length) {
    await batchModifyMessages(accessToken, toArchiveAsNotification, [godziLabel.id], ["INBOX"]);
  }
  if (toLabelSplitMic.length) {
    await batchModifyMessages(accessToken, toLabelSplitMic, [splitMicLabel.id], []);
  }

  return {
    scope,
    emptyLabelsDeleted,
    labelsCreated,
    archivedAlreadyLabeled,
    scanned: candidateIds.length,
    archivedByUnsubscribe: toArchiveAsNotification.length,
    splitMicMatched: toLabelSplitMic.length,
    leftInInbox: candidateIds.length - toArchiveAsNotification.length - toLabelSplitMic.length,
  };
}
