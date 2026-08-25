import { NextRequest, NextResponse } from "next/server";
import { getOutreachTable, ContactFields } from "@/lib/airtable";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  // typecast lets Airtable mint a select choice that does not exist yet. Its
  // Meta API refuses to add choices to an existing select field, so this is the
  // only way the pipeline stages stay in sync with the code.
  const updated = await getOutreachTable().update([{ id, fields: fields as never }], { typecast: true });
  return NextResponse.json({ id: updated[0].id, fields: updated[0].fields as ContactFields });
}
