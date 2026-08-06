import { NextRequest, NextResponse } from "next/server";
import { TIERS, Tier } from "@/lib/airtable";
import { runSendOutreach } from "@/lib/outreachJobs";
import { sendTelegramMessage } from "@/lib/telegram";

// Runs once a day via Vercel Cron. Sends to leads in "New" stage with an
// email address, up to EMAIL_DAILY_LIMIT, then moves them to "Contacted".
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { totalSent, totalFailed, sentByTier } = await runSendOutreach();

  const summary = (Object.keys(TIERS) as Tier[])
    .filter((t) => sentByTier[t])
    .map((t) => `${TIERS[t].label}: ${sentByTier[t]}`)
    .join(", ");
  await sendTelegramMessage(
    `📧 *Daily outreach sent*\n\nTotal: ${totalSent}${totalFailed ? ` (${totalFailed} failed)` : ""}\n${summary}`
  );

  return NextResponse.json({ totalSent, totalFailed, sentByTier });
}
