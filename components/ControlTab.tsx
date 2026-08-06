"use client";

import { useState, useEffect, useCallback } from "react";
import { Send, Megaphone, RefreshCw, Plus, Trash2, Lock, AlertTriangle } from "lucide-react";

type QueuedContent = { id: string; content: string; status: string; notes?: string };
type Status = {
  pendingByTier: Array<{ tier: string; label: string; count: number }>;
  pendingTotal: number;
  dailyLimit: number;
  queue: QueuedContent[];
};

const PASSWORD_KEY = "godzi-app-password";

export default function ControlTab() {
  const [password, setPassword] = useState<string | null>(null);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [newContent, setNewContent] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(PASSWORD_KEY);
    if (stored) setPassword(stored);
  }, []);

  const loadStatus = useCallback(async (pw: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/control/status", { headers: { "x-app-password": pw } });
      if (res.status === 401) {
        setError("Wrong password.");
        setPassword(null);
        window.localStorage.removeItem(PASSWORD_KEY);
        return;
      }
      if (!res.ok) throw new Error("Failed to load status");
      setStatus(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (password) loadStatus(password);
  }, [password, loadStatus]);

  const unlock = () => {
    if (!passwordDraft.trim()) return;
    window.localStorage.setItem(PASSWORD_KEY, passwordDraft);
    setPassword(passwordDraft);
    setPasswordDraft("");
  };

  const runJob = async (job: string) => {
    if (!password) return;
    setRunning(job);
    setResult(null);
    setError(null);
    setConfirming(null);
    try {
      const res = await fetch("/api/control/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-password": password },
        body: JSON.stringify({ job }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Job failed");
      setResult(data.message);
      loadStatus(password);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(null);
    }
  };

  const addContent = async () => {
    if (!password || !newContent.trim()) return;
    setError(null);
    try {
      const res = await fetch("/api/control/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-password": password },
        body: JSON.stringify({ content: newContent }),
      });
      if (!res.ok) throw new Error("Failed to queue content");
      setNewContent("");
      loadStatus(password);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const removeContent = async (id: string) => {
    if (!password) return;
    try {
      await fetch(`/api/control/queue?id=${id}`, {
        method: "DELETE",
        headers: { "x-app-password": password },
      });
      loadStatus(password);
    } catch {
      // ignore
    }
  };

  if (!password) {
    return (
      <div className="max-w-[460px] mx-auto flex flex-col gap-4 pt-8">
        <div className="flex items-center gap-3">
          <Lock size={20} color="var(--color-accent)" />
          <h2 className="text-xl font-bold text-foreground">Control panel locked</h2>
        </div>
        <p className="text-sm text-muted">
          These controls send real emails and post to your live social accounts, so they need the app password.
        </p>
        <input
          type="password"
          value={passwordDraft}
          onChange={(e) => setPasswordDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && unlock()}
          placeholder="App password"
          className="text-base px-4 py-3 rounded-xl outline-none bg-white/[0.02] text-foreground border border-border placeholder:text-muted"
        />
        <button
          onClick={unlock}
          className="w-full py-3.5 rounded-xl text-base font-bold text-white transition-all hover:-translate-y-0.5"
          style={{
            background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))",
            boxShadow: "var(--shadow-cta)",
          }}
        >
          Unlock
        </button>
        {error && <p className="text-sm text-accentLight">{error}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-[900px] mx-auto flex flex-col gap-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm uppercase tracking-[0.14em] text-muted font-mono">Automation control</h2>
        <button
          onClick={() => loadStatus(password)}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm bg-surface2 border border-border text-textSecondary hover:text-white hover:border-accent transition-all disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-base bg-[rgba(232,67,10,0.1)] border border-[rgba(232,67,10,0.4)] text-accentLight">
          {error}
        </div>
      )}
      {result && (
        <div className="px-4 py-3 rounded-xl text-base bg-[rgba(95,191,122,0.1)] border border-[rgba(95,191,122,0.4)] text-[#5FBF7A]">
          {result}
        </div>
      )}

      <section>
        <h3 className="text-sm uppercase tracking-[0.14em] text-muted font-mono mb-3.5">Email outreach</h3>
        <div className="rounded-2xl bg-surface2 border border-border p-5 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2.5">
            {status?.pendingByTier.map((t) => (
              <div key={t.tier} className="px-4 py-2.5 rounded-xl bg-surface3 border border-border">
                <p className="text-xs text-muted font-mono">{t.label}</p>
                <p className="text-2xl font-bold text-foreground">{t.count}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted">
            {status?.pendingTotal ?? 0} leads waiting in New with an email. Next run sends up to{" "}
            {status?.dailyLimit ?? 20}.
          </p>

          {confirming === "send-outreach" ? (
            <div className="flex flex-col gap-3 p-4 rounded-xl bg-[rgba(232,67,10,0.08)] border border-[rgba(232,67,10,0.4)]">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={18} color="var(--color-accent-light)" className="flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">
                  This sends real emails to up to {status?.dailyLimit ?? 20} real leads and moves them to Contacted.
                  Continue?
                </p>
              </div>
              <div className="flex gap-2.5">
                <button
                  onClick={() => runJob("send-outreach")}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))" }}
                >
                  Yes, send now
                </button>
                <button
                  onClick={() => setConfirming(null)}
                  className="px-5 py-3 rounded-xl text-sm bg-surface3 border border-border text-textSecondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirming("send-outreach")}
              disabled={running !== null}
              className="w-full py-4 rounded-xl text-base font-bold flex items-center justify-center gap-2 text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))",
                boxShadow: "var(--shadow-cta)",
              }}
            >
              <Send size={18} /> {running === "send-outreach" ? "Sending..." : "Send outreach now"}
            </button>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-sm uppercase tracking-[0.14em] text-muted font-mono mb-3.5">Social content</h3>
        <div className="rounded-2xl bg-surface2 border border-border p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2.5">
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Write a post to queue for Instagram, TikTok, and LinkedIn..."
              rows={3}
              className="text-base px-4 py-3 rounded-xl outline-none resize-none bg-black/30 text-foreground border border-border placeholder:text-muted"
            />
            <button
              onClick={addContent}
              disabled={!newContent.trim()}
              className="self-start px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5 text-white disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))" }}
            >
              <Plus size={15} /> Add to queue
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {status?.queue.length === 0 && <p className="text-sm italic text-muted">Nothing queued.</p>}
            {status?.queue.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 px-4 py-3 rounded-xl bg-surface3 border border-border"
              >
                <span
                  className="text-xs px-2.5 py-1 rounded-full flex-shrink-0 font-mono"
                  style={{
                    background:
                      item.status === "Posted"
                        ? "rgba(95,191,122,0.15)"
                        : item.status === "Failed"
                        ? "rgba(232,67,10,0.15)"
                        : "var(--color-surface-elevated)",
                    color:
                      item.status === "Posted"
                        ? "#5FBF7A"
                        : item.status === "Failed"
                        ? "var(--color-accent-light)"
                        : "var(--color-muted)",
                  }}
                >
                  {item.status}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">{item.content}</p>
                  {item.notes && <p className="text-xs text-accentLight mt-1">{item.notes}</p>}
                </div>
                <button onClick={() => removeContent(item.id)} className="flex-shrink-0">
                  <Trash2 size={15} color="var(--color-muted)" />
                </button>
              </div>
            ))}
          </div>

          {confirming === "post-content" ? (
            <div className="flex flex-col gap-3 p-4 rounded-xl bg-[rgba(232,67,10,0.08)] border border-[rgba(232,67,10,0.4)]">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={18} color="var(--color-accent-light)" className="flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">
                  This queues every New post above to your live Instagram, TikTok, and LinkedIn via Buffer. Continue?
                </p>
              </div>
              <div className="flex gap-2.5">
                <button
                  onClick={() => runJob("post-content")}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))" }}
                >
                  Yes, post now
                </button>
                <button
                  onClick={() => setConfirming(null)}
                  className="px-5 py-3 rounded-xl text-sm bg-surface3 border border-border text-textSecondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirming("post-content")}
              disabled={running !== null || !status?.queue.some((q) => q.status === "New")}
              className="w-full py-4 rounded-xl text-base font-bold flex items-center justify-center gap-2 text-white transition-all hover:-translate-y-0.5 disabled:opacity-40"
              style={{
                background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))",
                boxShadow: "var(--shadow-cta)",
              }}
            >
              <Megaphone size={18} /> {running === "post-content" ? "Posting..." : "Post queued content now"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
