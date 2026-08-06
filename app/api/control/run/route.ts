import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/appAuth";
import { runSendOutreach, runPostContent } from "@/lib/outreachJobs";
import { sendTelegramMessage } from "@/lib/telegram";
import { TIERS, Tier } from "@/lib/airtable";

// Manually triggers the same jobs the cron schedule runs, from the Control tab.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { job } = await req.json();

  if (job === "send-outreach") {
    const { totalSent, totalFailed, sentByTier } = await runSendOutreach();
    const summary = (Object.keys(TIERS) as Tier[])
      .filter((t) => sentByTier[t])
      .map((t) => `${TIERS[t].label}: ${sentByTier[t]}`)
      .join(", ");
    await sendTelegramMessage(
      `📧 *Outreach sent* (manual)\n\nTotal: ${totalSent}${totalFailed ? ` (${totalFailed} failed)` : ""}\n${summary}`
    );
    return NextResponse.json({
      job,
      totalSent,
      totalFailed,
      message: `Sent ${totalSent}${totalFailed ? `, ${totalFailed} failed` : ""}`,
    });
  }

  if (job === "post-content") {
    const { posted, failed, channelCount } = await runPostContent();
    if (posted || failed) {
      await sendTelegramMessage(
        `📱 *Content posted* (manual)\n\nPosted: ${posted}${failed ? ` (${failed} failed)` : ""}\nChannels: ${channelCount}`
      );
    }
    return NextResponse.json({
      job,
      posted,
      failed,
      message:
        posted || failed
          ? `Posted ${posted} to ${channelCount} channels${failed ? `, ${failed} failed` : ""}`
          : "Nothing queued to post",
    });
  }

  return NextResponse.json({ error: "Unknown job" }, { status: 400 });
}
