import { austinDateStr } from "./austinDate";
import {
  getAllContacts,
  getAllLinkedInProspects,
  getAllHubs,
  getAllReplies,
  getProgressForDate,
  getAllProgress,
} from "./airtable";
import { searchGmailMessages } from "./gmail";
import { listEvents, chicagoOffset } from "./googleCalendar";

const MODEL = "gemini-3.6-flash";

export type ChatMessage = { role: "user" | "model"; text: string };

type GeminiPart = {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
};
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

// ------------------------------------------------------------------ system

function systemPrompt(): string {
  return `You are Christopher's personal ops assistant inside his GODZ-i Command Center app. He runs SplitMic, a music-industry outreach business, and is starting a second business, Bookworm.

Today's date is ${austinDateStr()} in America/Chicago time. Use it to resolve relative dates like "today", "this week", or "next Monday".

You have read-only tools into his real data:
- search_contacts: the SplitMic cold email outreach pipeline (Airtable)
- search_linkedin_prospects: the separate LinkedIn outreach pipeline
- search_hubs: Austin music-industry hubs/venues resource list
- get_replies: triaged replies to outreach emails, with intent classification and a suggested response already drafted
- get_daily_progress: his daily marketing/build/deliver log
- search_gmail: his real Gmail inbox, using normal Gmail search syntax (e.g. "from:x@y.com", "after:2026/09/01", "subject:invoice")
- list_calendar_events: his real Google Calendar, for a given date range

Rules:
- Only answer from tool results. Never invent names, numbers, dates, emails, or event details.
- If a tool returns nothing relevant, say so plainly instead of guessing.
- Call tools whenever a question needs current data rather than asking him to go look it up.
- Be concise and direct, like a text from a sharp assistant, not a report. Skip headers and heavy bullet formatting unless listing several items actually helps.
- This is a plain-text chat bubble, not a markdown renderer. Never use asterisks, bold, italics, or heading syntax -- write plain sentences.
- You are currently read-only. If asked to send an email, create/edit a calendar event, or change any data, say plainly that you can't take that action yet.`;
}

// -------------------------------------------------------------- tool specs

const TOOLS = [
  {
    name: "search_contacts",
    description: "Search the SplitMic cold outreach pipeline (Airtable).",
    parameters: {
      type: "OBJECT",
      properties: {
        status: {
          type: "STRING",
          description:
            "Filter by exact Relationship Status, e.g. 'Research Needed', 'Ready for Outreach', 'Contacted', 'Replied', 'Engaged', 'Meeting', 'Follow-up', 'Partner', 'Not Interested'. Omit for any status.",
        },
        query: {
          type: "STRING",
          description: "Free-text match against name, organization, or notes.",
        },
        limit: { type: "NUMBER", description: "Max results, default 15, max 30." },
      },
    },
  },
  {
    name: "search_linkedin_prospects",
    description: "Search the LinkedIn outreach pipeline (separate from the email pipeline).",
    parameters: {
      type: "OBJECT",
      properties: {
        status: {
          type: "STRING",
          description: "Filter by exact status: 'New', 'Contacted', 'Connected', 'Replied', 'Engaged', 'Follow-up', 'Meeting'.",
        },
        query: { type: "STRING", description: "Free-text match against name, organization, or notes." },
        limit: { type: "NUMBER", description: "Max results, default 15, max 30." },
      },
    },
  },
  {
    name: "search_hubs",
    description: "Search the Austin music-industry hubs/venues resource list.",
    parameters: {
      type: "OBJECT",
      properties: {
        status: {
          type: "STRING",
          description: "Filter by exact status: 'Not Contacted', 'Called', 'Connected', 'Follow Up', 'Partnership', 'Not Relevant'.",
        },
        query: { type: "STRING", description: "Free-text match against name, category, or notes." },
        limit: { type: "NUMBER", description: "Max results, default 15, max 30." },
      },
    },
  },
  {
    name: "get_replies",
    description: "Get triaged replies to outreach emails, most recent first.",
    parameters: {
      type: "OBJECT",
      properties: {
        intent: {
          type: "STRING",
          description: "Filter by classified intent: 'Interested', 'Question', 'Not Interested', 'Unsubscribe', 'Out of Office', 'Other'.",
        },
        needsReplyOnly: { type: "BOOLEAN", description: "Only replies Christopher hasn't responded to yet." },
        limit: { type: "NUMBER", description: "Max results, default 15, max 30." },
      },
    },
  },
  {
    name: "get_daily_progress",
    description: "Get his daily marketing/build/deliver progress log for one date, or the most recent several days.",
    parameters: {
      type: "OBJECT",
      properties: {
        date: { type: "STRING", description: "A specific date as YYYY-MM-DD. Omit to get recent days instead." },
        recentDays: { type: "NUMBER", description: "When date is omitted, how many recent days to return. Default 7, max 30." },
      },
    },
  },
  {
    name: "search_gmail",
    description: "Search his real Gmail inbox using normal Gmail search syntax.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Gmail search query, e.g. 'from:someone@example.com', 'subject:invoice', 'after:2026/09/01 before:2026/09/07'.",
        },
        maxResults: { type: "NUMBER", description: "Max results, default 10, max 20." },
      },
      required: ["query"],
    },
  },
  {
    name: "list_calendar_events",
    description: "List events on his real Google Calendar between two dates (inclusive).",
    parameters: {
      type: "OBJECT",
      properties: {
        startDate: { type: "STRING", description: "Start date, YYYY-MM-DD." },
        endDate: { type: "STRING", description: "End date, YYYY-MM-DD (inclusive)." },
      },
      required: ["startDate", "endDate"],
    },
  },
];

