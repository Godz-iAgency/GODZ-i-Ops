import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getOutreachTable, ContactFields, OUTREACH_CACHE_TAG } from "@/lib/database";
import { providerErrorResponse } from "@/lib/apiErrors";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as ContactFields;
    const fields: ContactFields = { ...body };

  // Adding an email address is what graduates a row out of research. Do it
  // automatically so the pipeline stage can never silently lie about whether
  // someone is actually contactable.
    const gainedEmail = (fields.Email || "").trim().length > 0;
    const stillResearch = !fields["Relationship Status"] || fields["Relationship Status"] === "Research Needed";
    const notYetEmailed = !fields["Email Status"] || fields["Email Status"] === "Not Contacted";
    if (gainedEmail && stillResearch && notYetEmailed) {
      fields["Relationship Status"] = "Ready for Outreach";
    }

  // The adapter keeps validated pipeline stage values in sync with the sheet.
    const updated = await getOutreachTable().update([{ id, fields: fields as never }], { typecast: true });
    revalidateTag(OUTREACH_CACHE_TAG, { expire: 0 });
    return NextResponse.json({ id: updated[0].id, fields: updated[0].fields as ContactFields });
  } catch (error) {
    return providerErrorResponse(error, "Could not update this SplitMic outreach record.");
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await getOutreachTable().destroy([id]);
    revalidateTag(OUTREACH_CACHE_TAG, { expire: 0 });
    return NextResponse.json({ deleted: id });
  } catch (error) {
    return providerErrorResponse(error, "Could not delete this SplitMic outreach record.");
  }
}
