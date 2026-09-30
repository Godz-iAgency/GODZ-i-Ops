import { NextRequest, NextResponse } from "next/server";
import { getEmailCleanupStatus, runEmailCleanup } from "@/lib/emailCleanup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    return NextResponse.json(await getEmailCleanupStatus(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load email cleanup status" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || new URL(origin).host !== req.nextUrl.host) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.confirm !== "MOVE_REVIEWED_EMAIL_TO_TRASH") {
    return NextResponse.json({ error: "Cleanup confirmation is required" }, { status: 400 });
  }

  try {
    return NextResponse.json(await runEmailCleanup("Manual"), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Email cleanup failed" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
