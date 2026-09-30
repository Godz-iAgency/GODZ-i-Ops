import { NextRequest, NextResponse } from "next/server";
import { runEmailCleanup } from "@/lib/emailCleanup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await runEmailCleanup("Scheduled"), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scheduled email cleanup failed" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
