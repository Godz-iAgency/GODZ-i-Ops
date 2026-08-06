import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/appAuth";
import { getPendingOutreachCounts, getContentQueue, TIERS, Tier } from "@/lib/airtable";

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [pending, queue] = await Promise.all([getPendingOutreachCounts(), getContentQueue()]);

  const tiers = Object.keys(TIERS) as Tier[];
  const pendingTotal = tiers.reduce((sum, t) => sum + (pending[t] || 0), 0);

  return NextResponse.json({
    pendingByTier: tiers.map((t) => ({ tier: t, label: TIERS[t].label, count: pending[t] || 0 })),
    pendingTotal,
    dailyLimit: parseInt(process.env.EMAIL_DAILY_LIMIT || "20", 10),
    queue,
  });
}
