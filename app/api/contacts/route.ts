import { NextRequest, NextResponse } from "next/server";
import { getAllContacts, getOutreachTable, ContactFields } from "@/lib/airtable";

export async function GET() {
  const contacts = await getAllContacts();
  return NextResponse.json({ contacts });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ContactFields;
  if (!body["Name / Target"]?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const hasEmail = (body.Email || "").trim().length > 0;
  const fields: ContactFields = {
    ...body,
    "Relationship Status":
      body["Relationship Status"] || (hasEmail ? "Ready for Outreach" : "Research Needed"),
    "Email Status": body["Email Status"] || "Not Contacted",
  };

  const created = await getOutreachTable().create([{ fields: fields as never }], { typecast: true });
  return NextResponse.json({ id: created[0].id, fields: created[0].fields as ContactFields });
}
