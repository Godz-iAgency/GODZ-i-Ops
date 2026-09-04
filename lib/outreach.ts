import { sendGmailMessage } from "./gmail";
import { signContactId } from "./unsubscribeToken";

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

function buildMime(headers: string[], body: string): string {
  const encoded = Buffer.from(body, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n");
  return `${headers.join("\r\n")}\r\n\r\n${encoded}`;
}

function fromHeader(): string {
  const email = required("MAIL_FROM_EMAIL");
  const name = process.env.MAIL_FROM_NAME || "";
  return name ? `${encodeHeader(name)} <${headerSafe(email)}>` : headerSafe(email);
}

export type OutreachEmail = {
  contactId: string;
  to: string;
  subject: string;
  bodyText: string;
};

// Cold outreach carries obligations that have to be satisfied on every single
// send: a working unsubscribe mechanism and a real postal address (CAN-SPAM),
// plus the one-click headers Gmail and Outlook expect from bulk senders
// (RFC 8058). The MIME is built by hand because those headers are the point.
export async function sendOutreachEmail({ contactId, to, subject, bodyText }: OutreachEmail): Promise<string> {
  const fromEmail = required("MAIL_FROM_EMAIL");
  const fromName = process.env.MAIL_FROM_NAME || "";
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

  const raw = buildMime(
    [
      `From: ${fromHeader()}`,
      `To: ${headerSafe(to)}`,
      `Subject: ${encodeHeader(subject)}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      `List-Unsubscribe: <${unsubUrl}>, <mailto:${headerSafe(fromEmail)}?subject=unsubscribe>`,
      `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
    ],
    body
  );

  const sent = await sendGmailMessage({ to, subject, rawMime: raw });
  return sent.id;
}

export type ReplyEmail = {
  to: string;
  subject: string;
  bodyText: string;
  threadId: string;
  inReplyTo: string;
};

// A reply to someone who wrote to you first is ordinary correspondence, so it
// carries no unsubscribe furniture -- just the threading headers that keep it
// in the same conversation rather than starting a new one.
export async function sendReplyEmail({ to, subject, bodyText, threadId, inReplyTo }: ReplyEmail): Promise<string> {
  const headers = [
    `From: ${fromHeader()}`,
    `To: ${headerSafe(to)}`,
    `Subject: ${encodeHeader(subject.startsWith("Re:") ? subject : `Re: ${subject}`)}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
  ];
  if (inReplyTo) {
    headers.push(`In-Reply-To: ${headerSafe(inReplyTo)}`, `References: ${headerSafe(inReplyTo)}`);
  }

  const sent = await sendGmailMessage({
    to,
    subject,
    rawMime: buildMime(headers, `${bodyText.trimEnd()}\n`),
    threadId,
  });
  return sent.id;
}
