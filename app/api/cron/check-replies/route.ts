import { NextRequest, NextResponse } from "next/server";
import { getRecentInboxMessages, isBounceMessage, extractBouncedAddress, GmailMessage } from "@/lib/gmail";
import {
  getAllContactsWithEmail,
  wasAlreadyNotified,
  createReply,
  suppressByEmail,
  suppressContact,
  Contact,
} from "@/lib/airtable";
import { sendTelegramMessage } from "@/lib/telegram";
import { sendReplyEmail } from "@/lib/outreach";
import { triageReply, shouldAutoAcknowledge, acknowledgementText } from "@/lib/replyTriage";

export const maxDuration = 60;

// Runs every few minutes from GitHub Actions (Vercel's free cron is daily-only,
// far too slow for "tell me the moment someone replies"). Three jobs: catch
// bounces, catch replies from people in the outreach list, and triage each one
// so the Replies tab has something useful in it rather than raw mail.

function alertText(msg: GmailMessage, contact: Contact, intent: string, summary: string, suggested: string, acked: boolean) {
  const f = contact.fields;
  const icon =
    intent === "Interested" ? "🟢" : intent === "Question" ? "🔵" : intent === "Unsubscribe" ? "🔴" : "⚪";
  return (
    `${icon} *Reply · ${intent}*\n\n` +
    `*${f["Name / Target"] || msg.fromName}*\n` +
    (f.Organization ? `${f.Organization}\n` : "") +
    `${msg.fromEmail}\n\n` +
    `_${summary}_\n\n` +
    `Subject: ${msg.subject}\n` +
    `"${msg.body.slice(0, 400)}"\n` +
    (suggested ? `\n*Suggested reply:*\n${suggested}\n` : "") +
    (acked ? `\n_Auto-acknowledged._` : "")
  );
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [messages, contacts] = await Promise.all([getRecentInboxMessages(15), getAllContactsWithEmail()]);
  const contactByEmail = new Map(contacts.map((c) => [c.fields.Email?.toLowerCase(), c]));

  let replies = 0;
  let bounces = 0;

  for (const msg of messages) {
    if (await wasAlreadyNotified(msg.id)) continue;

    // Gmail has no bounce webhook, so a delivery failure shows up as ordinary
    // inbox mail. This is the only chance to catch it.
    if (isBounceMessage(msg)) {
      const bounced = extractBouncedAddress(msg);
      if (bounced) {
        const count = await suppressByEmail(bounced, "Bounce: delivery failed", true);
        if (count) {
          bounces++;
          await createReply({
            "Message ID": msg.id,
            "From Email": bounced,
            Subject: msg.subject,
            Body: msg.body.slice(0, 2000),
            "Received At": new Date(Number(msg.internalDate)).toISOString(),
            "Notified At": new Date().toISOString(),
            Status: "Closed",
            Intent: "Other",
          });
          await sendTelegramMessage(`⚠️ *Bounce*\n\n${bounced} could not be delivered and is now suppressed.`);
        }
      }
      continue;
    }

    const contact = contactByEmail.get(msg.fromEmail);
    if (!contact) continue;

    let intent = "Other";
    let summary = msg.snippet.slice(0, 120);
    let suggested = "";
    try {
      const t = await triageReply({
        fromName: contact.fields["Name / Target"] || msg.fromName,
        organization: contact.fields.Organization,
        subject: msg.subject,
        body: msg.body || msg.snippet,
      });
      intent = t.intent;
      summary = t.summary;
      suggested = t.suggestedReply;
    } catch {
      // Triage is a nicety -- never let it swallow the notification itself.
    }

    // Someone asking to be left alone is honoured immediately, without waiting
    // for anyone to read the Replies tab.
    if (intent === "Unsubscribe") {
      await suppressContact(contact.id, "Replied asking to unsubscribe");
    }

    let acked = false;
    if (shouldAutoAcknowledge(intent as never)) {
      try {
        await sendReplyEmail({
          to: msg.fromEmail,
          subject: msg.subject,
          bodyText: acknowledgementText(contact.fields["Name / Target"] || msg.fromName),
          threadId: msg.threadId,
          inReplyTo: msg.rfcMessageId,
        });
        acked = true;
      } catch {
        // A failed acknowledgement must not block logging or the alert.
      }
    }

    await createReply({
      "Message ID": msg.id,
      "From Email": msg.fromEmail,
      "From Name": msg.fromName,
      "Contact Name": contact.fields["Name / Target"],
      Organization: contact.fields.Organization,
      "Contact Record ID": contact.id,
      Subject: msg.subject,
      Body: msg.body.slice(0, 5000),
      "Thread ID": msg.threadId,
      "RFC Message ID": msg.rfcMessageId,
      "Received At": new Date(Number(msg.internalDate)).toISOString(),
      "Notified At": new Date().toISOString(),
      Status: acked ? "Acknowledged" : "New",
      Intent: intent,
      "Suggested Reply": suggested,
    });

    await sendTelegramMessage(alertText(msg, contact, intent, summary, suggested, acked));
    replies++;
  }

  return NextResponse.json({ checked: messages.length, replies, bounces });
}
