const MODEL = "gemini-3.6-flash";

export const INTENTS = [
  "Interested",
  "Question",
  "Not Interested",
  "Unsubscribe",
  "Out of Office",
  "Other",
] as const;

export type Intent = (typeof INTENTS)[number];

export type Triage = {
  intent: Intent;
  summary: string;
  suggestedReply: string;
};

const SYSTEM_PROMPT = `You triage replies to cold B2B outreach emails sent on behalf of SplitMic, a service that connects musicians with venues, labels and other music-industry contacts.

You will be given one inbound reply. Do two things:

1. Classify its intent as exactly one of:
   - Interested: they want to talk, learn more, meet, or are positive
   - Question: they are asking something before deciding
   - Not Interested: a clear no, but not a demand to stop emailing
   - Unsubscribe: they ask to be removed, to stop emailing, or express annoyance at being contacted
   - Out of Office: an automated away/vacation/auto-responder message
   - Other: anything else, including bounces and unrelated mail

2. Write a suggested reply for the sender to send back, in their voice.

Rules for the suggested reply:
- Short. Two to five sentences. This is a real person writing back, not a newsletter.
- Plain, warm, direct. No corporate filler, no "I hope this email finds you well".
- Never invent facts, features, prices, timelines or commitments.
- If they asked something you cannot answer from their message alone, acknowledge it and say you will follow up with specifics rather than guessing.
- If intent is Unsubscribe, the suggested reply should be a brief apology confirming they have been removed and will not be contacted again.
- If intent is Out of Office, return an empty string for the suggested reply.
- Do not add a signature, greeting line with a placeholder, or subject line. Body text only.

Also write a one-line summary (under 15 words) of what they actually said.`;

export async function triageReply(args: {
  fromName: string;
  organization?: string;
  subject: string;
  body: string;
}): Promise<Triage> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const userMessage =
    `From: ${args.fromName}${args.organization ? ` (${args.organization})` : ""}\n` +
    `Subject: ${args.subject}\n\n` +
    `${args.body.slice(0, 4000)}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              intent: { type: "STRING", enum: [...INTENTS] },
              summary: { type: "STRING" },
              suggestedReply: { type: "STRING" },
            },
            required: ["intent", "summary", "suggestedReply"],
          },
        },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini triage failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("");
  if (!text) throw new Error("Gemini returned no triage output");

  const parsed = JSON.parse(text) as Triage;
  if (!INTENTS.includes(parsed.intent)) parsed.intent = "Other";
  return parsed;
}

// Auto-acknowledgement is deliberately narrow. Sending "thanks, I'll get back
// to you shortly" to someone who just asked to be left alone, or to an
// out-of-office robot (which would then reply again), is worse than sending
// nothing -- so only genuinely warm, human replies qualify.
export function shouldAutoAcknowledge(intent: Intent): boolean {
  if (process.env.AUTO_ACKNOWLEDGE !== "true") return false;
  return intent === "Interested" || intent === "Question";
}

export function acknowledgementText(fromName: string): string {
  const first = (fromName || "").trim().split(/\s+/)[0];
  return (
    `${first ? `Hi ${first},` : "Hi,"}\n\n` +
    `Thanks for getting back to me — I've got your message and I'll follow up properly shortly.\n\n` +
    `Christopher`
  );
}
