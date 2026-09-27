import { NextRequest, NextResponse } from "next/server";
import { runBookwormTikTokResearch } from "@/lib/bookwormTikTokResearch";

export const runtime = "nodejs";
export const maxDuration = 300;

function allowedOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  if (process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  const appUrl = process.env.APP_URL;
  if (!appUrl) return true;
  try {
    return new URL(origin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!allowedOrigin(req) || req.headers.get("x-godzi-research") !== "confirmed") {
    return NextResponse.json({ error: "Research request was not confirmed from the Command Center." }, { status: 403 });
  }

  try {
    const result = await runBookwormTikTokResearch();
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const unauthorized = /401|token|unauthorized/i.test(detail);
    return NextResponse.json(
      {
        error: unauthorized
          ? "Apify rejected the configured token. Confirm APIFY_API_TOKEN in Vercel."
          : "TikTok research could not finish. No creator was added unless the response says otherwise.",
        detail: detail.slice(0, 400),
        retryable: true,
      },
      { status: unauthorized ? 503 : 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
