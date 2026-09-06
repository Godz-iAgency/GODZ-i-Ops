const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

export async function getAccessToken(): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error("Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Gmail token refresh failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string;
}

export type GmailMessage = {
  id: string;
  threadId: string;
  rfcMessageId: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  snippet: string;
  body: string;
  internalDate: string;
};

function parseFromHeader(from: string): { fromEmail: string; fromName: string } {
  const match = from.match(/^(.*?)\s*<(.+)>$/);
  if (match) return { fromName: match[1].replace(/"/g, "").trim(), fromEmail: match[2].toLowerCase() };
  return { fromName: from, fromEmail: from.toLowerCase() };
}

function b64urlDecode(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function b64urlEncode(data: string): string {
  return Buffer.from(data, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

type Payload = {
  mimeType?: string;
  body?: { data?: string };
  parts?: Payload[];
};

// Gmail nests the actual text arbitrarily deep depending on how the sender's
// client built the message, so this walks the tree rather than assuming shape.
// text/plain wins; HTML is only used when that's all there is.
function extractBody(payload: Payload | undefined): string {
  if (!payload) return "";
  const plain = findPart(payload, "text/plain");
  if (plain) return plain;
  const html = findPart(payload, "text/html");
  if (html) {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  return "";
}

function findPart(payload: Payload, mimeType: string): string | null {
  if (payload.mimeType === mimeType && payload.body?.data) {
    return b64urlDecode(payload.body.data);
  }
  for (const part of payload.parts || []) {
    const found = findPart(part, mimeType);
    if (found) return found;
  }
  return null;
}

// Quoted history makes classification noisy and burns tokens, so the reply is
// cut at the first quote marker.
export function stripQuotedReply(body: string): string {
  const markers = [
    /^On .+ wrote:$/m,
    /^-{2,}\s*Original Message\s*-{2,}$/im,
    /^_{5,}$/m,
    /^From:\s.+$/m,
  ];
  let cut = body.length;
  for (const re of markers) {
    const m = body.match(re);
    if (m && m.index !== undefined && m.index < cut) cut = m.index;
  }
  return body
    .slice(0, cut)
    .replace(/^>.*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchMessagesByQuery(query: string, maxResults: number): Promise<GmailMessage[]> {
  const accessToken = await getAccessToken();
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!listRes.ok) throw new Error(`Gmail list failed: ${listRes.status} ${await listRes.text()}`);
  const listData = await listRes.json();
  const ids: string[] = (listData.messages || []).map((m: { id: string }) => m.id);

  const messages = await Promise.all(
    ids.map(async (id) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!msgRes.ok) return null;
      const msg = await msgRes.json();
      const headers: Array<{ name: string; value: string }> = msg.payload?.headers || [];
      const header = (n: string) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || "";
      const { fromEmail, fromName } = parseFromHeader(header("From"));
      return {
        id: msg.id,
        threadId: msg.threadId,
        rfcMessageId: header("Message-ID"),
        fromEmail,
        fromName,
        subject: header("Subject") || "(no subject)",
        snippet: msg.snippet || "",
        body: stripQuotedReply(extractBody(msg.payload)),
        internalDate: msg.internalDate,
      } as GmailMessage;
    })
  );
  return messages.filter((m): m is GmailMessage => m !== null);
}

export async function getRecentInboxMessages(minutesBack: number): Promise<GmailMessage[]> {
  const afterSeconds = Math.floor(Date.now() / 1000) - minutesBack * 60;
  return fetchMessagesByQuery(`in:inbox after:${afterSeconds}`, 25);
}

// Lets the assistant search the real inbox with normal Gmail search syntax
// (e.g. "from:x@y.com", "subject:invoice", "after:2026/09/01") instead of a
// fixed lookback window.
export async function searchGmailMessages(query: string, maxResults = 10): Promise<GmailMessage[]> {
  const capped = Math.min(Math.max(maxResults, 1), 20);
  return fetchMessagesByQuery(query, capped);
}

// A delivery failure arrives as a normal inbox message from the mail system,
// which is the only bounce signal Gmail gives -- there is no webhook.
export function isBounceMessage(msg: GmailMessage): boolean {
  const from = msg.fromEmail.toLowerCase();
  return (
    from.includes("mailer-daemon") ||
    from.includes("postmaster@") ||
    /delivery status notification \(failure\)|undeliverable|delivery has failed/i.test(msg.subject)
  );
}

// Pulls the address that actually failed out of the bounce report body.
export function extractBouncedAddress(msg: GmailMessage): string | null {
  const m = msg.body.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g);
  if (!m) return null;
  const skip = /mailer-daemon|postmaster|googlemail\.com|google\.com/i;
  return m.find((a) => !skip.test(a)) || null;
}

export type SendArgs = {
  to: string;
  subject: string;
  rawMime: string;
  threadId?: string;
};

export async function sendGmailMessage({ rawMime, threadId }: SendArgs): Promise<{ id: string; threadId: string }> {
  const accessToken = await getAccessToken();
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: b64urlEncode(rawMime), ...(threadId ? { threadId } : {}) }),
  });
  if (!res.ok) throw new Error(`Gmail send failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { id: data.id, threadId: data.threadId };
}

// --------------------------------------------------------- inbox triage

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// This project's Gmail API quota is 6000 units/min per user -- easy to blow
// through when scanning thousands of messages. Rather than tune request
// pacing to a unit budget that could change, this just backs off and retries
// whenever Google says the rate limit was hit, so a scan of any size finishes
// on its own instead of dying partway through.
async function gmailFetch(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 403 && res.status !== 429) return res;
    const body = await res.text();
    if (!/rateLimitExceeded|RATE_LIMIT_EXCEEDED|quota/i.test(body)) {
      return new Response(body, { status: res.status, headers: res.headers });
    }
    await sleep(65_000);
  }
  return fetch(url, init);
}

export type GmailLabel = { id: string; name: string };

export async function listGmailLabels(accessToken: string): Promise<GmailLabel[]> {
  const res = await gmailFetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail labels list failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.labels || []).map((l: { id: string; name: string }) => ({ id: l.id, name: l.name }));
}

export async function createGmailLabel(accessToken: string, name: string): Promise<string> {
  const res = await gmailFetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, labelListVisibility: "labelShow", messageListVisibility: "show" }),
  });
  if (!res.ok) throw new Error(`Gmail create label failed: ${res.status} ${await res.text()}`);
  return (await res.json()).id as string;
}

export async function deleteGmailLabel(accessToken: string, labelId: string): Promise<void> {
  const res = await gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me/labels/${labelId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Gmail delete label failed: ${res.status} ${await res.text()}`);
}

