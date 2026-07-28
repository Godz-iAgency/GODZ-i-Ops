import { NextRequest, NextResponse } from "next/server";
import { getTable, TIERS, Tier, LeadFields } from "@/lib/airtable";
import { austinDateStr } from "@/lib/austinDate";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tier = req.nextUrl.searchParams.get("tier") as Tier | null;
  if (!tier || !TIERS[tier]) {
    return NextResponse.json({ error: "Unknown tier" }, { status: 400 });
  }
  const body = (await req.json()) as LeadFields;

  // Moving a lead to a new stage counts as a touch, so bump Last Contact
  // automatically unless the caller explicitly set it.
  const fields: LeadFields = { ...body };
  if (fields.Stage && !fields["Last Contact"]) {
    fields["Last Contact"] = austinDateStr();
  }

  const table = getTable(tier);
  const updated = await table.update([{ id, fields: fields as any }]);
  const record = updated[0];
  return NextResponse.json({ id: record.id, fields: record.fields as LeadFields });
}
