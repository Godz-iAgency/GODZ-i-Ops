import { NextRequest, NextResponse } from "next/server";
import { getReplyById, updateReply } from "@/lib/airtable";
import { sendReplyEmail } from "@/lib/outreach";

// Sends your answer back inside the original conversation rather than starting
// a new thread, so it lands in the same place the person is already reading.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { bodyText } = (await req.json()) as { bodyText?: string };
  const text = (bodyText || "").trim();

  if (!text) {
    return NextResponse.json({ error: "Reply body is required" }, { status: 400 });
  }

  const reply = await getReplyById(id);
  if (!reply) {
    return NextResponse.json({ error: "Reply not found" }, { status: 404 });
  }

  const to = reply.fields["From Email"];
  if (!to) {
    return NextResponse.json({ error: "This reply has no sender address" }, { status: 400 });
  }

  try {
    await sendReplyEmail({
      to,
      subject: reply.fields.Subject || "",
      bodyText: text,
      threadId: reply.fields["Thread ID"] || "",
      inReplyTo: reply.fields["RFC Message ID"] || "",
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Send failed" }, { status: 502 });
  }

  const updated = await updateReply(id, {
    "My Reply": text,
    "Replied At": new Date().toISOString(),
    Status: "Replied",
  });

  return NextResponse.json({ ok: true, reply: updated });
}