// `labelIds` is an AND filter (message must carry every id given); `q` is
// normal Gmail search syntax. Paginates to collect every match rather than
// just the first page, since triage needs the full set.
export async function listAllMessageIds(
  accessToken: string,
  params: { q?: string; labelIds?: string[] }
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    url.searchParams.set("maxResults", "500");
    if (params.q) url.searchParams.set("q", params.q);
    for (const id of params.labelIds || []) url.searchParams.append("labelIds", id);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await gmailFetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Gmail message list failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    for (const m of data.messages || []) ids.push(m.id);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return ids;
}

// Gmail caps batchModify at 1000 ids per call.
export async function batchModifyMessages(
  accessToken: string,
  ids: string[],
  addLabelIds: string[],
  removeLabelIds: string[]
): Promise<void> {
  for (let i = 0; i < ids.length; i += 1000) {
    const chunk = ids.slice(i, i + 1000);
    const res = await gmailFetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ids: chunk, addLabelIds, removeLabelIds }),
    });
    if (!res.ok) throw new Error(`Gmail batchModify failed: ${res.status} ${await res.text()}`);
  }
}

// A metadata-only fetch (no body) so scanning thousands of messages for the
// unsubscribe signal stays cheap. List-Unsubscribe is on virtually every
// newsletter/notification and virtually no real personal reply.
export async function getMessageSenderAndUnsubscribe(
  accessToken: string,
  id: string
): Promise<{ id: string; fromEmail: string; hasUnsubscribe: boolean }> {
  const res = await gmailFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=List-Unsubscribe`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return { id, fromEmail: "", hasUnsubscribe: false };
  const data = await res.json();
  const headers: Array<{ name: string; value: string }> = data.payload?.headers || [];
  const header = (n: string) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || "";
  const { fromEmail } = parseFromHeader(header("From"));
  return { id, fromEmail, hasUnsubscribe: !!header("List-Unsubscribe") };
}
