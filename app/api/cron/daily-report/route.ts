import { NextRequest, NextResponse } from "next/server";
import { getAllContacts, getProgressForDate, RELATIONSHIP_STAGES } from "@/lib/airtable";
import { sendTelegramMessage } from "@/lib/telegram";
import { austinDateStr } from "@/lib/austinDate";

// Runs each weekday morning via GitHub Actions. Reports where the SplitMic 500
// pipeline stands, plus whether yesterday's daily system was actually logged.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contacts = await getAllContacts();

  const byStage: Record<string, number> = {};
  for (const c of contacts) {
    const stage = c.fields["Relationship Status"] || "New";
    byStage[stage] = (byStage[stage] || 0) + 1;
  }
  const stageLines = RELATIONSHIP_STAGES.filter((s) => byStage[s]).map(
    (s) => `${s}: ${byStage[s]}`
  );

  const emailed = contacts.filter((c) => c.fields["Email Status"] === "Sent").length;
  const linkedin = contacts.filter((c) => c.fields["LinkedIn Status"] !== "Not Contacted").length;
  const remaining = contacts.filter(
    (c) => !c.fields["Email Status"] || c.fields["Email Status"] === "Not Contacted"
  ).length;

  const yesterday = austinDateStr(new Date(Date.now() - 86400000));
  const prior = await getProgressForDate(yesterday);
  const yesterdayLine = prior
    ? `Yesterday: ${prior["Emails Sent"] ?? 0}/10 emails, ${prior["LinkedIn Sent"] ?? 0}/10 LinkedIn`
    : "Yesterday: nothing logged";

  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  });

  const text =
    `📊 *SplitMic Daily Report* — ${today}\n\n` +
    `*Pipeline* (${contacts.length} contacts)\n` +
    `${stageLines.join("\n")}\n\n` +
    `Emailed: ${emailed}\n` +
    `LinkedIn touched: ${linkedin}\n` +
    `Still uncontacted: ${remaining}\n\n` +
    yesterdayLine;

  await sendTelegramMessage(text);
  return NextResponse.json({ sent: true, contacts: contacts.length });
}
