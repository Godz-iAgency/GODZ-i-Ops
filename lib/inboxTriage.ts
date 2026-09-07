import {
  getAccessToken,
  listGmailLabels,
  createGmailLabel,
  deleteGmailLabel,
  listAllMessageIds,
  batchModifyMessages,
  getMessageTriageMeta,
  MessageTriageMeta,
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

// These already carry real mail but were never wired to also drop the INBOX
// label -- tagging happened without ever decluttering anything. GODZ-i is
// deliberately excluded: personal mail belongs there AND in the inbox now.
const ARCHIVE_ON_SIGHT_LABELS = ["LinkedIn", "Finance & Receipts", "Promotion", "Talent Buyers", "Grants for Split Mic"];

// The categories Christopher actually wants, plus one catch-all for
// everything that doesn't fit them.
const CORE_LABELS = ["SplitMic", "Bookworm", "GODZ-i", "LinkedIn", "Google", "Finance & Receipts"];
const CATCHALL_LABEL = "Tools & Services";

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

const RECEIPT_PATTERN =
  /\b(invoice|receipt|payment|purchase confirmed|billing statement|order confirm(ed|ation)|your (bill|statement) is)\b/i;

// His own address -- self-sent notes always count as personal.
const OWN_EMAIL = "christopher@godz-iagency.com";

// Other personal addresses he's identified as his own. Mail from these is
// always personal, regardless of anything else. Add more as he provides them.
const PERSONAL_EMAILS: string[] = [
  "christopherdowner11@gmail.com",
  "krispercsbusiness@gmail.com",
  "krispercsfitness@gmail.com",
  "drum.adikofficial@gmail.com",
];

// Anything Google-related gets its own dedicated label -- same treatment as
// LinkedIn -- rather than being mixed into GODZ-i or the general catch-all.
const GOOGLE_PATTERN = /google workspace|google ads|google play|google search console|google maps|google payments|accounts\.google\.com|googleads/i;

// A missing List-Unsubscribe header does NOT mean a message is personal --
// most transactional/account notices (security alerts, "new device signed
// in", admin notices) never carry one. These two patterns catch what that
// header misses: senders whose local part is a generic automated address,
// and specific services seen cluttering the inbox.
const AUTOMATED_LOCALPART_PATTERN =
  /^(no-?reply|do-?not-?reply|notifications?|alerts?|support|hello|team|info|news|updates?|mailer|automated|welcome|billing)@/i;

const KNOWN_SERVICE_PATTERN =
  /zoom\.us|squarespace|cloudflare|zenbusiness|score\.org|reddit\.com|microsoft|amazonaws|amazon\.com|higgsfield|fireflies\.ai|mailchimp|buffer(app)?\.com|kroger|intuit|secretary of state|maps-platform/i;

export type Category = "SplitMic" | "Bookworm" | "LinkedIn" | "Google" | "FinanceReceipts" | "ToolsServices" | "GODZi";

// The actual routing rules: his own/known-personal addresses and real
// contacts win outright, then platform/content signals, and only mail that
// matches none of the automated signals is treated as personal.
function classify(
  meta: Pick<MessageTriageMeta, "fromEmail" | "subject" | "hasUnsubscribe">,
  splitMicEmails: Set<string>,
  bookwormEmails: Set<string>
): Category {
  const email = meta.fromEmail.toLowerCase();
  if (email === OWN_EMAIL || PERSONAL_EMAILS.includes(email)) return "GODZi";
  if (splitMicEmails.has(email)) return "SplitMic";
  if (bookwormEmails.has(email)) return "Bookworm";

  const domain = email.split("@")[1] || "";
  if (domain.endsWith("linkedin.com")) return "LinkedIn";
  if (domain.endsWith("google.com") || domain.endsWith("googlemail.com")) return "Google";

  if (RECEIPT_PATTERN.test(meta.subject)) return "FinanceReceipts";

  const text = `${email} ${meta.subject}`;
  if (GOOGLE_PATTERN.test(text)) return "Google";

  const looksAutomated =
    meta.hasUnsubscribe || AUTOMATED_LOCALPART_PATTERN.test(email) || KNOWN_SERVICE_PATTERN.test(text);
  if (looksAutomated) return "ToolsServices";

  return "GODZi";
}

function labelNameFor(category: Category): string {
  switch (category) {
    case "SplitMic":
      return "SplitMic";
    case "Bookworm":
      return "Bookworm";
    case "LinkedIn":
      return "LinkedIn";
    case "Google":
      return "Google";
    case "FinanceReceipts":
      return "Finance & Receipts";
    case "ToolsServices":
      return CATCHALL_LABEL;
    case "GODZi":
      return "GODZ-i";
  }
}

function labelIdFor(byName: Map<string, { id: string; name: string }>, category: Category): string {
  const name = labelNameFor(category);
  const label = byName.get(name);
  if (!label) throw new Error(`Missing label: ${name} -- run the backlog scope first`);
  return label.id;
}

// SplitMic/Bookworm and personal (GODZ-i) mail stays visible in the inbox --
// those are the three things Christopher actually wants to see there.
// Everything else gets archived once it's filed.
function staysInInbox(category: Category): boolean {
  return category === "SplitMic" || category === "Bookworm" || category === "GODZi";
}

export type InboxTriageResult = {
  scope: "backlog" | "recent";
  emptyLabelsDeleted: string[];
  labelsCreated: string[];
  archivedAlreadyLabeled: number;
  reclassifiedFromGodzi: Record<string, number>;
  scanned: number;
  routed: Record<Category, number>;
  leftInInbox: number;
};

async function fetchContactEmailSets(): Promise<{ splitMic: Set<string>; bookworm: Set<string> }> {
  // Bookworm has no outreach table yet -- this stays empty until it does,
  // rather than guessing.
  const contacts = await getAllContactsWithEmail();
  const splitMic = new Set(
    contacts.map((c) => c.fields.Email?.toLowerCase().trim()).filter((e): e is string => !!e)
  );
  return { splitMic, bookworm: new Set<string>() };
}

// "backlog" does the one-time label cleanup, re-sorts everything currently
// dumped under GODZ-i from the old broad rule, and sweeps the whole inbox.
// "recent" (the 3x/day cron) only sweeps the last few hours of new mail.
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
    for (const name of [...CORE_LABELS, CATCHALL_LABEL]) {
      if (!byName.has(name)) {
        const id = await createGmailLabel(accessToken, name);
        byName.set(name, { id, name });
        labelsCreated.push(name);
      }
    }
  }

  for (const name of [...CORE_LABELS, CATCHALL_LABEL]) {
    if (!byName.has(name)) throw new Error(`${name} label missing -- run the backlog scope at least once first`);
  }

  const { splitMic: splitMicEmails, bookworm: bookwormEmails } = await fetchContactEmailSets();

  let archivedAlreadyLabeled = 0;
  const reclassifiedFromGodzi: Record<string, number> = {};

  if (scope === "backlog") {
    // These small labels are already curated correctly -- just get them out
    // of the inbox.
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

    // GODZ-i used to be a catch-all under the old rule (anything bulk landed
    // there regardless of what it actually was). Re-run every message
    // currently under it through the real classifier and move out anything
    // that isn't genuinely personal mail.
    const godziLabel = byName.get("GODZ-i")!;
    const godziIds = await listAllMessageIds(accessToken, { labelIds: [godziLabel.id] });
    const godziMeta = await mapWithConcurrency(godziIds, CONCURRENCY, (id) => getMessageTriageMeta(accessToken, id));

    const moves = new Map<Category, string[]>();
    for (const m of godziMeta) {
      const category = classify(m, splitMicEmails, bookwormEmails);
      if (category === "GODZi") continue; // stays put
      if (!moves.has(category)) moves.set(category, []);
      moves.get(category)!.push(m.id);
    }
    for (const [category, ids] of moves) {
      if (!ids.length) continue;
      await batchModifyMessages(accessToken, ids, [labelIdFor(byName, category)], [godziLabel.id]);
      reclassifiedFromGodzi[category] = ids.length;
    }
  }

  // Everything with no user label at all: classify and route it.
  const q = scope === "recent" ? "in:inbox newer_than:1d has:nouserlabels" : "in:inbox has:nouserlabels";
  const candidateIds = await listAllMessageIds(accessToken, { q });
  const meta = await mapWithConcurrency(candidateIds, CONCURRENCY, (id) => getMessageTriageMeta(accessToken, id));

  const routed: Record<Category, number> = {
    SplitMic: 0,
    Bookworm: 0,
    LinkedIn: 0,
    Google: 0,
    FinanceReceipts: 0,
    ToolsServices: 0,
    GODZi: 0,
  };
  const byCategory = new Map<Category, string[]>();
  for (const m of meta) {
    const category = classify(m, splitMicEmails, bookwormEmails);
    routed[category]++;
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push(m.id);
  }

  for (const [category, ids] of byCategory) {
    if (!ids.length) continue;
    const removeLabelIds = staysInInbox(category) ? [] : ["INBOX"];
    await batchModifyMessages(accessToken, ids, [labelIdFor(byName, category)], removeLabelIds);
  }

  return {
    scope,
    emptyLabelsDeleted,
    labelsCreated,
    archivedAlreadyLabeled,
    reclassifiedFromGodzi,
    scanned: candidateIds.length,
    routed,
    leftInInbox: routed.SplitMic + routed.Bookworm + routed.GODZi,
  };
}
