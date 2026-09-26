import { NextRequest, NextResponse } from "next/server";
import { getBookwormTikTokTable, BookwormTikTokFields } from "@/lib/airtable";
import { providerErrorResponse } from "@/lib/apiErrors";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as BookwormTikTokFields;
    const updated = await getBookwormTikTokTable().update([{ id, fields: body as never }], { typecast: true });
    return NextResponse.json({ id: updated[0].id, fields: updated[0].fields as BookwormTikTokFields });
  } catch (error) {
    return providerErrorResponse(error, "Could not update this Bookworm TikTok creator.");
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await getBookwormTikTokTable().destroy([id]);
    return NextResponse.json({ deleted: id });
  } catch (error) {
    return providerErrorResponse(error, "Could not delete this Bookworm TikTok creator.");
  }
}
