import { NextRequest, NextResponse } from "next/server";
import { runInboxTriage } from "@/lib/inboxTriage";

// The backlog scope scans every unlabeled inbox message once, which can take
// a while; the daily "recent" scope only looks at the last couple days.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = req.nextUrl.searchParams.get("scope") === "backlog" ? "backlog" : "recent";

  try {
    const result = await runInboxTriage(scope);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Inbox triage failed" }, { status: 502 });
  }
}
