import { NextRequest, NextResponse } from "next/server";
import { getRecentInboxMessages } from "@/lib/gmail";
import { getAllContactsWithEmail, wasAlreadyNotified, markNotified } from "@/lib/airtable";
import { sendTelegramMessage } from "@/lib/telegram";

// Called every few minutes by GitHub Actions (Vercel Hobby cron only supports
// daily jobs, too slow for "notify me within 5 minutes" of a reply). Checks the
// last 15 minutes of inbox mail against known SplitMic contact emails.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [messages, contacts] = await Promise.all([
    getRecentInboxMessages(15),
    getAllContactsWithEmail(),
  ]);

  const contactByEmail = new Map(contacts.map((c) => [c.fields.Email?.toLowerCase(), c]));

  let notified = 0;
  for (const msg of messages) {
    const contact = contactByEmail.get(msg.fromEmail);
    if (!contact) continue;
    if (await wasAlreadyNotified(msg.id)) continue;

    const f = contact.fields;
    const text =
      `🔔 *SplitMic reply*\n\n` +
      `*${f["Name / Target"] || msg.fromName}*\n` +
      (f.Organization ? `${f.Organization}\n` : "") +
      (f.Role ? `${f.Role}\n` : "") +
      `Email: ${msg.fromEmail}\n` +
      (f["LinkedIn URL"] ? `LinkedIn: ${f["LinkedIn URL"]}\n` : "") +
      `\nSubject: ${msg.subject}\n` +
      `"${msg.snippet}"`;

    await sendTelegramMessage(text);
    await markNotified(msg.id, msg.fromEmail);
    notified++;
  }

  return NextResponse.json({ checked: messages.length, contacts: contacts.length, notified });
}
