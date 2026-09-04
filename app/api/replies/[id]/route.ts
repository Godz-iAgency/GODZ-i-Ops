import { NextRequest, NextResponse } from "next/server";
import { updateReply, ReplyFields } from "@/lib/airtable";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as ReplyFields;
  const updated = await updateReply(id, body);
  return NextResponse.json({ reply: updated });
}
