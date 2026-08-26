import { NextRequest, NextResponse } from "next/server";
import { generateEmailCopy } from "@/lib/gemini";

// Vercel Hobby caps functions at 10s by default; Gemini flash usually answers
// in a few seconds but this gives it headroom.
export const maxDuration = 60;

const WELCOME =
  "This bot writes email copy using your marketing framework.\n\n" +
  "Just describe what you need: the product, the audience, and the goal " +
  "(or name a specific framework). Example:\n\n" +
  '"Write a Dog Whistle email for SplitMic targeting Austin venue owners who are tired of no-show bands."';

function chunk(text: string, size = 4000): string[] {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
  return parts;
}

async function sendTo(chatId: number | string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  for (const part of chunk(text)) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: part }),
    });
  }
}

// This webhook is a public URL by nature of how Telegram calls it. Two layers
// keep it from being usable by anyone else: the secret token Telegram sends
// back on every request (set when the webhook was registered), and an
// allowlist of exactly one chat ID -- yours.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = await req.json();

  // Temporary diagnostic branch: only reachable with the correct webhook
  // secret above, so it's safe. Reports masked env var info to find a
  // prod/local mismatch without ever exposing the real values.
  if (update?.__diag === true) {
    const chatEnv = process.env.TELEGRAM_CHAT_ID || "";
    const tokenEnv = process.env.TELEGRAM_BOT_TOKEN || "";
    return NextResponse.json({
      envChatId_length: chatEnv.length,
      envChatId_value_matchesExpected: chatEnv === String(update.expectedChatId || ""),
      envChatId_hasWhitespace: chatEnv !== chatEnv.trim(),
      envToken_length: tokenEnv.length,
      envToken_first4: tokenEnv.slice(0, 4),
      envToken_last4: tokenEnv.slice(-4),
      envToken_hasWhitespace: tokenEnv !== tokenEnv.trim(),
    });
  }

  const message = update?.message;
  const chatId = message?.chat?.id;
  const text = message?.text as string | undefined;

  if (!chatId || String(chatId) !== process.env.TELEGRAM_CHAT_ID) {
    // Silently ignore -- never reveal to a stranger that this bot exists or works.
    return NextResponse.json({ ok: true });
  }

  if (!text) {
    return NextResponse.json({ ok: true });
  }

  if (text === "/start" || text === "/help") {
    await sendTo(chatId, WELCOME);
    return NextResponse.json({ ok: true });
  }

  try {
    const reply = await generateEmailCopy(text);
    await sendTo(chatId, reply);
  } catch (e) {
    await sendTo(chatId, `Something went wrong generating that: ${e instanceof Error ? e.message : "unknown error"}`);
  }

  return NextResponse.json({ ok: true });
}
