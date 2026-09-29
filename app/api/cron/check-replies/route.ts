import { NextRequest, NextResponse } from "next/server";
import { applyGmailLabel, getRecentInboxMessages, isBounceMessage, extractBouncedAddress, GmailMessage } from "@/lib/gmail";
import {
  getAllBookwormContacts,
  getAllContactsWithEmail,
  getBookwormOutreachTable,
  getOutreachTable,
  wasAlreadyNotified,
  createReply,
  suppressByEmail,
  suppressContact,
} from "@/lib/database";
import { sendTelegramMessage } from "@/lib/telegram";
import { sendReplyEmail } from "@/lib/outreach";
import { triageReply, shouldAutoAcknowledge, acknowledgementText } from "@/lib/replyTriage";

export const maxDuration = 60;

// Runs every few minutes from GitHub Actions (Vercel's free cron is daily-only,
// far too slow for "tell me the moment someone replies"). Three jobs: catch
// bounces, catch replies from people in the outreach list, and triage each one
// so the Replies tab has something useful in it rather than raw mail.

type MatchedContact = {
  id: string;
  brand: "SplitMic" | "Bookworm";
  name: string;
  organization?: string;
  email: string;
};

function alertText(msg: GmailMessage, contact: MatchedContact, intent: string, summary: string, suggested: string, acked: boolean) {
  const icon =
    intent === "Interested" ? "🟢" : intent === "Question" ? "🔵" : intent === "Unsubscribe" ? "🔴" : "⚪";
  return (
    `${icon} *${contact.brand} reply · ${intent}*\n\n` +
    `*${contact.name || msg.fromName}*\n` +
    (contact.organization ? `${contact.organization}\n` : "") +
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

  const [messages, contacts, bookwormContacts] = await Promise.all([
    getRecentInboxMessages(15),
    getAllContactsWithEmail(),
    getAllBookwormContacts(),
  ]);
  const contactByEmail = new Map<string, MatchedContact>();
  for (const contact of contacts) {
    const email = contact.fields.Email?.toLowerCase().trim();
    if (!email) continue;
    contactByEmail.set(email, {
      id: contact.id,
      brand: "SplitMic",
      name: contact.fields["Name / Target"] || "Unnamed contact",
      organization: contact.fields.Organization,
      email,
    });
  }
  for (const contact of bookwormContacts) {
    const email = contact.fields.Email?.toLowerCase().trim();
    if (!email) continue;
    contactByEmail.set(email, {
      id: contact.id,
      brand: "Bookworm",
      name: contact.fields.Name || "Unnamed contact",
      organization: contact.fields.Category,
      email,
    });
  }

  let replies = 0;
  let bounces = 0;

  for (const msg of messages) {
    if (await wasAlreadyNotified(msg.id)) continue;

    // Gmail has no bounce webhook, so a delivery failure shows up as ordinary
    // inbox mail. This is the only chance to catch it.
    if (isBounceMessage(msg)) {
      const bounced = extractBouncedAddress(msg);
      if (bounced) {
        const matched = contactByEmail.get(bounced.toLowerCase());
        const count = matched?.brand === "Bookworm" ? 1 : await suppressByEmail(bounced, "Bounce: delivery failed", true);
        if (matched?.brand === "Bookworm") {
          await getBookwormOutreachTable().update([{ id: matched.id, fields: { "Next Action": "Find a working email address" } as never }], { typecast: true });
        }
        if (count || matched) {
          if (matched) await applyGmailLabel([msg.id], matched.brand);
          bounces++;
          await createReply({
            "Message ID": msg.id,
            "From Email": bounced,
            Subject: msg.subject,
            Body: msg.body.slice(0, 2000),
            "Received At": new Date(Number(msg.internalDate)).toISOString(),
            "Notified At": new Date().toISOString(),
            Status: "Closed",
            Source: matched?.brand || "SplitMic",
            Intent: "Other",
          });
          await sendTelegramMessage(`⚠️ *${matched?.brand || "SplitMic"} bounce*\n\n${bounced} could not be delivered and needs attention.`);
        }
      }
      continue;
    }

    const contact = contactByEmail.get(msg.fromEmail);
    if (!contact) continue;
    await applyGmailLabel([msg.id], contact.brand);

    let intent = "Other";
    let summary = msg.snippet.slice(0, 120);
    let suggested = "";
    try {
      const t = await triageReply({
        fromName: contact.name || msg.fromName,
        organization: contact.organization,
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
      if (contact.brand === "SplitMic") {
        await suppressContact(contact.id, "Replied asking to unsubscribe");
      } else {
        await getBookwormOutreachTable().update(
          [{ id: contact.id, fields: { "Relationship Status": "Not Interested", "Next Action": "Do not contact" } as never }],
          { typecast: true }
        );
      }
    }

    let acked = false;
    if (shouldAutoAcknowledge(intent as never)) {
      try {
        await sendReplyEmail({
          to: msg.fromEmail,
          subject: msg.subject,
          bodyText: acknowledgementText(contact.name || msg.fromName),
          threadId: msg.threadId,
          inReplyTo: msg.rfcMessageId,
          brand: contact.brand,
        });
        acked = true;
      } catch {
        // A failed acknowledgement must not block logging or the alert.
      }
    }

    await createReply({
      "Message ID": msg.id,
      Source: contact.brand,
      "From Email": msg.fromEmail,
      "From Name": msg.fromName,
      "Contact Name": contact.name,
      Organization: contact.organization,
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

    if (contact.brand === "SplitMic") {
      await getOutreachTable().update(
        [{ id: contact.id, fields: { "Email Status": "Replied", "Relationship Status": "Replied" } as never }],
        { typecast: true }
      );
    } else {
      await getBookwormOutreachTable().update(
        [{ id: contact.id, fields: { "Relationship Status": "Replied" } as never }],
        { typecast: true }
      );
    }
    await sendTelegramMessage(alertText(msg, contact, intent, summary, suggested, acked));
    replies++;
  }

  return NextResponse.json({ checked: messages.length, replies, bounces });
}
