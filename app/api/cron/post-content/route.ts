import { NextRequest, NextResponse } from "next/server";
import { runPostContent } from "@/lib/outreachJobs";
import { sendTelegramMessage } from "@/lib/telegram";

// Posts any "New" row in the Content Queue Airtable table to every connected
// Buffer channel, then marks it Posted.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { posted, failed, channelCount } = await runPostContent();

  if (posted || failed) {
    await sendTelegramMessage(
      `📱 *Content posted to Buffer*\n\nPosted: ${posted}${failed ? ` (${failed} failed)` : ""}\nChannels: ${channelCount}`
    );
  }

  return NextResponse.json({ posted, failed, channels: channelCount });
}
