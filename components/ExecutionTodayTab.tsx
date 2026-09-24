"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Minus, Plus, Save, Settings2 } from "lucide-react";
import { austinDateStr } from "@/lib/austinDate";
import { dayNumber } from "@/lib/sprint";

type Settings = {
  "SplitMic LinkedIn Target": number;
  "SplitMic Email Target": number;
  "Bookworm TikTok Target": number;
  "Bookworm Email Target": number;
};

type Progress = {
  Date?: string;
  "Day Number"?: number;
  Weekday?: string;
  "Emails Sent"?: number;
  "LinkedIn Sent"?: number;
  "Bookworm Emails Sent"?: number;
  "Bookworm TikTok Sent"?: number;
  "Build Project"?: string;
  "Build Objective"?: string;
  "Build Status"?: string;
  "Build Completed"?: boolean;
  "Build Notes"?: string;
  "Delivery Objective"?: string;
  "Delivery Status"?: string;
  "Delivery Recipient"?: string;
  "Delivery Link"?: string;
  "Delivery Notes"?: string;
  "Deliver Completed"?: boolean;
};

type FollowUp = {
  id: string;
  source: string;
  project: "Splitmic" | "Bookworm";
  channel: "LinkedIn" | "TikTok" | "Email" | "Other";
  name: string;
  company?: string;
  action?: string;
  profileUrl?: string;
};

type Daily = {
  settings: Settings;
  progress: Progress | null;
  counts: {
    splitmicLinkedIn: number;
    splitmicEmail: number;
    bookwormTikTok: number;
    bookwormEmail: number;
  };
  followUps: FollowUp[];
};

type Weekly = {
  rows: Array<{
    date: string;
    marketingComplete: boolean;
    buildComplete: boolean;
    deliveryComplete: boolean;
  }>;
  totals: Daily["counts"];
  settings: Settings;
};

const DEFAULT_SETTINGS: Settings = {
  "SplitMic LinkedIn Target": 10,
  "SplitMic Email Target": 5,
  "Bookworm TikTok Target": 10,
  "Bookworm Email Target": 5,
};

const EMPTY_PROGRESS: Progress = {
  "Emails Sent": 0,
  "LinkedIn Sent": 0,
  "Bookworm Emails Sent": 0,
  "Bookworm TikTok Sent": 0,
  "Build Project": "",
  "Build Objective": "",
  "Build Status": "Not Started",
  "Build Completed": false,
  "Build Notes": "",
  "Delivery Objective": "",
  "Delivery Status": "Not Started",
  "Delivery Recipient": "",
  "Delivery Link": "",
  "Delivery Notes": "",
  "Deliver Completed": false,
};

const fieldClass =
  "w-full rounded-xl border border-border bg-black/25 px-4 py-3 text-base text-foreground outline-none placeholder:text-muted focus:border-accent";
const cardClass = "rounded-2xl border border-border bg-surface2 p-4 sm:p-6";
const STATUSES = ["Not Started", "In Progress", "Complete"];

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function Counter({ value, target, onChange }: { value: number; target: number; onChange: (value: number) => void }) {
  const done = value >= target;
  return (
    <div className="flex w-full items-center justify-between gap-1 rounded-full border border-border bg-black/25 p-1 min-[420px]:w-auto min-[420px]:justify-start">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-white/[0.06] hover:text-white"
        aria-label="Decrease"
      >
        <Minus size={14} />
      </button>
      <input
        aria-label="Completed actions"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value.replace(/\D/g, "")) || 0))}
        className="w-12 bg-transparent text-center font-mono text-sm font-bold text-foreground outline-none"
      />
      <span className={done ? "pr-1 text-xs font-bold text-accentLight" : "pr-1 text-xs text-muted"}>/ {target}</span>
      <button
        onClick={() => onChange(value + 1)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white"
        aria-label="Increase"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

function StatusDot({ done }: { done: boolean }) {
  return (
    <span
      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border"
      style={{
        background: done ? "var(--color-accent)" : "transparent",
        borderColor: done ? "var(--color-accent)" : "var(--color-border)",
      }}
    >
      {done && <Check size={14} strokeWidth={3} />}
    </span>
  );
}

function QueueLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1 text-sm font-semibold text-accentLight hover:text-white"
    >
      {children} <ChevronRight size={14} />
    </a>
  );
}

