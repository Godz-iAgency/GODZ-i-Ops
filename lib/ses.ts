import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
import { signContactId } from "./unsubscribeToken";

const client = new SESClient({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
});

// Headers are newline-delimited, so any CR/LF that reaches one lets a caller
// inject extra headers (a second Bcc, a forged From). Everything interpolated
// into a header goes through here first.
function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

// RFC 2047: non-ASCII is only legal in a header when encoded.
function encodeHeader(value: string): string {
  const clean = headerSafe(value);
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7E]*$/.test(clean)
    ? clean
    : `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

export type OutreachEmail = {
  contactId: string;
  to: string;
  subject: string;
  bodyText: string;
};

// Cold outreach carries legal obligations the app has to satisfy on every
// single send, not as an afterthought: a working unsubscribe mechanism and a
// real postal address (CAN-SPAM), plus the one-click headers Gmail and Outlook
// now expect from bulk senders (RFC 8058). Building the MIME by hand is what
// makes those headers possible -- the simple SendEmail API cannot set them.
export async function sendOutreachEmail({ contactId, to, subject, bodyText }: OutreachEmail): Promise<string> {
  const fromEmail = required("SES_FROM_EMAIL");
  const fromName = process.env.SES_FROM_NAME || "";
  const appUrl = required("APP_URL").replace(/\/+$/, "");
  const postalAddress = required("MAILING_ADDRESS");

  const token = signContactId(contactId);
  const unsubUrl = `${appUrl}/api/unsubscribe?c=${encodeURIComponent(contactId)}&t=${token}`;

  const body =
    `${bodyText.trimEnd()}\n\n` +
    `--\n` +
    `${fromName || fromEmail}\n` +
    `${postalAddress}\n\n` +
    `Don't want to hear from me again? Unsubscribe here and I won't email you again:\n` +
    `${unsubUrl}\n`;

  const from = fromName ? `${encodeHeader(fromName)} <${headerSafe(fromEmail)}>` : headerSafe(fromEmail);

  const headers = [
    `From: ${from}`,
    `To: ${headerSafe(to)}`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    `List-Unsubscribe: <${unsubUrl}>, <mailto:${headerSafe(fromEmail)}?subject=unsubscribe>`,
    `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
  ].join("\r\n");

  // base64 sidesteps line-length limits and SMTP dot-stuffing entirely.
  const encoded = Buffer.from(body, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n");
  const raw = `${headers}\r\n\r\n${encoded}`;

  const res = await client.send(new SendRawEmailCommand({ RawMessage: { Data: Buffer.from(raw, "utf8") } }));
  return res.MessageId || "";
}
