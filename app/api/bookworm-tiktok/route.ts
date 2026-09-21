import { NextRequest, NextResponse } from "next/server";
import { getAllBookwormTikTokCreators, getBookwormTikTokTable, BookwormTikTokFields } from "@/lib/airtable";

export async function GET() {
  const creators = await getAllBookwormTikTokCreators();
  return NextResponse.json({ creators });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as BookwormTikTokFields;
  if (!body.Name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const fields: BookwormTikTokFields = { ...body, Status: body.Status || "DM Sent" };
  const created = await getBookwormTikTokTable().create([{ fields: fields as never }], { typecast: true });
  return NextResponse.json({ id: created[0].id, fields: created[0].fields as BookwormTikTokFields });
}
