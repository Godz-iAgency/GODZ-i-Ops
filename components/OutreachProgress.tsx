"use client";

import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    setMetric(BUSINESS_METRICS[business][0]);
  }, [business]);

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
