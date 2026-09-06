"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { useLocalStorage } from "@/lib/useLocalStorage";

type ChatMessage = { role: "user" | "model"; text: string };

const WELCOME: ChatMessage = {
  role: "model",
  text: "Ask me anything about your outreach pipeline, replies, LinkedIn, calendar, or inbox.",
};

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
        {loading && (
          <div
            className="self-start flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-muted border border-border"
            style={{ background: "var(--color-surface-2)" }}
          >
            <Loader2 size={14} className="animate-spin" /> Thinking...
          </div>
        )}
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
