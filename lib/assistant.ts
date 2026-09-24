import { austinDateStr } from "./austinDate";
import {
  getAllContacts,
  getAllLinkedInProspects,
  getAllHubs,
  getAllReplies,
  getAllBookwormContacts,
  getAllBookwormTikTokCreators,
  getProgressForDate,
  getAllProgress,
} from "./airtable";
import { searchGmailMessages } from "./gmail";
import { listEvents, chicagoOffset } from "./googleCalendar";
import { getFollowUps, getWeeklyExecution } from "./execution";
import { GEMINI_MODEL } from "./geminiModel";

const MODEL = GEMINI_MODEL;

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
- get_followups: follow-ups due from every Splitmic and Bookworm channel
- get_tiktok_creators: qualified Bookworm TikTok creators and their raw metrics
- get_bookworm_prospects: Bookworm email and partnership prospects
- get_execution_objectives: the build and delivery objectives for a date
- get_weekly_metrics: compact outreach and completion totals for the week
- search_gmail: his real Gmail inbox, using normal Gmail search syntax (e.g. "from:x@y.com", "after:2026/09/01", "subject:invoice")
- list_calendar_events: his real Google Calendar, for a given date range
- get_tasks_for_date: everything on his plate for one specific day -- calendar events, outreach/LinkedIn follow-ups due that day, and the daily progress log

