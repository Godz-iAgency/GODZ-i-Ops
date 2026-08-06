import { NextRequest, NextResponse } from "next/server";
import { getTable, TIERS, Tier, LeadFields } from "@/lib/airtable";
import { sendEmail } from "@/lib/ses";
import { sendTelegramMessage } from "@/lib/telegram";
import { austinDateStr } from "@/lib/austinDate";

const DAILY_LIMIT = parseInt(process.env.EMAIL_DAILY_LIMIT || "20", 10);

// Starter template -- review and rewrite the copy before this goes live.
function buildEmail(lead: LeadFields, tierLabel: string): { subject: string; body: string } {
  const name = lead.Name || "there";
  return {
    subject: `Quick note from GODZ-i`,
    body:
      `Hi ${name},\n\n` +
      `I'm Christopher with GODZ-i, reaching out about ${tierLabel}. ` +
      `I'd love to connect and see if there's a fit.\n\n` +
      `Worth a quick call this week?\n\n` +
      `Best,\nChristopher\nGODZ-i`,
  };
}

// Runs once a day via Vercel Cron. Sends to leads in "New" stage with an
// email address, up to EMAIL_DAILY_LIMIT, then moves them to "Contacted".
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tiers = Object.keys(TIERS) as Tier[];
  const sentByTier: Record<string, number> = {};
  let totalSent = 0;
  let totalFailed = 0;

  for (const tier of tiers) {
    if (totalSent + totalFailed >= DAILY_LIMIT) break;
    const table = getTable(tier);
    const records = await table
      .select({ filterByFormula: "AND({Stage} = 'New', NOT({Email} = ''))", pageSize: 100 })
      .all();

    for (const record of records) {
      if (totalSent + totalFailed >= DAILY_LIMIT) break;
      const fields = record.fields as LeadFields;
      const { subject, body } = buildEmail(fields, TIERS[tier].label);
      try {
        await sendEmail(fields.Email as string, subject, body);
        await table.update([
          { id: record.id, fields: { Stage: "Contacted", "Last Contact": austinDateStr() } as any },
        ]);
        sentByTier[tier] = (sentByTier[tier] || 0) + 1;
        totalSent++;
      } catch (e: any) {
        totalFailed++;
      }
    }
  }

  const summary = tiers
    .filter((t) => sentByTier[t])
    .map((t) => `${TIERS[t].label}: ${sentByTier[t]}`)
    .join(", ");
  await sendTelegramMessage(
    `📧 *Daily outreach sent*\n\nTotal: ${totalSent}${totalFailed ? ` (${totalFailed} failed)` : ""}\n${summary}`
  );

  return NextResponse.json({ totalSent, totalFailed, sentByTier });
}
