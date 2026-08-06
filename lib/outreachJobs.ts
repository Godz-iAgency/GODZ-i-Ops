import { getTable, TIERS, Tier, LeadFields, getContentQueueTable } from "@/lib/airtable";
import { sendEmail } from "@/lib/ses";
import { getChannels, createTextPost } from "@/lib/buffer";
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

export async function runSendOutreach() {
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
      } catch {
        totalFailed++;
      }
    }
  }
  return { totalSent, totalFailed, sentByTier };
}

export async function runPostContent() {
  const table = getContentQueueTable();
  const records = await table.select({ filterByFormula: "{Status} = 'New'", pageSize: 20 }).all();
  if (records.length === 0) return { posted: 0, failed: 0, channelCount: 0 };

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
  return { posted, failed, channelCount: channels.length };
}
