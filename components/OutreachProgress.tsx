"use client";

import { useEffect, useMemo, useState } from "react";
import { austinDateStr } from "@/lib/austinDate";
import {
  outreachProgressColor,
  outreachProgressPercent,
  outreachProgressTone,
} from "@/lib/outreachProgress";

export type OutreachBusiness = "SplitMic" | "Bookworm";

export type OutreachCounts = {
  splitmicLinkedIn: number;
  splitmicEmail: number;
  bookwormTikTok: number;
  bookwormEmail: number;
  splitmicCalls: number;
  bookwormCalls: number;
};

export type OutreachTargets = {
  splitmicLinkedIn: number;
  splitmicEmail: number;
  bookwormTikTok: number;
  bookwormEmail: number;
  splitmicCalls: number;
  bookwormCalls: number;
};

type MetricKey = keyof OutreachCounts;

const METRICS: Record<MetricKey, { label: string }> = {
  splitmicLinkedIn: { label: "LinkedIn connections" },
  splitmicEmail: { label: "SplitMic emails" },
  bookwormTikTok: { label: "TikTok messages" },
  bookwormEmail: { label: "Bookworm emails" },
  splitmicCalls: { label: "SplitMic cold calls" },
  bookwormCalls: { label: "Bookworm cold calls" },
};

const BUSINESS_METRICS: Record<OutreachBusiness, MetricKey[]> = {
  SplitMic: ["splitmicLinkedIn", "splitmicEmail", "splitmicCalls"],
  Bookworm: ["bookwormTikTok", "bookwormEmail", "bookwormCalls"],
};

type HistoricalProgress = {
  Date?: string;
  "Emails Sent"?: number;
  "LinkedIn Sent"?: number;
  "Bookworm Emails Sent"?: number;
  "Bookworm TikTok Sent"?: number;
  "SplitMic Calls Made"?: number;
  "Bookworm Calls Made"?: number;
};

function totalCounts(counts: OutreachCounts): number {
  return Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
}

function rowTotal(row: HistoricalProgress): number {
  return Number(row["LinkedIn Sent"] || 0) +
    Number(row["Emails Sent"] || 0) +
    Number(row["Bookworm TikTok Sent"] || 0) +
    Number(row["Bookworm Emails Sent"] || 0) +
    Number(row["SplitMic Calls Made"] || 0) +
    Number(row["Bookworm Calls Made"] || 0);
}

function mondayFor(date: string): string {
  const value = new Date(`${date}T12:00:00Z`);
  const weekday = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - weekday + 1);
  return value.toISOString().slice(0, 10);
}

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function percentLabel(count: number, target: number): string {
  if (target <= 0) return "0%";
  const value = Math.min(100, (Math.max(0, count) / target) * 100);
  return `${Number(value.toFixed(1))}%`;
}

