import { NextRequest, NextResponse } from "next/server";
import { runAssistant, ChatMessage } from "@/lib/assistant";

// The agent loop can make several tool calls before answering; give it room.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const messages = body?.messages as ChatMessage[] | undefined;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages are required" }, { status: 400 });
  }

  try {
    const reply = await runAssistant(messages);
    return NextResponse.json({ reply });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Assistant failed" }, { status: 502 });
  }
}
