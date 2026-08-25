import { NextRequest, NextResponse } from "next/server";
import {
  getAllLinkedInProspects,
  getLinkedInTable,
  countLinkedInContactedOn,
  LinkedInFields,
} from "@/lib/airtable";

// ?countFor=YYYY-MM-DD returns just today's tally for the Today page counter.
export async function GET(req: NextRequest) {
  const countFor = req.nextUrl.searchParams.get("countFor");
  if (countFor) {
    const count = await countLinkedInContactedOn(countFor);
    return NextResponse.json({ count });
  }
  const prospects = await getAllLinkedInProspects();
  return NextResponse.json({ prospects });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as LinkedInFields;
  if (!body.Name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const fields: LinkedInFields = { ...body, Status: body.Status || "Contacted" };
  const created = await getLinkedInTable().create([{ fields: fields as never }], { typecast: true });
  return NextResponse.json({ id: created[0].id, fields: created[0].fields as LinkedInFields });
}