export function OutreachProgressBar({
  count,
  target,
  label,
  showValue = true,
}: {
  count: number;
  target: number;
  label: string;
  showValue?: boolean;
}) {
  const percentage = outreachProgressPercent(count, target);
  const tone = outreachProgressTone(count, target);
  const color = outreachProgressColor(count, target);

  return (
    <div className="min-w-0" data-progress-tone={tone}>
      {showValue && (
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="truncate text-sm font-semibold text-foreground">{label}</span>
          <span className="flex-shrink-0 font-mono text-sm text-textSecondary">
            {count} / {target}
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-label={`${label}: ${count} of ${target}`}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, target)}
        aria-valuenow={Math.min(Math.max(0, count), Math.max(0, target))}
        className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.08]"
      >
        <div
          className="h-full rounded-full transition-[width,background-color] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function DailyOutreachProgress({
  business,
  counts,
  targets,
}: {
  business: OutreachBusiness;
  counts: OutreachCounts;
  targets: OutreachTargets;
}) {
  const available = BUSINESS_METRICS[business];
  const [metric, setMetric] = useState<MetricKey>(available[0]);
  const [savedWeekExcludingToday, setSavedWeekExcludingToday] = useState(0);

  const today = austinDateStr();
  const dailyTotal = totalCounts(counts);
  const dailyTarget = totalCounts(targets);
  const weeklyTarget = dailyTarget * 5;
  const todayIsWeekday = new Date(`${today}T12:00:00Z`).getUTCDay() >= 1 && new Date(`${today}T12:00:00Z`).getUTCDay() <= 5;
  const weeklyTotal = savedWeekExcludingToday + (todayIsWeekday ? dailyTotal : 0);

  useEffect(() => {
    setMetric(BUSINESS_METRICS[business][0]);
  }, [business]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/progress?all=1");
        if (!response.ok) return;
        const data = (await response.json()) as { days?: HistoricalProgress[] };
        if (!active) return;
        const monday = mondayFor(today);
        const friday = addDays(monday, 4);
        const total = (data.days || [])
          .filter((row) => !!row.Date && row.Date >= monday && row.Date <= friday && row.Date !== today)
          .reduce((sum, row) => sum + rowTotal(row), 0);
        setSavedWeekExcludingToday(total);
      } catch {
        // Daily tracking remains available if the weekly rollup cannot load.
      }
    })();
    return () => {
      active = false;
    };
  }, [today]);

  const selected = useMemo(() => {
    const safeMetric = available.includes(metric) ? metric : available[0];
    return {
      key: safeMetric,
      label: METRICS[safeMetric].label,
      count: counts[safeMetric],
      target: targets[safeMetric],
    };
  }, [available, counts, metric, targets]);

  return (
    <section className="rounded-2xl border border-border bg-surface2/75 p-4 sm:p-5" aria-label="Daily outreach progress">
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-black/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Daily outreach</p>
              <p className="mt-1 text-2xl font-extrabold text-foreground">{dailyTotal} / {dailyTarget}</p>
            </div>
            <span className="font-mono text-sm font-bold text-textSecondary">{percentLabel(dailyTotal, dailyTarget)}</span>
          </div>
          <p className="mb-3 mt-1 text-sm text-textSecondary">{Math.max(0, dailyTarget - dailyTotal)} remaining today</p>
          <OutreachProgressBar count={dailyTotal} target={dailyTarget} label="Total daily outreach" showValue={false} />
        </div>
        <div className="rounded-xl border border-border bg-black/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Weekly outreach</p>
              <p className="mt-1 text-2xl font-extrabold text-foreground">{weeklyTotal} / {weeklyTarget}</p>
            </div>
            <span className="font-mono text-sm font-bold text-textSecondary">{percentLabel(weeklyTotal, weeklyTarget)}</span>
          </div>
          <p className="mb-3 mt-1 text-sm text-textSecondary">{Math.max(0, weeklyTarget - weeklyTotal)} remaining this week</p>
          <OutreachProgressBar count={weeklyTotal} target={weeklyTarget} label="Total weekly outreach" showValue={false} />
        </div>
      </div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accentLight">Daily progress</p>
          <p className="mt-1 text-sm text-textSecondary">Updates from the same outreach records shown across the app.</p>
        </div>
        <label className="flex min-w-0 flex-col gap-1.5 sm:w-56">
          <span className="px-1 text-xs font-medium uppercase tracking-[0.1em] text-muted">Outreach type</span>
          <select
            value={selected.key}
            onChange={(event) => setMetric(event.target.value as MetricKey)}
            className="min-h-11 w-full rounded-xl border border-border bg-black/30 px-3 text-sm font-semibold text-foreground outline-none focus:border-accent"
          >
            {available.map((key) => (
              <option key={key} value={key}>{METRICS[key].label}</option>
            ))}
          </select>
        </label>
      </div>
      <OutreachProgressBar count={selected.count} target={selected.target} label={selected.label} />
      <div className="mt-3 grid grid-cols-4 gap-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-muted sm:text-xs">
        <span className="border-t-2 border-[#ff453a] pt-1.5">Red</span>
        <span className="border-t-2 border-[#ff9f0a] pt-1.5">Orange</span>
        <span className="border-t-2 border-[#0a84ff] pt-1.5">Blue</span>
        <span className="border-t-2 border-[#30d158] pt-1.5">Green</span>
      </div>
    </section>
  );
}
