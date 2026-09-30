"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock3, ExternalLink, MailCheck, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";

type CleanupLog = {
  "Run At"?: string;
  Trigger?: string;
  "Moved to Trash"?: number;
  Status?: string;
};

type CleanupStatus = {
  retentionDays: number;
  reviewBufferDays: number;
  reviewQueue: number;
  readyToTrash: number;
  recoverableInTrash: number;
  batchLimit: number;
  lastRun: CleanupLog | null;
  schedule: string;
  newCandidates?: number;
  movedToTrash?: number;
  error?: string;
};

function MetricCard({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface2 p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-2 text-3xl font-extrabold text-foreground">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{note}</p>
    </div>
  );
}

export default function EmailTab() {
  const [status, setStatus] = useState<CleanupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/email-cleanup", { cache: "no-store" });
      const data = (await response.json()) as CleanupStatus;
      if (!response.ok) throw new Error(data.error || "Unable to load email cleanup status");
      setStatus(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load email cleanup status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runCleanup = async () => {
    setRunning(true);
    setMessage("");
    try {
      const response = await fetch("/api/email-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "MOVE_REVIEWED_EMAIL_TO_TRASH" }),
      });
      const data = (await response.json()) as CleanupStatus;
      if (!response.ok) throw new Error(data.error || "Email cleanup failed");
      setStatus(data);
      setConfirmOpen(false);
      setMessage(`Cleanup complete: ${data.movedToTrash || 0} messages moved to Trash and ${data.newCandidates || 0} new candidates added for review.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Email cleanup failed");
    } finally {
      setRunning(false);
    }
  };

  const lastRun = status?.lastRun?.["Run At"]
    ? new Date(status.lastRun["Run At"]).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    : "No automated run yet";

  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-5 sm:gap-6">
      <header className="rounded-2xl border border-border bg-surface2 p-5 sm:p-7">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-accentLight">Email maintenance</p>
        <div className="mt-3 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <h1 className="text-[clamp(1.8rem,6vw,2.6rem)] font-extrabold leading-tight text-foreground">Keep the inbox clean automatically.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Routine platform notifications are reviewed after 30 days. Protected business, personal, financial, legal, security, starred, SplitMic and Bookworm mail is never selected.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href="https://mail.google.com/mail/u/0/#label/Cleanup+Review"
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-white/[0.035] px-4 text-sm font-semibold text-textSecondary hover:bg-white/[0.06]"
            >
              Review in Gmail <ExternalLink size={15} />
            </a>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={loading || running || !status?.readyToTrash}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white shadow-[0_8px_24px_rgba(232,67,10,0.24)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Trash2 size={15} /> Run cleanup now
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Retention" value={`${status?.retentionDays ?? 30} days`} note="Nothing is selected before this age." />
        <MetricCard label="Review buffer" value={`${status?.reviewBufferDays ?? 7} days`} note="Time to inspect Cleanup Review before Trash." />
        <MetricCard label="Review queue" value={loading ? "—" : status?.reviewQueue ?? 0} note="Candidates still outside Trash." />
        <MetricCard label="Ready now" value={loading ? "—" : status?.readyToTrash ?? 0} note="Eligible for the next cleanup run." />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-2xl border border-border bg-surface2 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-accent/15 text-accentLight"><MailCheck size={20} /></div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Weekly automatic cleanup</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{status?.schedule || "Every Sunday around 3–4 AM Central"}. Each run processes up to {status?.batchLimit || 400} reviewed messages, then records the result in Google Sheets.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-black/20 p-4"><p className="text-xs uppercase tracking-[0.12em] text-muted">Last run</p><p className="mt-2 text-sm font-semibold text-foreground">{lastRun}</p></div>
            <div className="rounded-xl border border-border bg-black/20 p-4"><p className="text-xs uppercase tracking-[0.12em] text-muted">Trigger</p><p className="mt-2 text-sm font-semibold text-foreground">{status?.lastRun?.Trigger || "—"}</p></div>
            <div className="rounded-xl border border-border bg-black/20 p-4"><p className="text-xs uppercase tracking-[0.12em] text-muted">Trash recovery</p><p className="mt-2 text-sm font-semibold text-foreground">{loading ? "—" : `${status?.recoverableInTrash || 0} messages`}</p></div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface2 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-accentLight" /><h2 className="font-bold text-foreground">Safety rules</h2></div>
            <button onClick={load} disabled={loading || running} className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted hover:text-foreground" aria-label="Refresh cleanup status"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></button>
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
            <li>• Seven days to review every candidate.</li>
            <li>• Gmail Trash keeps another 30-day recovery window.</li>
            <li>• No permanent-delete API is used.</li>
            <li>• Protected labels and subjects are excluded every run.</li>
          </ul>
        </div>
      </section>

      {message && <div className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accentLight">{message}</div>}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surfaceElevated p-5 shadow-2xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="cleanup-confirm-title">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-accentLight">Confirm cleanup</p>
                <h2 id="cleanup-confirm-title" className="mt-2 text-xl font-extrabold text-foreground">Move reviewed messages to Trash?</h2>
              </div>
              <button onClick={() => setConfirmOpen(false)} disabled={running} className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-white/5" aria-label="Close confirmation"><X size={18} /></button>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              This run can move up to {status?.batchLimit || 400} messages that are older than {status ? status.retentionDays + status.reviewBufferDays : 37} days and already passed the protection rules. Gmail will keep them recoverable in Trash for 30 more days.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-black/20 px-4 py-3 text-sm text-textSecondary"><Clock3 size={16} className="text-accentLight" />Currently ready: {status?.readyToTrash || 0}</div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={() => setConfirmOpen(false)} disabled={running} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold text-textSecondary">Cancel</button>
              <button onClick={runCleanup} disabled={running} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-white disabled:opacity-60">{running ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />}{running ? "Cleaning…" : "Move to Trash"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