// -------------------------------------------------------------- tool impls

function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function matchesQuery(query: string | undefined, haystack: (string | undefined)[]): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return haystack.some((h) => (h || "").toLowerCase().includes(q));
}

function clampLimit(limit: unknown, def: number, max: number): number {
  const n = typeof limit === "number" ? limit : def;
  return Math.min(Math.max(Math.floor(n), 1), max);
}

async function toolSearchContacts(args: { status?: string; query?: string; limit?: number }) {
  const all = await getAllContacts();
  const filtered = all.filter((c) => {
    if (args.status && c.fields["Relationship Status"] !== args.status) return false;
    return matchesQuery(args.query, [c.fields["Name / Target"], c.fields.Organization, c.fields.Notes, c.fields["Response Summary"]]);
  });
  const limit = clampLimit(args.limit, 15, 30);
  return {
    totalMatches: filtered.length,
    results: filtered.slice(0, limit).map((c) => ({
      name: c.fields["Name / Target"],
      organization: c.fields.Organization,
      role: c.fields.Role,
      relationshipStatus: c.fields["Relationship Status"],
      email: c.fields.Email,
      emailStatus: c.fields["Email Status"],
      nextAction: c.fields["Next Action"],
      nextActionDate: c.fields["Next Action Date"],
      lastContacted: c.fields["Email Last Contacted"],
      responseSummary: c.fields["Response Summary"],
      notes: c.fields.Notes,
    })),
  };
}

async function toolSearchLinkedIn(args: { status?: string; query?: string; limit?: number }) {
  const all = await getAllLinkedInProspects();
  const filtered = all.filter((p) => {
    if (args.status && p.fields.Status !== args.status) return false;
    return matchesQuery(args.query, [p.fields.Name, p.fields.Organization, p.fields.Notes]);
  });
  const limit = clampLimit(args.limit, 15, 30);
  return {
    totalMatches: filtered.length,
    results: filtered.slice(0, limit).map((p) => ({
      name: p.fields.Name,
      organization: p.fields.Organization,
      role: p.fields.Role,
      status: p.fields.Status,
      dateContacted: p.fields["Date Contacted"],
      response: p.fields.Response,
      nextAction: p.fields["Next Action"],
      nextActionDate: p.fields["Next Action Date"],
      notes: p.fields.Notes,
    })),
  };
}

async function toolSearchHubs(args: { status?: string; query?: string; limit?: number }) {
  const all = await getAllHubs();
  const filtered = all.filter((h) => {
    if (args.status && h.fields.Status !== args.status) return false;
    return matchesQuery(args.query, [h.fields.Name, h.fields.Category, h.fields.Notes, h.fields["Why Call"]]);
  });
  const limit = clampLimit(args.limit, 15, 30);
  return {
    totalMatches: filtered.length,
    results: filtered.slice(0, limit).map((h) => ({
      name: h.fields.Name,
      category: h.fields.Category,
      whoTheyReach: h.fields["Who They Reach"],
      phone: h.fields.Phone,
      email: h.fields.Email,
      status: h.fields.Status,
      lastContacted: h.fields["Last Contacted"],
      notes: h.fields.Notes,
    })),
  };
}

