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

type GmailMessage = {
  id: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  snippet: string;
  internalDate: string;
};

function parseFromHeader(from: string): { fromEmail: string; fromName: string } {
  const match = from.match(/^(.*?)\s*<(.+)>$/);
  if (match) return { fromName: match[1].replace(/"/g, "").trim(), fromEmail: match[2].toLowerCase() };
  return { fromName: from, fromEmail: from.toLowerCase() };
}

// Returns inbox messages received in the last `minutesBack` minutes.
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
  const ids: string[] = (listData.messages || []).map((m: any) => m.id);

  const messages = await Promise.all(
    ids.map(async (id) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!msgRes.ok) return null;
      const msg = await msgRes.json();
      const headers: Array<{ name: string; value: string }> = msg.payload?.headers || [];
      const fromHeader = headers.find((h) => h.name === "From")?.value || "";
      const subjectHeader = headers.find((h) => h.name === "Subject")?.value || "(no subject)";
      const { fromEmail, fromName } = parseFromHeader(fromHeader);
      return {
        id: msg.id,
        fromEmail,
        fromName,
        subject: subjectHeader,
        snippet: msg.snippet || "",
        internalDate: msg.internalDate,
      } as GmailMessage;
    })
  );
  return messages.filter((m): m is GmailMessage => m !== null);
}
