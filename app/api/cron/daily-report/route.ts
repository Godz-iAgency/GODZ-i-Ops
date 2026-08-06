import { NextRequest, NextResponse } from "next/server";
import { getAllLeadsWithEmail, TIERS, Tier } from "@/lib/airtable";
import { sendTelegramMessage } from "@/lib/telegram";

// Runs once a day via Vercel Cron. Reports pipeline counts per tier and
// (once SES is live) the day's outreach send results.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leads = await getAllLeadsWithEmail();
  const tiers = Object.keys(TIERS) as Tier[];

  const lines = tiers.map((tier) => {
    const tierLeads = leads.filter((l) => l.tier === tier);
    const byStage: Record<string, number> = {};
    for (const l of tierLeads) {
      const stage = l.fields.Stage || "Unknown";
      byStage[stage] = (byStage[stage] || 0) + 1;
    }
    const stageSummary = Object.entries(byStage)
      .map(([stage, count]) => `${stage}: ${count}`)
      .join(", ");
    return `*${TIERS[tier].label}* (${tierLeads.length}) — ${stageSummary || "no leads"}`;
  });

  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const text = `📊 *GODZ-i Ops Daily Report* — ${today}\n\n${lines.join("\n")}`;

  await sendTelegramMessage(text);
  return NextResponse.json({ sent: true });
}
