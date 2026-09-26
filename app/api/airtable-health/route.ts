import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_MUSIC;
  if (!token || !baseId) {
    return NextResponse.json(
      { ok: false, configured: { token: !!token, base: !!baseId } },
      { status: 500 }
    );
  }

  const started = Date.now();
  try {
    const response = await fetch(
      `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/tblryUfFc1oBsKtDa?maxRecords=1`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      }
    );
    const payload = (await response.json().catch(() => ({}))) as {
      records?: unknown[];
      error?: { type?: string; message?: string };
    };
    return NextResponse.json(
      {
        ok: response.ok,
        upstreamStatus: response.status,
        elapsedMs: Date.now() - started,
        recordCount: payload.records?.length ?? 0,
        errorType: payload.error?.type,
      },
      { status: response.ok ? 200 : 502 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        elapsedMs: Date.now() - started,
        errorType: error instanceof Error ? error.name : "UnknownError",
      },
      { status: 504 }
    );
  }
}
