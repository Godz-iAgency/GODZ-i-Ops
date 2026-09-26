import { NextRequest, NextResponse } from "next/server";
import { getAllBookwormContacts, getBookwormOutreachTable, BookwormContactFields } from "@/lib/database";
import { providerErrorResponse } from "@/lib/apiErrors";

export async function GET() {
  try {
    const contacts = await getAllBookwormContacts();
    return NextResponse.json({ contacts });
  } catch (error) {
    return providerErrorResponse(error, "Could not load Bookworm email records.");
  }
}

export async function POST(req: NextRequest) {
  try {
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
  } catch (error) {
    return providerErrorResponse(error, "Could not save this Bookworm email record.");
  }
}
