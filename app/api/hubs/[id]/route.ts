import { NextRequest, NextResponse } from "next/server";
import { getHubsTable, HubFields } from "@/lib/airtable";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as HubFields;
  const updated = await getHubsTable().update([{ id, fields: body as never }], { typecast: true });
  return NextResponse.json({ id: updated[0].id, fields: updated[0].fields as HubFields });
}
