import { NextRequest, NextResponse } from "next/server";

// Temporary diagnostic endpoint. Never returns real secret values -- only
// length and whitespace/quote checks, so it's safe to hit while debugging a
// prod-only env var mismatch. Delete once the issue is found.
function inspect(name: string) {
  const raw = process.env[name];
  if (raw === undefined) return { set: false };
  return {
    set: true,
    length: raw.length,
    first2: raw.slice(0, 2),
    last2: raw.slice(-2),
    hasLeadingSpace: raw !== raw.trimStart(),
    hasTrailingSpace: raw !== raw.trimEnd(),
    hasQuotes: raw.startsWith('"') || raw.endsWith('"') || raw.startsWith("'") || raw.endsWith("'"),
    hasNewline: raw.includes("\n") || raw.includes("\r"),
  };
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    TELEGRAM_BOT_TOKEN: inspect("TELEGRAM_BOT_TOKEN"),
    TELEGRAM_CHAT_ID: inspect("TELEGRAM_CHAT_ID"),
    TELEGRAM_WEBHOOK_SECRET: inspect("TELEGRAM_WEBHOOK_SECRET"),
    GEMINI_API_KEY: inspect("GEMINI_API_KEY"),
  });
}