export default function ExecutionTodayTab() {
  const today = austinDateStr();
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [weekly, setWeekly] = useState<Weekly | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/execution?date=${today}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load today");
      const daily = data.daily as Daily;
      const saved = daily.progress || {};
      setSettings(daily.settings || DEFAULT_SETTINGS);
      setProgress({
        ...EMPTY_PROGRESS,
        ...saved,
        "LinkedIn Sent": Math.max(Number(saved["LinkedIn Sent"] || 0), daily.counts.splitmicLinkedIn),
        "Emails Sent": Math.max(Number(saved["Emails Sent"] || 0), daily.counts.splitmicEmail),
        "Bookworm TikTok Sent": Math.max(
          Number(saved["Bookworm TikTok Sent"] || 0),
          daily.counts.bookwormTikTok
        ),
        "Bookworm Emails Sent": Math.max(
          Number(saved["Bookworm Emails Sent"] || 0),
          daily.counts.bookwormEmail
        ),
        "Build Status": saved["Build Status"] || (saved["Build Completed"] ? "Complete" : "Not Started"),
        "Delivery Status":
          saved["Delivery Status"] || (saved["Deliver Completed"] ? "Complete" : "Not Started"),
      });
      setFollowUps(daily.followUps || []);
      setWeekly(data.weekly as Weekly);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load today");
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (patch: Partial<Progress>) => setProgress((current) => ({ ...current, ...patch }));
  const counts = {
    splitmicLinkedIn: Number(progress["LinkedIn Sent"] || 0),
    splitmicEmail: Number(progress["Emails Sent"] || 0),
    bookwormTikTok: Number(progress["Bookworm TikTok Sent"] || 0),
    bookwormEmail: Number(progress["Bookworm Emails Sent"] || 0),
  };
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const target = Object.values(settings).reduce((sum, value) => sum + value, 0);
  const marketingComplete = total >= target;
  const buildComplete = progress["Build Status"] === "Complete";
  const deliveryComplete = progress["Delivery Status"] === "Complete";
  const blocksComplete = [marketingComplete, buildComplete, deliveryComplete].filter(Boolean).length;
  const percentage = target ? Math.min(100, Math.round((total / target) * 100)) : 100;

  const nextAction = useMemo(() => {
    if (followUps.length) return `Start with ${followUps.length} follow-up${followUps.length === 1 ? "" : "s"} due today.`;
    if (counts.splitmicLinkedIn < settings["SplitMic LinkedIn Target"]) return "Send the next Splitmic LinkedIn connection.";
    if (counts.bookwormTikTok < settings["Bookworm TikTok Target"]) return "Contact the next qualified Bookworm TikTok creator.";
    if (counts.bookwormEmail < settings["Bookworm Email Target"]) return "Send the next Bookworm consultant email.";
    if (counts.splitmicEmail < settings["SplitMic Email Target"]) return "Send the next Splitmic email.";
    if (!buildComplete) return "Move to today’s single build objective.";
    if (!deliveryComplete) return "Finish today’s delivery objective.";
    return "The day is complete.";
  }, [buildComplete, counts, deliveryComplete, followUps.length, settings]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        ...progress,
        Date: today,
        "Day Number": dayNumber(),
        Weekday: new Date(`${today}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" }),
        "Build Completed": buildComplete,
        "Deliver Completed": deliveryComplete,
      };
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save today");
      setProgress((current) => ({ ...current, ...data.progress }));
      setSavedAt(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save today");
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    setSettingsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save targets");
      setSettings(data.settings);
      setSettingsOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save targets");
    } finally {
      setSettingsSaving(false);
    }
  };

  if (loading) return <p className="mx-auto max-w-[920px] text-base italic text-muted">Loading today…</p>;

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-4 sm:gap-6">
      <header>
        <p className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-accent">Today</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3 sm:items-end">
          <div className="min-w-0">
            <h1 className="text-[clamp(2rem,8vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.04em] text-foreground">
              {formatDate(today)}
            </h1>
            <p className="mt-2 text-base text-muted">12:00 PM–4:00 PM · {blocksComplete} / 3 blocks complete</p>
          </div>
          <button
            onClick={() => setSettingsOpen((open) => !open)}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-surface2 px-4 py-2.5 text-sm text-textSecondary hover:border-accent hover:text-white min-[420px]:w-auto"
          >
            <Settings2 size={15} /> Targets
          </button>
        </div>
      </header>

      <section className="rounded-2xl border border-[rgba(232,67,10,0.42)] bg-[rgba(232,67,10,0.1)] p-4 sm:p-5">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-accentLight">Execute next</p>
        <p className="mt-2 text-lg font-bold leading-snug text-foreground sm:text-xl">{nextAction}</p>
      </section>

      {error && (
        <div className="rounded-xl border border-[rgba(232,67,10,0.4)] bg-[rgba(232,67,10,0.1)] px-4 py-3 text-sm text-accentLight">
          {error}
        </div>
      )}

      {settingsOpen && (
        <section className={cardClass}>
          <h2 className="text-lg font-bold text-foreground">Daily marketing targets</h2>
          <p className="mt-1 text-sm text-muted">Saved in Airtable. Changes apply without a code update.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(Object.keys(settings) as Array<keyof Settings>).map((key) => (
              <label key={key} className="text-sm text-textSecondary">
                {key.replace(" Target", "")}
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={settings[key]}
                  onChange={(event) => setSettings({ ...settings, [key]: Number(event.target.value) })}
                  className={`${fieldClass} mt-1.5`}
                />
              </label>
            ))}
          </div>
          <button
            onClick={saveSettings}
            disabled={settingsSaving}
            className="mt-4 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {settingsSaving ? "Saving…" : "Save targets"}
          </button>
        </section>
      )}

      {followUps.length > 0 && (
        <section className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-accentLight">Due today</p>
              <h2 className="mt-1 text-lg font-bold text-foreground">{followUps.length} follow-ups</h2>
            </div>
            <QueueLink href="/?tab=outreach&followup=today">Open Outreach</QueueLink>
          </div>
          <div className="mt-4 divide-y divide-border">
            {followUps.slice(0, 6).map((item) => (
              <div key={`${item.source}-${item.id}`} className="flex items-center gap-3 py-3">
                <span className="rounded-full bg-black/30 px-2.5 py-1 text-xs text-muted">{item.channel}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="truncate text-xs text-muted">{item.action || item.company || item.project}</p>
                </div>
                {item.profileUrl && (
                  <a href={item.profileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-accentLight">
                    Open
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={cardClass}>
        <div className="flex items-start gap-3">
          <StatusDot done={marketingComplete} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-accentLight">Marketing</p>
                <h2 className="mt-1 text-xl font-bold text-foreground">12:00 PM–2:00 PM</h2>
              </div>
              <p className="font-mono text-sm font-bold text-foreground">{total} / {target}</p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/35">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${percentage}%` }} />
            </div>
            <div className="mt-5 divide-y divide-border">
              <div className="grid grid-cols-1 gap-3 py-3 min-[420px]:grid-cols-[1fr_auto] min-[420px]:items-center">
                <div><p className="font-semibold text-foreground">Splitmic LinkedIn</p><QueueLink href="/?tab=outreach&business=SplitMic&pipeline=social">Open queue</QueueLink></div>
                <Counter value={counts.splitmicLinkedIn} target={settings["SplitMic LinkedIn Target"]} onChange={(value) => set({ "LinkedIn Sent": value })} />
              </div>
              <div className="grid grid-cols-1 gap-3 py-3 min-[420px]:grid-cols-[1fr_auto] min-[420px]:items-center">
                <div><p className="font-semibold text-foreground">Bookworm TikTok</p><QueueLink href="/?tab=outreach&business=Bookworm&pipeline=social">Qualified creators</QueueLink></div>
                <Counter value={counts.bookwormTikTok} target={settings["Bookworm TikTok Target"]} onChange={(value) => set({ "Bookworm TikTok Sent": value })} />
              </div>
              <div className="grid grid-cols-1 gap-3 py-3 min-[420px]:grid-cols-[1fr_auto] min-[420px]:items-center">
                <div><p className="font-semibold text-foreground">Bookworm Email</p><QueueLink href="/?tab=outreach&business=Bookworm&pipeline=email">Open queue</QueueLink></div>
                <Counter value={counts.bookwormEmail} target={settings["Bookworm Email Target"]} onChange={(value) => set({ "Bookworm Emails Sent": value })} />
              </div>
              <div className="grid grid-cols-1 gap-3 py-3 min-[420px]:grid-cols-[1fr_auto] min-[420px]:items-center">
                <div><p className="font-semibold text-foreground">Splitmic Email</p><QueueLink href="/?tab=outreach&business=SplitMic&pipeline=email">Open queue</QueueLink></div>
                <Counter value={counts.splitmicEmail} target={settings["SplitMic Email Target"]} onChange={(value) => set({ "Emails Sent": value })} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <section className={cardClass}>
          <div className="flex items-start gap-3">
            <StatusDot done={buildComplete} />
            <div className="min-w-0 flex-1">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-accentLight">Building</p>
            <h2 className="mt-1 text-xl font-bold text-foreground">2:00 PM–3:00 PM</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[0.8fr_1.2fr]">
              <input value={progress["Build Project"] || ""} onChange={(event) => set({ "Build Project": event.target.value })} placeholder="Project" className={fieldClass} />
              <input value={progress["Build Objective"] || ""} onChange={(event) => set({ "Build Objective": event.target.value })} placeholder="One primary objective" className={fieldClass} />
            </div>
            <select value={progress["Build Status"] || "Not Started"} onChange={(event) => set({ "Build Status": event.target.value })} className={`${fieldClass} mt-3`}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
            <textarea value={progress["Build Notes"] || ""} onChange={(event) => set({ "Build Notes": event.target.value })} placeholder="Notes" rows={2} className={`${fieldClass} mt-3 resize-none`} />
            </div>
          </div>
        </section>

        <section className={cardClass}>
          <div className="flex items-start gap-3">
            <StatusDot done={deliveryComplete} />
            <div className="min-w-0 flex-1">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-accentLight">Delivering</p>
            <h2 className="mt-1 text-xl font-bold text-foreground">3:00 PM–4:00 PM</h2>
            <input value={progress["Delivery Objective"] || ""} onChange={(event) => set({ "Delivery Objective": event.target.value })} placeholder="One primary deliverable" className={`${fieldClass} mt-4`} />
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select value={progress["Delivery Status"] || "Not Started"} onChange={(event) => set({ "Delivery Status": event.target.value })} className={fieldClass}>
                {STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
              <input value={progress["Delivery Recipient"] || ""} onChange={(event) => set({ "Delivery Recipient": event.target.value })} placeholder="Recipient (optional)" className={fieldClass} />
            </div>
            <input value={progress["Delivery Link"] || ""} onChange={(event) => set({ "Delivery Link": event.target.value })} placeholder="Link (optional)" className={`${fieldClass} mt-3`} />
            <textarea value={progress["Delivery Notes"] || ""} onChange={(event) => set({ "Delivery Notes": event.target.value })} placeholder="Notes (optional)" rows={2} className={`${fieldClass} mt-3 resize-none`} />
            </div>
          </div>
        </section>
      </div>

      {weekly && (
        <section className={cardClass}>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-accentLight">This week</p>
          <div className="mt-4 divide-y divide-border">
              {weekly.rows.map((row) => (
                <div key={row.date} className="grid grid-cols-[52px_repeat(3,minmax(0,1fr))] gap-1 py-2.5 text-xs min-[420px]:grid-cols-[70px_repeat(3,minmax(0,1fr))] min-[420px]:gap-3 sm:text-sm">
                  <span className="font-mono font-bold text-foreground">{new Date(`${row.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</span>
                  <span className={`${row.marketingComplete ? "text-foreground" : "text-muted"} truncate text-center`}>Marketing {row.marketingComplete ? "✓" : "·"}</span>
                  <span className={`${row.buildComplete ? "text-foreground" : "text-muted"} truncate text-center`}>Build {row.buildComplete ? "✓" : "·"}</span>
                  <span className={`${row.deliveryComplete ? "text-foreground" : "text-muted"} truncate text-center`}>Deliver {row.deliveryComplete ? "✓" : "·"}</span>
                </div>
              ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <p className="text-muted">LinkedIn <strong className="block text-foreground">{weekly.totals.splitmicLinkedIn}/{settings["SplitMic LinkedIn Target"] * 5}</strong></p>
            <p className="text-muted">TikTok <strong className="block text-foreground">{weekly.totals.bookwormTikTok}/{settings["Bookworm TikTok Target"] * 5}</strong></p>
            <p className="text-muted">Bookworm Email <strong className="block text-foreground">{weekly.totals.bookwormEmail}/{settings["Bookworm Email Target"] * 5}</strong></p>
            <p className="text-muted">Splitmic Email <strong className="block text-foreground">{weekly.totals.splitmicEmail}/{settings["SplitMic Email Target"] * 5}</strong></p>
          </div>
        </section>
      )}

      <div className="sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-10 lg:bottom-4">
        <button
          onClick={save}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-4 text-base font-bold text-white shadow-[0_12px_30px_rgba(232,67,10,0.28)] disabled:opacity-50"
        >
          <Save size={18} /> {saving ? "Saving…" : "Save today"}
        </button>
        {savedAt && <p className="mt-2 text-center text-xs text-muted">Saved at {savedAt}</p>}
      </div>
    </div>
  );
}
