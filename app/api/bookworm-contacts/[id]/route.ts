import { NextRequest, NextResponse } from "next/server";
import { getBookwormOutreachTable, BookwormContactFields } from "@/lib/airtable";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as BookwormContactFields;

  const updated = await getBookwormOutreachTable().update([{ id, fields: body as never }], { typecast: true });
  return NextResponse.json({ id: updated[0].id, fields: updated[0].fields as BookwormContactFields });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getBookwormOutreachTable().destroy([id]);
  return NextResponse.json({ deleted: id });
}