async function toolGetReplies(args: { intent?: string; needsReplyOnly?: boolean; limit?: number }) {
  const all = await getAllReplies();
  const filtered = all.filter((r) => {
    if (args.intent && r.fields.Intent !== args.intent) return false;
    if (args.needsReplyOnly && r.fields["Replied At"]) return false;
    return true;
  });
  const limit = clampLimit(args.limit, 15, 30);
  return {
    totalMatches: filtered.length,
    results: filtered.slice(0, limit).map((r) => ({
      fromName: r.fields["From Name"],
      organization: r.fields.Organization,
      subject: r.fields.Subject,
      receivedAt: r.fields["Received At"],
      intent: r.fields.Intent,
      summary: r.fields.Status,
      suggestedReply: r.fields["Suggested Reply"],
      alreadyReplied: !!r.fields["Replied At"],
    })),
  };
}

async function toolGetProgress(args: { date?: string; recentDays?: number }) {
  if (args.date) {
    const day = await getProgressForDate(args.date);
    return day ? { date: args.date, ...day } : { date: args.date, found: false };
  }
  const all = await getAllProgress();
  const sorted = [...all].sort((a, b) => (b.Date || "").localeCompare(a.Date || ""));
  const limit = clampLimit(args.recentDays, 7, 30);
  return { days: sorted.slice(0, limit) };
}

async function toolSearchGmail(args: { query: string; maxResults?: number }) {
  const messages = await searchGmailMessages(args.query, args.maxResults);
  return {
    results: messages.map((m) => ({
      from: `${m.fromName} <${m.fromEmail}>`,
      subject: m.subject,
      date: new Date(Number(m.internalDate)).toISOString(),
      snippet: m.snippet,
      body: m.body.slice(0, 1500),
    })),
  };
}

async function toolListCalendarEvents(args: { startDate: string; endDate: string }) {
  const timeMin = `${args.startDate}T00:00:00${chicagoOffset(args.startDate)}`;
  const endExclusive = addDaysStr(args.endDate, 1);
  const timeMax = `${endExclusive}T00:00:00${chicagoOffset(endExclusive)}`;
  const events = await listEvents(timeMin, timeMax);
  return {
    results: events.map((e) => ({
      title: e.title,
      start: e.start,
      end: e.end,
      allDay: e.allDay,
      description: e.description,
    })),
  };
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "search_contacts":
      return toolSearchContacts(args);
    case "search_linkedin_prospects":
      return toolSearchLinkedIn(args);
    case "search_hubs":
      return toolSearchHubs(args);
    case "get_replies":
      return toolGetReplies(args);
    case "get_daily_progress":
      return toolGetProgress(args);
    case "search_gmail":
      return toolSearchGmail(args as { query: string; maxResults?: number });
    case "list_calendar_events":
      return toolListCalendarEvents(args as { startDate: string; endDate: string });
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// -------------------------------------------------------------------- loop

// Function-response messages use role "user" per the Gemini REST API's
// function-calling contract -- there is no separate "function" role there.
export async function runAssistant(history: ChatMessage[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const contents: GeminiContent[] = history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));

  for (let step = 0; step < 6; step++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt() }] },
          contents,
          tools: [{ functionDeclarations: TOOLS }],
        }),
      }
    );
    if (!res.ok) throw new Error(`Assistant error (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const parts: GeminiPart[] = data.candidates?.[0]?.content?.parts || [];
    const calls = parts.filter((p) => p.functionCall);

    if (calls.length === 0) {
      const text = parts.map((p) => p.text || "").join("").trim();
      return text || "I couldn't come up with an answer for that.";
    }

    contents.push({ role: "model", parts });

    const responseParts: GeminiPart[] = [];
    for (const p of calls) {
      const name = p.functionCall!.name;
      let result: unknown;
      try {
        result = await executeTool(name, p.functionCall!.args || {});
      } catch (e) {
        result = { error: e instanceof Error ? e.message : "Tool call failed" };
      }
      responseParts.push({ functionResponse: { name, response: { result } } });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return "That took too many steps to answer -- try asking something more specific.";
}
