import { NextRequest, NextResponse } from "next/server";
import { getTable, TIERS, Tier, LeadFields } from "@/lib/airtable";
import { austinDateStr } from "@/lib/austinDate";

export async function GET(req: NextRequest) {
  const tier = req.nextUrl.searchParams.get("tier") as Tier | null;
  if (!tier || !TIERS[tier]) {
    return NextResponse.json({ error: "Unknown tier" }, { status: 400 });
  }
  const table = getTable(tier);
  const records = await table.select({ pageSize: 100 }).all();
  const leads = records.map((r) => ({ id: r.id, fields: r.fields as LeadFields }));
  return NextResponse.json({ leads });
}

export async function POST(req: NextRequest) {
  const tier = req.nextUrl.searchParams.get("tier") as Tier | null;
  if (!tier || !TIERS[tier]) {
    return NextResponse.json({ error: "Unknown tier" }, { status: 400 });
  }
  const body = (await req.json()) as LeadFields;
  if (!body.Name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const table = getTable(tier);
  const fields: LeadFields = {
    ...body,
    Stage: body.Stage || "New",
    "Last Contact": body["Last Contact"] || austinDateStr(),
  };
  const created = await table.create([{ fields: fields as any }]);
  const record = created[0];
  return NextResponse.json({ id: record.id, fields: record.fields as LeadFields });
}
