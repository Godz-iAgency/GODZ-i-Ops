"use client";

import { useLocalStorage } from "@/lib/useLocalStorage";
import { austinDateStr, austinDayOfWeek } from "@/lib/austinDate";
import { Save, Check, Minus, Plus } from "lucide-react";
import { useState } from "react";

const SPRINT_START = "2026-08-25";
const startDate = new Date(SPRINT_START + "T00:00:00");
const todayStr = () => austinDateStr();
const dayNumber = () => Math.round((new Date(todayStr() + "T00:00:00").getTime() - startDate.getTime()) / 86400000) + 1;
const scheduleForToday = () => {
  const dow = austinDayOfWeek();
  if (dow === 6) return { label: "SABBATH", sub: "Rest day, no work scheduled" };
  if (dow === 0) return { label: "4:00 AM - 4:00 PM", sub: "12 hours, Sunday catch-up" };
  return { label: "12:00 PM - 4:00 PM", sub: "4 hours, Monday to Friday" };
};

const BUILD_ITEMS = [
  { key: "godzi", label: "GODZ-i" },
  { key: "splitmic", label: "SplitMic" },
  { key: "bookworm", label: "Bookworm" },
  { key: "gbombs", label: "gBOMBS" },
];

type DayLog = {
  linkedin: boolean;
  instagram: boolean;
  email: boolean;
  content: boolean;
  delivering: boolean;
  deliveryNote: string;
  build: Record<string, boolean>;
  linkedinCount: number;
  instagramCount: number;
  emailCount: number;
  contentCount: number;
};
const emptyLog: DayLog = {
  linkedin: false,
  instagram: false,
  email: false,
  content: false,
  delivering: false,
  deliveryNote: "",
  build: {},
  linkedinCount: 0,
  instagramCount: 0,
  emailCount: 0,
  contentCount: 0,
};

function Counter({ count, onChange }: { count: number; onChange: (n: number) => void }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="flex items-center gap-1 px-1.5 py-1.5 rounded-full bg-black/30 border border-border flex-shrink-0"
    >
      <button
        onClick={() => onChange(Math.max(0, count - 1))}
        aria-label="Decrease count"
        className="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-textSecondary hover:text-white hover:bg-white/[0.06] transition-all"
      >
        <Minus size={14} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={count}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, "");
          onChange(digits === "" ? 0 : parseInt(digits, 10));
        }}
        className="w-9 text-center text-base font-bold bg-transparent outline-none text-foreground font-mono"
      />
      <button
        onClick={() => onChange(count + 1)}
        aria-label="Increase count"
        className="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-white transition-all hover:opacity-90"
        style={{ background: "var(--color-accent)" }}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

function CheckRow({
  checked,
  onToggle,
  label,
  count,
  onCountChange,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  count?: number;
  onCountChange?: (n: number) => void;
}) {
  return (
    <div
      className="row-hover w-full flex items-center gap-3.5 px-5 py-4 rounded-xl text-base"
      style={{
        border: `1px solid ${checked ? "rgba(232,67,10,0.4)" : "var(--color-border)"}`,
        background: checked ? "rgba(232,67,10,0.1)" : "rgba(255,255,255,0.02)",
        color: checked ? "#f2ece5" : "var(--color-muted)",
      }}
    >
      <button onClick={onToggle} className="flex items-center gap-3.5 flex-1 text-left min-w-0">
        <span
          className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center"
          style={{
            border: `1.5px solid ${checked ? "var(--color-accent)" : "rgba(255,255,255,0.25)"}`,
            background: checked ? "var(--color-accent)" : "transparent",
          }}
        >
          {checked && <Check size={14} color="#fff" strokeWidth={3.5} />}
        </span>
        <span className="flex-1 truncate">{label}</span>
      </button>
      {onCountChange && <Counter count={count ?? 0} onChange={onCountChange} />}
    </div>
  );
}

