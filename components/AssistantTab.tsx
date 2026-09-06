"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { useLocalStorage } from "@/lib/useLocalStorage";

type ChatMessage = { role: "user" | "model"; text: string };

const WELCOME: ChatMessage = {
  role: "model",
  text: "Ask me anything about your outreach pipeline, replies, LinkedIn, calendar, or inbox.",
};

// Responses can take a while (Gemini's own latency plus however many tool
// calls it makes), so this walks through believable stages rather than
// leaving a bare spinner sitting there. It has no real signal on what the
// model is actually doing -- it advances on a timer and parks on the last
// stage for however long the real request takes.
const LOADING_STAGES = [
  { text: "Reading your question...", target: 18 },
  { text: "Checking your data sources...", target: 38 },
  { text: "Cross-referencing your pipeline and calendar...", target: 58 },
  { text: "Pulling the details together...", target: 78 },
  { text: "Drafting a response...", target: 92 },
];

function LoadingIndicator() {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    setStageIndex(0);
    const interval = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, LOADING_STAGES.length - 1));
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  const stage = LOADING_STAGES[stageIndex];

  return (
    <div
      className="self-start flex flex-col gap-2.5 rounded-2xl px-4 py-3 text-sm border border-border w-[260px]"
      style={{ background: "var(--color-surface-2)" }}
    >
      <div className="flex items-center gap-2 text-muted">
        <Loader2 size={14} className="animate-spin shrink-0" />
        <span key={stageIndex} className="assistant-stage-text">
          {stage.text}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full overflow-hidden bg-border">
        <div
          className="h-full rounded-full assistant-progress-fill"
          style={{
            width: `${stage.target}%`,
            background: "linear-gradient(90deg, var(--color-accent), var(--color-accent-light), var(--color-accent))",
            transition: "width 1.8s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </div>
    </div>
  );
}

export default function AssistantTab() {
  const [messages, setMessages] = useLocalStorage<ChatMessage[]>("assistant-chat-v1", [WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user", text } as ChatMessage];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setMessages([...next, { role: "model", text: data.reply } as ChatMessage]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col max-w-[800px] mx-auto h-[calc(100vh-220px)] min-h-[500px]">
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pb-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              background: m.role === "user" ? "var(--color-accent)" : "var(--color-surface-2)",
              color: m.role === "user" ? "#0a0705" : "var(--color-foreground)",
              border: m.role === "user" ? "none" : "1px solid var(--color-border)",
            }}
          >
            {m.text}
          </div>
        ))}
        {loading && <LoadingIndicator />}
        {error && (
          <div className="self-start rounded-2xl px-4 py-3 text-sm border border-red-500/40 bg-red-500/10 text-red-400">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-end gap-2 border-t border-border pt-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about your pipeline, replies, calendar, inbox..."
          rows={2}
          className="flex-1 resize-none rounded-xl bg-surface2 border border-border px-4 py-3 text-sm placeholder:text-muted focus:outline-none focus:border-accent"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="flex items-center justify-center rounded-xl w-11 h-11 shrink-0 disabled:opacity-40"
          style={{ background: "var(--color-accent)", color: "#0a0705" }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
