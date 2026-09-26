import { NextRequest, NextResponse } from "next/server";
import { getBookwormOutreachTable, BookwormContactFields } from "@/lib/airtable";
import { providerErrorResponse } from "@/lib/apiErrors";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as BookwormContactFields;

    const updated = await getBookwormOutreachTable().update([{ id, fields: body as never }], { typecast: true });
    return NextResponse.json({ id: updated[0].id, fields: updated[0].fields as BookwormContactFields });
  } catch (error) {
    return providerErrorResponse(error, "Could not update this Bookworm email record.");
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await getBookwormOutreachTable().destroy([id]);
    return NextResponse.json({ deleted: id });
  } catch (error) {
    return providerErrorResponse(error, "Could not delete this Bookworm email record.");
  }
}
