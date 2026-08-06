import { NextRequest, NextResponse } from "next/server";
import { getContentQueueTable } from "@/lib/airtable";
import { getChannels, createTextPost } from "@/lib/buffer";
import { sendTelegramMessage } from "@/lib/telegram";

// Runs on demand (or scheduled). Posts any "New" row in the Content Queue
// Airtable table to every connected Buffer channel, then marks it Posted.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const table = getContentQueueTable();
  const records = await table.select({ filterByFormula: "{Status} = 'New'", pageSize: 20 }).all();

  if (records.length === 0) {
    return NextResponse.json({ posted: 0, message: "Nothing queued" });
  }

  const channels = await getChannels();
  let posted = 0;
  let failed = 0;

  for (const record of records) {
    const content = (record.fields.Content as string) || "";
    if (!content.trim()) continue;

    const results = await Promise.allSettled(channels.map((ch) => createTextPost(ch.id, content)));
    const failures = results.filter((r) => r.status === "rejected");

    if (failures.length === 0) {
      await table.update([
        { id: record.id, fields: { Status: "Posted", "Posted At": new Date().toISOString() } as any },
      ]);
      posted++;
    } else {
      const reasons = failures.map((f: any) => f.reason?.message || "unknown error").join("; ");
      await table.update([{ id: record.id, fields: { Status: "Failed", Notes: reasons } as any }]);
      failed++;
    }
  }

  await sendTelegramMessage(
    `📱 *Content posted to Buffer*\n\nPosted: ${posted}${failed ? ` (${failed} failed)` : ""}\nChannels: ${channels
      .map((c) => c.displayName)
      .join(", ")}`
  );

  return NextResponse.json({ posted, failed, channels: channels.length });
}
