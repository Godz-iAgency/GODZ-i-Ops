import { NextRequest, NextResponse } from "next/server";
import { TIERS, Tier } from "@/lib/airtable";

// Fetches live dropdown choices straight from Airtable's schema so that
// renaming/adding a Category, Channel, or Stage option in Airtable shows up
// in the UI automatically, with no code change or redeploy needed.
export async function GET(req: NextRequest) {
  const tier = req.nextUrl.searchParams.get("tier") as Tier | null;
  if (!tier || !TIERS[tier]) {
    return NextResponse.json({ error: "Unknown tier" }, { status: 400 });
  }
  const cfg = TIERS[tier];

  const resp = await fetch(
    `https://api.airtable.com/v0/meta/bases/${cfg.baseId}/tables`,
    { headers: { Authorization: `Bearer ${process.env.AIRTABLE_PAT}` }, cache: "no-store" }
  );
  if (!resp.ok) {
    return NextResponse.json({ error: "Failed to fetch schema" }, { status: 502 });
  }
  const data = await resp.json();
  const table = data.tables.find((t: any) => t.id === cfg.tableId);
  if (!table) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  const choicesFor = (fieldName: string): string[] => {
    const field = table.fields.find((f: any) => f.name === fieldName);
    return field?.options?.choices?.map((c: any) => c.name) ?? [];
  };

  return NextResponse.json({
    category: choicesFor("Category"),
    channel: choicesFor("Channel"),
    stage: choicesFor("Stage"),
  });
}
