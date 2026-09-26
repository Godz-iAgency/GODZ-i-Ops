import { NextRequest, NextResponse } from "next/server";
import { getLinkedInTable, LinkedInFields } from "@/lib/database";
import { providerErrorResponse } from "@/lib/apiErrors";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as LinkedInFields;
    const updated = await getLinkedInTable().update([{ id, fields: body as never }], { typecast: true });
    return NextResponse.json({ id: updated[0].id, fields: updated[0].fields as LinkedInFields });
  } catch (error) {
    return providerErrorResponse(error, "Could not update this LinkedIn prospect.");
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await getLinkedInTable().destroy([id]);
    return NextResponse.json({ deleted: id });
  } catch (error) {
    return providerErrorResponse(error, "Could not delete this LinkedIn prospect.");
  }
}
