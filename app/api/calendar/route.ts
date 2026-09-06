import { NextRequest, NextResponse } from "next/server";
import { listEvents, createEvent, NewEvent } from "@/lib/googleCalendar";

export async function GET(req: NextRequest) {
  const timeMin = req.nextUrl.searchParams.get("start");
  const timeMax = req.nextUrl.searchParams.get("end");
  if (!timeMin || !timeMax) {
    return NextResponse.json({ error: "start and end are required" }, { status: 400 });
  }
  try {
    const events = await listEvents(timeMin, timeMax);
    return NextResponse.json({ events });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not load events" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as NewEvent;
  if (!body.title?.trim() || !body.date) {
    return NextResponse.json({ error: "Title and date are required" }, { status: 400 });
  }
  try {
    const event = await createEvent(body);
    return NextResponse.json({ event });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not create event" }, { status: 502 });
  }
}
