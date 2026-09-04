import { NextRequest, NextResponse } from "next/server";
import { austinDateStr } from "@/lib/austinDate";
import { sendOutreachEmail } from "@/lib/ses";
import { getContactById, countEmailsSentOn, getOutreachTable } from "@/lib/airtable";

// The only route in the app that sends real mail to a real stranger. Every
// guard here exists because getting one of them wrong is not a bug you can
// take back once the message has left.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { subject?: string; bodyText?: string };
  const subject = (body.subject || "").trim();
  const bodyText = (body.bodyText || "").trim();

  if (!subject || !bodyText) {
    return NextResponse.json({ error: "Subject and body are both required" }, { status: 400 });
  }

  const contact = await getContactById(id);
  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const f = contact.fields;
  const to = (f.Email || "").trim();
  if (!to) {
    return NextResponse.json({ error: "This contact has no email address" }, { status: 400 });
  }

  // The suppression list is absolute and is checked at the moment of sending,
  // not when the list was loaded -- someone may have unsubscribed in between.
  if (f["Do Not Contact"]) {
    return NextResponse.json(
      { error: `${to} is suppressed (${f["Suppression Reason"] || "do not contact"})` },
      { status: 409 }
    );
  }
  if (f["Email Status"] === "Bounced") {
    return NextResponse.json({ error: `${to} previously bounced` }, { status: 409 });
  }

  // Enforced on the server so the cap survives a stale tab or a direct call.
  const today = austinDateStr();
  const limit = parseInt(process.env.EMAIL_DAILY_LIMIT || "20", 10);
  const alreadySent = await countEmailsSentOn(today);
  if (alreadySent >= limit) {
    return NextResponse.json(
      { error: `Daily limit reached (${alreadySent}/${limit}). Nothing sent.` },
      { status: 429 }
    );
  }

  let messageId: string;
  try {
    messageId = await sendOutreachEmail({ contactId: id, to, subject, bodyText });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Send failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Only recorded once SES has actually accepted the message, so the pipeline
  // can never claim someone was contacted when they were not.
  const updated = await getOutreachTable().update(
    [
      {
        id,
        fields: {
          "Email Status": "Sent",
          "Email Last Contacted": today,
          "Relationship Status": "Contacted",
        } as never,
      },
    ],
    { typecast: true }
  );

  return NextResponse.json({
    ok: true,
    messageId,
    sentToday: alreadySent + 1,
    limit,
    fields: updated[0].fields,
  });
}
