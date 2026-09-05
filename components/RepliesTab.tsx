"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Send, Check, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

type Reply = {
  id: string;
  fields: {
    Source?: string;
    "From Email"?: string;
    "From Name"?: string;
    "Contact Name"?: string;
    Organization?: string;
    Subject?: string;
    Body?: string;
    "Received At"?: string;
    Status?: string;
    Intent?: string;
    "Suggested Reply"?: string;
    "My Reply"?: string;
    "Replied At"?: string;
  };
};

const INTENT_COLORS: Record<string, string> = {
  Interested: "#5FBF7A",
  Question: "#56CCF2",
  "Not Interested": "#F2994A",
  Unsubscribe: "#e8430a",
  "Out of Office": "#71717a",
  Other: "#9B87F5",
};

const FILTERS = ["Needs reply", "All", "Replied"] as const;

// Which business the reply belongs to. Everything is SplitMic until Bookworm
// has its own list; the filter exists so the two never get mixed up once it does.
const SOURCES = ["All sources", "SplitMic", "Bookworm"] as const;

const SOURCE_COLORS: Record<string, string> = {
  SplitMic: "#e8430a",
  Bookworm: "#56CCF2",
};

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function RepliesTab() {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Needs reply");
  const [source, setSource] = useState<(typeof SOURCES)[number]>("All sources");
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/replies");
      if (!res.ok) throw new Error("Could not load replies");
      const data = await res.json();
      setReplies(data.replies || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    // Rows written before the Source field existed have none, so they fall
    // back to SplitMic rather than vanishing from a filtered view.
    const bySource =
      source === "All sources" ? replies : replies.filter((r) => (r.fields.Source || "SplitMic") === source);
    if (filter === "All") return bySource;
    if (filter === "Replied") return bySource.filter((r) => r.fields.Status === "Replied");
    return bySource.filter((r) => r.fields.Status !== "Replied" && r.fields.Status !== "Closed");
  }, [replies, filter, source]);

  const needsReply = replies.filter((r) => r.fields.Status !== "Replied" && r.fields.Status !== "Closed").length;

  const open = (r: Reply) => {
    const next = openId === r.id ? null : r.id;
    setOpenId(next);
    setDraft(next ? r.fields["My Reply"] || r.fields["Suggested Reply"] || "" : "");
  };

  const send = async (r: Reply) => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/replies/${r.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyText: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send");
      setReplies((prev) => prev.map((x) => (x.id === r.id ? data.reply : x)));
      setOpenId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send");
    } finally {
      setSending(false);
    }
  };

  const close = async (r: Reply) => {
    try {
      const res = await fetch(`/api/replies/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Status: "Closed" }),
      });
      const data = await res.json();
      if (res.ok) setReplies((prev) => prev.map((x) => (x.id === r.id ? data.reply : x)));
    } catch {
      // Non-critical: the row just stays in the queue until the next attempt.
    }
  };

  return (
    <div className="max-w-[900px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <p className="text-base text-muted">
          {needsReply > 0 ? `${needsReply} waiting on you` : "Nothing waiting. All caught up."}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-surface2 p-1 rounded-full border border-border">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap"
                style={{
                  background: filter === f ? "var(--color-accent)" : "transparent",
                  color: filter === f ? "#0a0705" : "var(--color-muted)",
                }}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-surface2 border border-border text-textSecondary hover:text-white hover:border-accent transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-surface2 p-1 rounded-full border border-border self-start mb-5 w-fit">
        {SOURCES.map((s) => {
          const active = source === s;
          const dot = SOURCE_COLORS[s];
          return (
            <button
              key={s}
              onClick={() => setSource(s)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap"
              style={{
                background: active ? "var(--color-accent)" : "transparent",
                color: active ? "#0a0705" : "var(--color-muted)",
              }}
            >
              {dot && (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: active ? "#0a0705" : dot }}
                />
              )}
              {s}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-base mb-4 bg-[rgba(232,67,10,0.1)] border border-[rgba(232,67,10,0.4)] text-accentLight">
          {error}
        </div>
      )}

      {loading && <p className="text-sm italic text-muted px-1">Loading…</p>}

      {!loading && shown.length === 0 && (
        <div className="px-5 py-8 rounded-xl bg-surface2 border border-border text-center">
          <p className="text-base font-semibold text-foreground mb-1">Nothing here yet.</p>
          <p className="text-sm text-muted">
            Replies from people in your outreach list land here automatically, within a few minutes of arriving.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {shown.map((r) => {
          const f = r.fields;
          const isOpen = openId === r.id;
          const intent = f.Intent || "Other";
          const src = f.Source || "SplitMic";
          return (
            <div key={r.id} className="rounded-xl bg-surface2 border border-border overflow-hidden">
              <button onClick={() => open(r)} className="w-full flex items-start gap-3 px-4 py-3.5 text-left">
                <span
                  className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: INTENT_COLORS[intent] || "#9B87F5" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-semibold text-foreground truncate">
                      {f["Contact Name"] || f["From Name"] || f["From Email"]}
                    </p>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-mono flex-shrink-0 font-semibold"
                      style={{
                        background: `${SOURCE_COLORS[src] || "#9B87F5"}22`,
                        color: SOURCE_COLORS[src] || "#9B87F5",
                      }}
                    >
                      {src}
                    </span>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-mono flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.06)", color: INTENT_COLORS[intent] || "#9B87F5" }}
                    >
                      {intent}
                    </span>
                    {f.Status === "Replied" && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-white/5 text-muted">
                        replied
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted truncate mt-0.5">
                    {[f.Organization, f.Subject].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="text-xs text-muted font-mono flex-shrink-0 mt-1">{timeAgo(f["Received At"])}</span>
                {isOpen ? (
                  <ChevronUp size={16} color="var(--color-muted)" className="flex-shrink-0 mt-1" />
                ) : (
                  <ChevronDown size={16} color="var(--color-muted)" className="flex-shrink-0 mt-1" />
                )}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 border-t border-border pt-3.5 flex flex-col gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.1em] text-muted font-mono mb-1.5">They wrote</p>
                    <p className="text-sm text-textSecondary whitespace-pre-wrap leading-relaxed">
                      {f.Body || "(no body captured)"}
                    </p>
                  </div>

                  {f.Status === "Replied" ? (
                    <div>
                      <p className="text-xs uppercase tracking-[0.1em] text-muted font-mono mb-1.5">
                        You replied {timeAgo(f["Replied At"])}
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{f["My Reply"]}</p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Sparkles size={12} color="var(--color-muted)" />
                          <p className="text-xs uppercase tracking-[0.1em] text-muted font-mono">
                            Your reply {f["Suggested Reply"] ? "(draft suggested)" : ""}
                          </p>
                        </div>
                        <textarea
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          rows={6}
                          placeholder="Write your reply…"
                          className="w-full text-sm px-3 py-2.5 rounded-lg outline-none resize-none bg-black/30 text-foreground border border-border placeholder:text-muted"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => close(r)}
                          className="px-4 py-2.5 rounded-lg text-sm bg-surface3 border border-border text-textSecondary hover:text-white transition-all"
                        >
                          <Check size={14} className="inline mr-1.5" />
                          No reply needed
                        </button>
                        <button
                          onClick={() => send(r)}
                          disabled={!draft.trim() || sending}
                          className="flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 text-white disabled:opacity-40 transition-all"
                          style={{
                            background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))",
                          }}
                        >
                          <Send size={14} /> {sending ? "Sending…" : "Send reply"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
