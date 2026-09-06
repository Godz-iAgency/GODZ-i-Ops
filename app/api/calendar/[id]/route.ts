import { NextRequest, NextResponse } from "next/server";
import { updateEvent, deleteEvent, NewEvent } from "@/lib/googleCalendar";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as NewEvent;
  if (!body.title?.trim() || !body.date) {
    return NextResponse.json({ error: "Title and date are required" }, { status: 400 });
  }
  try {
    const event = await updateEvent(id, body);
    return NextResponse.json({ event });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not update event" }, { status: 502 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await deleteEvent(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not delete event" }, { status: 502 });
  }
}
