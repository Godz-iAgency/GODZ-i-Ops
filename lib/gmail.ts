const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

async function getAccessToken(): Promise<string> {
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

export async function getRecentInboxMessages(minutesBack: number): Promise<GmailMessage[]> {
  const accessToken = await getAccessToken();
  const afterSeconds = Math.floor(Date.now() / 1000) - minutesBack * 60;
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
      `in:inbox after:${afterSeconds}`
    )}&maxResults=25`,
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
