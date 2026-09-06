const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

// Deliberately the same account's primary calendar -- this is your personal
// calendar, not a separate booking system. Cal.com stays entirely separate.
const CALENDAR_ID = "primary";

async function getAccessToken(): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error("Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Calendar token refresh failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string;
}

export type CalendarEvent = {
  id: string;
  title: string;
  // All-day events carry a date ("2026-09-07"); timed events carry a
  // dateTime ("2026-09-07T14:00:00-05:00"). Only one of each pair is set.
  start: string;
  end: string;
  allDay: boolean;
  description?: string;
};

type GoogleEventTime = { date?: string; dateTime?: string; timeZone?: string };
type GoogleEvent = {
  id: string;
  summary?: string;
  description?: string;
  start?: GoogleEventTime;
  end?: GoogleEventTime;
  status?: string;
};

function fromGoogleEvent(e: GoogleEvent): CalendarEvent {
  const allDay = !!e.start?.date;
  return {
    id: e.id,
    title: e.summary || "(untitled)",
    start: (allDay ? e.start?.date : e.start?.dateTime) || "",
    end: (allDay ? e.end?.date : e.end?.dateTime) || "",
    allDay,
    description: e.description,
  };
}

async function callCalendar(path: string, init?: RequestInit): Promise<Response> {
  const accessToken = await getAccessToken();
  return fetch(`https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...init?.headers },
  });
}

// Range is exclusive of `timeMax`, matching how a calendar month is normally
// expressed (first of this month through first of next month).
export async function listEvents(timeMin: string, timeMax: string): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const res = await callCalendar(`/events?${params}`);
  if (!res.ok) throw new Error(`Calendar list failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.items || [])
    .filter((e: GoogleEvent) => e.status !== "cancelled")
    .map(fromGoogleEvent);
}

export type NewEvent = {
  title: string;
  date: string; // "2026-09-07"
  time?: string; // "14:00", omitted = all-day
  durationMinutes?: number;
  description?: string;
};

export async function createEvent(input: NewEvent): Promise<CalendarEvent> {
  const body = toGoogleBody(input);
  const res = await callCalendar("/events", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Calendar create failed: ${res.status} ${await res.text()}`);
  return fromGoogleEvent(await res.json());
}

export async function updateEvent(id: string, input: NewEvent): Promise<CalendarEvent> {
  const body = toGoogleBody(input);
  const res = await callCalendar(`/events/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Calendar update failed: ${res.status} ${await res.text()}`);
  return fromGoogleEvent(await res.json());
}

export async function deleteEvent(id: string): Promise<void> {
  const res = await callCalendar(`/events/${encodeURIComponent(id)}`, { method: "DELETE" });
  // Google returns 410 for an event already gone -- treat that as success
  // rather than an error the UI has to explain.
  if (!res.ok && res.status !== 410 && res.status !== 404) {
    throw new Error(`Calendar delete failed: ${res.status} ${await res.text()}`);
  }
}

function toGoogleBody(input: NewEvent) {
  const timeZone = "America/Chicago";
  if (!input.time) {
    // All-day events use exclusive end dates -- the next calendar day.
    const end = new Date(input.date + "T00:00:00");
    end.setDate(end.getDate() + 1);
    return {
      summary: input.title,
      description: input.description,
      start: { date: input.date },
      end: { date: end.toISOString().slice(0, 10) },
    };
  }
  const start = new Date(`${input.date}T${input.time}:00`);
  const end = new Date(start.getTime() + (input.durationMinutes ?? 60) * 60000);
  return {
    summary: input.title,
    description: input.description,
    start: { dateTime: start.toISOString(), timeZone },
    end: { dateTime: end.toISOString(), timeZone },
  };
}
