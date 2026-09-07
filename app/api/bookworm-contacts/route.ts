import { NextRequest, NextResponse } from "next/server";
import { getAllBookwormContacts, getBookwormOutreachTable, BookwormContactFields } from "@/lib/airtable";

export async function GET() {
  const contacts = await getAllBookwormContacts();
  return NextResponse.json({ contacts });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as BookwormContactFields;
  if (!body.Name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const fields: BookwormContactFields = {
    ...body,
    "Relationship Status": body["Relationship Status"] || "New",
  };

  const created = await getBookwormOutreachTable().create([{ fields: fields as never }], { typecast: true });
  return NextResponse.json({ id: created[0].id, fields: created[0].fields as BookwormContactFields });
}
