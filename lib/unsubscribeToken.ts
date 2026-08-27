import { createHmac, timingSafeEqual } from "crypto";

// Unsubscribe links travel inside emails to strangers, so the Airtable record
// id alone must never be enough to act on -- otherwise anyone could unsubscribe
// (or enumerate) somebody else's row by editing the URL. Every link carries an
// HMAC of the id that only this server can produce.
function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET;
  if (!s) throw new Error("Missing UNSUBSCRIBE_SECRET");
  return s;
}

export function signContactId(id: string): string {
  return createHmac("sha256", secret()).update(id).digest("hex").slice(0, 32);
}

export function verifyContactToken(id: string, token: string): boolean {
  if (!id || !token) return false;
  const expected = signContactId(id);
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}