Rules:
- Only answer from tool results. Never invent names, numbers, dates, emails, or event details.
- If a tool returns nothing relevant, say so plainly instead of guessing.
- Call tools whenever a question needs current data rather than asking him to go look it up.
- For any question about his schedule or "tasks" on a day (today, a specific date, "this week"), use get_tasks_for_date for each day in question rather than only checking the calendar -- a day's tasks include follow-ups due and his progress log, not just calendar events.
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
    name: "get_followups",
    description: "Get all Splitmic and Bookworm follow-ups due on a date, grouped by real outreach records.",
    parameters: {
      type: "OBJECT",
      properties: { date: { type: "STRING", description: "Date as YYYY-MM-DD." } },
      required: ["date"],
    },
  },
  {
    name: "get_tiktok_creators",
    description: "Find Bookworm TikTok creators using follower, engagement, activity, list, and contact filters.",
    parameters: {
      type: "OBJECT",
      properties: {
        minFollowers: { type: "NUMBER" },
        maxFollowers: { type: "NUMBER" },
        minEngagement: { type: "NUMBER", description: "Minimum average engagement percentage, e.g. 5 for 5%." },
        maxDaysSincePost: { type: "NUMBER" },
        list: { type: "STRING", description: "Primary or Reserve." },
        contacted: { type: "BOOLEAN" },
        limit: { type: "NUMBER", description: "Default 5, max 30." },
      },
    },
  },
  {
    name: "get_bookworm_prospects",
    description: "Search Bookworm email and partnership prospects.",
    parameters: {
      type: "OBJECT",
      properties: {
        status: { type: "STRING" },
        query: { type: "STRING" },
        limit: { type: "NUMBER", description: "Default 15, max 30." },
      },
    },
  },
  {
    name: "get_execution_objectives",
    description: "Get the one build objective and one delivery objective for a date.",
    parameters: {
      type: "OBJECT",
      properties: { date: { type: "STRING", description: "Date as YYYY-MM-DD." } },
      required: ["date"],
    },
  },
  {
    name: "get_weekly_metrics",
    description: "Get compact marketing, build, delivery, and outreach totals for the week containing a date.",
    parameters: {
      type: "OBJECT",
      properties: { date: { type: "STRING", description: "Any date in the desired week, YYYY-MM-DD." } },
      required: ["date"],
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
  {
    name: "get_tasks_for_date",
    description:
      "Get everything on his plate for one specific day: calendar events, outreach/LinkedIn follow-ups due that day, and his daily progress log. Use this for any question about his schedule or tasks for a day.",
    parameters: {
      type: "OBJECT",
      properties: {
        date: { type: "STRING", description: "The date to check, YYYY-MM-DD." },
      },
      required: ["date"],
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

async function toolGetFollowUps(args: { date: string }) {
  const results = await getFollowUps(args.date);
  return {
    date: args.date,
    total: results.length,
    counts: results.reduce<Record<string, number>>((acc, item) => {
      acc[item.channel] = (acc[item.channel] || 0) + 1;
      return acc;
    }, {}),
    results,
  };
}

async function toolGetTikTokCreators(args: {
  minFollowers?: number;
  maxFollowers?: number;
  minEngagement?: number;
  maxDaysSincePost?: number;
  list?: string;
  contacted?: boolean;
  limit?: number;
}) {
  const all = await getAllBookwormTikTokCreators();
  const filtered = all.filter((creator) => {
    const fields = creator.fields;
    if (fields.Excluded) return false;
    if (args.list && (fields.List || "Primary") !== args.list) return false;
    if (args.minFollowers != null && (fields.Followers ?? -1) < args.minFollowers) return false;
    if (args.maxFollowers != null && (fields.Followers ?? Number.POSITIVE_INFINITY) > args.maxFollowers) return false;
    if (args.minEngagement != null && (fields["Average Engagement Rate %"] ?? -1) < args.minEngagement) return false;
    if (args.maxDaysSincePost != null && (fields["Days Since Last Post"] ?? Number.POSITIVE_INFINITY) > args.maxDaysSincePost) return false;
    const contacted = !!fields["Date Contacted"] || !["", "New"].includes(fields.Status || "New");
    if (args.contacted != null && contacted !== args.contacted) return false;
    return true;
  });
  const limit = clampLimit(args.limit, 5, 30);
  return {
    totalMatches: filtered.length,
    results: filtered
      .sort((a, b) => (b.fields["Average Engagement Rate %"] || 0) - (a.fields["Average Engagement Rate %"] || 0))
      .slice(0, limit)
      .map((creator) => ({
        name: creator.fields["Display Name"] || creator.fields.Name,
        username: creator.fields["TikTok Handle"],
        followers: creator.fields.Followers,
        averageViews: creator.fields["Average Views"],
        engagementRatePercent: creator.fields["Average Engagement Rate %"],
        followerToAverageViewsRatio: creator.fields["Follower To Avg Views Ratio"],
        daysSinceLastPost: creator.fields["Days Since Last Post"],
        bio: creator.fields.Bio,
        profileUrl: creator.fields["TikTok URL"],
        list: creator.fields.List || "Primary",
        status: creator.fields.Status || "New",
      })),
  };
}

async function toolGetBookwormProspects(args: { status?: string; query?: string; limit?: number }) {
  const all = await getAllBookwormContacts();
  const filtered = all.filter((contact) => {
    if (args.status && contact.fields["Relationship Status"] !== args.status) return false;
    return matchesQuery(args.query, [contact.fields.Name, contact.fields.Category, contact.fields.Opportunity, contact.fields.Notes]);
  });
  const limit = clampLimit(args.limit, 15, 30);
  return {
    totalMatches: filtered.length,
    results: filtered.slice(0, limit).map((contact) => ({
      name: contact.fields.Name,
      category: contact.fields.Category,
      email: contact.fields.Email,
      status: contact.fields["Relationship Status"],
      nextAction: contact.fields["Next Action"],
      nextActionDate: contact.fields["Next Action Date"],
      profileUrl: contact.fields["Profile URL"],
      notes: contact.fields.Notes,
    })),
  };
}

async function toolGetExecutionObjectives(args: { date: string }) {
  const progress = await getProgressForDate(args.date);
  return {
    date: args.date,
    build: progress
      ? { project: progress["Build Project"], objective: progress["Build Objective"], status: progress["Build Status"] || (progress["Build Completed"] ? "Complete" : "Not Started"), notes: progress["Build Notes"] }
      : null,
    delivery: progress
      ? { objective: progress["Delivery Objective"], status: progress["Delivery Status"] || (progress["Deliver Completed"] ? "Complete" : "Not Started"), recipient: progress["Delivery Recipient"], link: progress["Delivery Link"], notes: progress["Delivery Notes"] }
      : null,
  };
}

async function toolGetWeeklyMetrics(args: { date: string }) {
  return getWeeklyExecution(args.date);
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

// One day's worth of everything: calendar events plus follow-ups due that day
// from both outreach pipelines plus the progress log. "Tasks for a day" isn't
// a single Airtable table -- it's these three sources combined.
async function toolGetTasksForDate(args: { date: string }) {
  const date = args.date;
  const timeMin = `${date}T00:00:00${chicagoOffset(date)}`;
  const nextDay = addDaysStr(date, 1);
  const timeMax = `${nextDay}T00:00:00${chicagoOffset(nextDay)}`;

  const [events, followUpsDue, progress] = await Promise.all([
    listEvents(timeMin, timeMax),
    getFollowUps(date),
    getProgressForDate(date),
  ]);

  return {
    date,
    calendarEvents: events.map((e) => ({ title: e.title, start: e.start, end: e.end, allDay: e.allDay })),
    followUpsDue,
    progressLog: progress || null,
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
    case "get_followups":
      return toolGetFollowUps(args as { date: string });
    case "get_tiktok_creators":
      return toolGetTikTokCreators(args);
    case "get_bookworm_prospects":
      return toolGetBookwormProspects(args);
    case "get_execution_objectives":
      return toolGetExecutionObjectives(args as { date: string });
    case "get_weekly_metrics":
      return toolGetWeeklyMetrics(args as { date: string });
    case "search_gmail":
      return toolSearchGmail(args as { query: string; maxResults?: number });
    case "list_calendar_events":
      return toolListCalendarEvents(args as { startDate: string; endDate: string });
    case "get_tasks_for_date":
      return toolGetTasksForDate(args as { date: string });
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// -------------------------------------------------------------------- loop

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Gemini returns 503 "high demand" fairly often and it's almost always gone
// within a couple seconds -- worth a couple quick retries before surfacing
// an error to Christopher.
async function callGemini(apiKey: string, contents: GeminiContent[]): Promise<GeminiPart[]> {
  const delays = [0, 1500, 4000];
  let lastError = "";
  for (const delay of delays) {
    if (delay) await sleep(delay);
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
    if (res.ok) {
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts || [];
    }
    lastError = `Assistant error (${res.status}): ${(await res.text()).slice(0, 300)}`;
    if (res.status !== 503) throw new Error(lastError);
  }
  throw new Error(lastError);
}

// Function-response messages use role "user" per the Gemini REST API's
// function-calling contract -- there is no separate "function" role there.
export async function runAssistant(history: ChatMessage[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const contents: GeminiContent[] = history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));

  for (let step = 0; step < 6; step++) {
    const parts = await callGemini(apiKey, contents);
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
