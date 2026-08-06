import { NextRequest, NextResponse } from "next/server";
import { getRecentInboxMessages } from "@/lib/gmail";
import { getAllLeadsWithEmail, wasAlreadyNotified, markNotified, TIERS } from "@/lib/airtable";
import { sendTelegramMessage } from "@/lib/telegram";

// Called every few minutes by an external scheduler (GitHub Actions --
// Vercel Hobby cron only supports daily jobs, too slow for "notify me
// within 5 minutes" of a reply). Checks the last 15 minutes of inbox mail
// against known lead emails across all 5 Airtable tables.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [messages, leads] = await Promise.all([getRecentInboxMessages(15), getAllLeadsWithEmail()]);

  const leadByEmail = new Map(leads.map((l) => [l.fields.Email?.toLowerCase(), l]));

  let notified = 0;
  for (const msg of messages) {
    const lead = leadByEmail.get(msg.fromEmail);
    if (!lead) continue;
    if (await wasAlreadyNotified(msg.id)) continue;

    const tierLabel = TIERS[lead.tier].label;
    const text =
      `🔔 *Reply from ${tierLabel}*\n\n` +
      `*${lead.fields.Name || msg.fromName}*\n` +
      `Email: ${msg.fromEmail}\n` +
      (lead.fields.Phone ? `Phone: ${lead.fields.Phone}\n` : "") +
      `\nSubject: ${msg.subject}\n` +
      `"${msg.snippet}"`;

    await sendTelegramMessage(text);
    await markNotified(msg.id, msg.fromEmail);
    notified++;
  }

  return NextResponse.json({ checked: messages.length, leads: leads.length, notified });
}