export default function TodayTab() {
  const [logs, setLogs] = useLocalStorage<Record<string, DayLog>>("godzi-daily-logs-2026-07-27", {});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const today = todayStr();
  const day = dayNumber();
  const sched = scheduleForToday();
  const todayLog = { ...emptyLog, ...(logs[today] || {}) };
  const setTodayLog = (patch: Partial<DayLog>) => setLogs({ ...logs, [today]: { ...todayLog, ...patch } });
  const toggleBuild = (key: string) => setTodayLog({ build: { ...todayLog.build, [key]: !todayLog.build[key] } });
  const marketingDone = [todayLog.linkedin, todayLog.instagram, todayLog.email, todayLog.content].filter(Boolean).length;

  const saveToday = () => {
    setLogs({
      ...logs,
      [today]: { ...todayLog, linkedinCount: 0, instagramCount: 0, emailCount: 0, contentCount: 0 },
    });
    setSavedAt(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
  };

  return (
    <div className="flex flex-col gap-8 max-w-[900px] mx-auto">
      <div>
        <p className="text-sm tracking-[0.3em] uppercase text-accent font-bold font-mono mb-2">
          GODZ-i / Command Center
        </p>
        <h1 className="text-[44px] sm:text-[56px] font-extrabold tracking-[-0.03em] leading-none text-foreground">
          {day < 1 ? "SPRINT STARTS JUL 27" : `DAY ${Math.min(day, 100)} OF 100`}
        </h1>
        <p className="text-base text-muted font-mono mt-3">
          {sched.label} · {sched.sub}
        </p>
      </div>

      <section>
        <h2 className="text-sm uppercase tracking-[0.14em] text-muted font-mono mb-3.5">
          Marketing · 1 hour · {marketingDone}/4
        </h2>
        <div className="flex flex-col gap-2.5">
          <CheckRow
            label="10 LinkedIn outreach sent, talent buyers, record labels, and festivals"
            checked={todayLog.linkedin}
            onToggle={() => setTodayLog({ linkedin: !todayLog.linkedin })}
            count={todayLog.linkedinCount}
            onCountChange={(n) => setTodayLog({ linkedinCount: n })}
          />
          <CheckRow
            label="5 Instagram outreach sent, bands and venues"
            checked={todayLog.instagram}
            onToggle={() => setTodayLog({ instagram: !todayLog.instagram })}
            count={todayLog.instagramCount}
            onCountChange={(n) => setTodayLog({ instagramCount: n })}
          />
          <CheckRow
            label="5 email contacts pulled, gBOMBS outreach sent"
            checked={todayLog.email}
            onToggle={() => setTodayLog({ email: !todayLog.email })}
            count={todayLog.emailCount}
            onCountChange={(n) => setTodayLog({ emailCount: n })}
          />
          <CheckRow
            label="Today's content posted"
            checked={todayLog.content}
            onToggle={() => setTodayLog({ content: !todayLog.content })}
            count={todayLog.contentCount}
            onCountChange={(n) => setTodayLog({ contentCount: n })}
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-[0.14em] text-muted font-mono mb-3.5">Building · 2 hours</h2>
        <div className="flex flex-col gap-2.5">
          {BUILD_ITEMS.map((item) => (
            <CheckRow key={item.key} label={item.label} checked={!!todayLog.build[item.key]} onToggle={() => toggleBuild(item.key)} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-[0.14em] text-muted font-mono mb-3.5">Delivering · 1 hour</h2>
        <div className="flex flex-col gap-2.5">
          <CheckRow label="Sent an update or talked to an active client today" checked={todayLog.delivering} onToggle={() => setTodayLog({ delivering: !todayLog.delivering })} />
          <textarea
            value={todayLog.deliveryNote}
            onChange={(e) => setTodayLog({ deliveryNote: e.target.value })}
            placeholder="What did you deliver or communicate today?"
            rows={3}
            className="text-base px-5 py-4 rounded-xl outline-none resize-none text-foreground border border-border bg-white/[0.02] placeholder:text-muted"
          />
        </div>
      </section>

      <button
        onClick={saveToday}
        className="w-full py-5 rounded-xl text-lg font-bold flex items-center justify-center gap-2 text-white transition-all hover:-translate-y-0.5"
        style={{
          background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))",
          boxShadow: "var(--shadow-cta)",
        }}
      >
        <Save size={19} /> Save today
      </button>
      {savedAt && <p className="text-sm text-center text-muted">Saved at {savedAt}</p>}
    </div>
  );
}
