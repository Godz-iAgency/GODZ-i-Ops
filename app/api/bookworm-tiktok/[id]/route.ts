import { NextRequest, NextResponse } from "next/server";
import { getBookwormTikTokTable, BookwormTikTokFields } from "@/lib/airtable";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as BookwormTikTokFields;
  const updated = await getBookwormTikTokTable().update([{ id, fields: body as never }], { typecast: true });
  return NextResponse.json({ id: updated[0].id, fields: updated[0].fields as BookwormTikTokFields });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getBookwormTikTokTable().destroy([id]);
  return NextResponse.json({ deleted: id });
}
