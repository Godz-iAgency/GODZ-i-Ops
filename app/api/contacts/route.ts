import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getAllContacts, getOutreachTable, ContactFields, OUTREACH_CACHE_TAG } from "@/lib/airtable";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("refresh") === "1") {
    revalidateTag(OUTREACH_CACHE_TAG, { expire: 0 });
  }
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
  revalidateTag(OUTREACH_CACHE_TAG, { expire: 0 });
  return NextResponse.json({ id: created[0].id, fields: created[0].fields as ContactFields });
}
