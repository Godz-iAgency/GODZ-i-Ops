import { NextRequest, NextResponse } from "next/server";
import { getAllBookwormTikTokCreators, getBookwormTikTokTable, BookwormTikTokFields } from "@/lib/airtable";

export async function GET() {
  const creators = await getAllBookwormTikTokCreators();
  return NextResponse.json({ creators });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as BookwormTikTokFields;
  const name = body.Name?.trim() || body["Display Name"]?.trim() || body["TikTok Handle"]?.trim();
  if (!name) {
    return NextResponse.json({ error: "Name or TikTok handle is required" }, { status: 400 });
  }
  const key = (body["TikTok User ID"] || body["TikTok Handle"] || "").trim().replace(/^@/, "").toLowerCase();
  if (key) {
    const existing = await getAllBookwormTikTokCreators();
    const duplicate = existing.find((creator) =>
      [creator.fields["TikTok User ID"], creator.fields["TikTok Handle"]]
        .filter(Boolean)
        .map((value) => String(value).trim().replace(/^@/, "").toLowerCase())
        .includes(key)
    );
    if (duplicate) {
      return NextResponse.json({ error: "This TikTok creator is already saved", id: duplicate.id }, { status: 409 });
    }
  }
  const fields: BookwormTikTokFields = { ...body, Name: body.Name || name, Status: body.Status || "New" };
  const created = await getBookwormTikTokTable().create([{ fields: fields as never }], { typecast: true });
  return NextResponse.json({ id: created[0].id, fields: created[0].fields as BookwormTikTokFields });
}
