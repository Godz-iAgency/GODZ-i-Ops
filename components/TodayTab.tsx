"use client";

import { useLocalStorage } from "@/lib/useLocalStorage";
import { Linkedin, Instagram, Mail, FileText, Send, Save, Check } from "lucide-react";
import { useState } from "react";

const SPRINT_START = "2026-07-14";
const startDate = new Date(SPRINT_START + "T00:00:00");
const todayStr = () => new Date().toISOString().slice(0, 10);
const dayNumber = () => Math.round((new Date(todayStr() + "T00:00:00").getTime() - startDate.getTime()) / 86400000) + 1;
const scheduleForToday = () => {
  const dow = new Date().getDay();
  if (dow === 6) return { label: "SABBATH", sub: "Rest day, no work scheduled" };
  if (dow === 0) return { label: "4:00 AM - 4:00 PM", sub: "12 hours, Sunday catch-up" };
  return { label: "12:00 PM - 4:00 PM", sub: "4 hours, Monday to Friday" };
};

const BUILD_ITEMS = [
  { key: "godzi", label: "GODZ-i" },
  { key: "splitmic", label: "SplitMic" },
  { key: "bookworm", label: "Bookworm" },
  { key: "gbombs", label: "gBOMBS" },
  { key: "launchpad", label: "Band Launchpad build" },
  { key: "talentpipeline", label: "Talent Buyer Pipeline build" },
];

type DayLog = {
  linkedin: boolean;
  instagram: boolean;
  email: boolean;
  content: boolean;
  delivering: boolean;
  deliveryNote: string;
  build: Record<string, boolean>;
};
const emptyLog: DayLog = { linkedin: false, instagram: false, email: false, content: false, delivering: false, deliveryNote: "", build: {} };

function CheckRow({ checked, onToggle, icon: Icon, label }: any) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left border"
      style={{ background: checked ? "rgba(240,69,31,0.14)" : "#1F1F1F", borderColor: checked ? "#F0451F" : "#2C2C2C" }}
    >
      <div
        className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border"
        style={{ background: checked ? "#F0451F" : "transparent", borderColor: checked ? "#F0451F" : "#999" }}
      >
        {checked && <Check size={13} color="#fff" strokeWidth={3} />}
      </div>
      {Icon && <Icon size={15} color={checked ? "#F0451F" : "#999"} className="flex-shrink-0" />}
      <span className="text-sm" style={{ color: checked ? "#fff" : "#999" }}>
        {label}
      </span>
    </button>
  );
}

export default function TodayTab() {
  const [logs, setLogs] = useLocalStorage<Record<string, DayLog>>("godzi-daily-logs", {});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const today = todayStr();
  const day = dayNumber();
  const sched = scheduleForToday();
  const todayLog = { ...emptyLog, ...(logs[today] || {}) };
  const setTodayLog = (patch: Partial<DayLog>) => setLogs({ ...logs, [today]: { ...todayLog, ...patch } });
  const toggleBuild = (key: string) => setTodayLog({ build: { ...todayLog.build, [key]: !todayLog.build[key] } });
  const marketingDone = [todayLog.linkedin, todayLog.instagram, todayLog.email, todayLog.content].filter(Boolean).length;

  const saveToday = () => {
    setLogs({ ...logs, [today]: todayLog });
    setSavedAt(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
  };

  return (
    <div className="flex flex-col gap-5 max-w-xl mx-auto">
      <div>
        <p className="text-[10px] tracking-[0.3em] uppercase text-[#F0451F] font-mono">GODZ-i / Command Center</p>
        <h1 className="text-3xl font-display">{day < 1 ? "SPRINT STARTS JUL 14" : `DAY ${Math.min(day, 100)} OF 100`}</h1>
        <p className="text-xs text-[#999] font-mono mt-1">
          {sched.label} · {sched.sub}
        </p>
      </div>

      <section>
        <h2 className="text-xs uppercase tracking-wide mb-2 text-[#999] font-mono">
          Marketing · 1 hour · {marketingDone}/4
        </h2>
        <div className="flex flex-col gap-2">
          <CheckRow icon={Linkedin} label="5 LinkedIn outreach sent, talent buyers" checked={todayLog.linkedin} onToggle={() => setTodayLog({ linkedin: !todayLog.linkedin })} />
          <CheckRow icon={Instagram} label="5 Instagram outreach sent, bands" checked={todayLog.instagram} onToggle={() => setTodayLog({ instagram: !todayLog.instagram })} />
          <CheckRow icon={Mail} label="5 email contacts pulled, gBOMBS outreach sent" checked={todayLog.email} onToggle={() => setTodayLog({ email: !todayLog.email })} />
          <CheckRow icon={FileText} label="Today's content posted" checked={todayLog.content} onToggle={() => setTodayLog({ content: !todayLog.content })} />
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wide mb-2 text-[#999] font-mono">Building · 2 hours</h2>
        <div className="flex flex-col gap-2">
          {BUILD_ITEMS.map((item) => (
            <CheckRow key={item.key} label={item.label} checked={!!todayLog.build[item.key]} onToggle={() => toggleBuild(item.key)} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wide mb-2 text-[#999] font-mono">Delivering · 1 hour</h2>
        <div className="flex flex-col gap-2">
          <CheckRow icon={Send} label="Sent an update or talked to an active client today" checked={todayLog.delivering} onToggle={() => setTodayLog({ delivering: !todayLog.delivering })} />
          <textarea
            value={todayLog.deliveryNote}
            onChange={(e) => setTodayLog({ deliveryNote: e.target.value })}
            placeholder="What did you deliver or communicate today?"
            rows={3}
            className="text-sm px-3 py-2.5 rounded-lg outline-none resize-none bg-[#1F1F1F] text-white border border-[#2C2C2C]"
          />
        </div>
      </section>

      <button onClick={saveToday} className="w-full py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 bg-[#F0451F] text-white">
        <Save size={15} /> Save today
      </button>
      {savedAt && <p className="text-xs text-center text-[#999]">Saved at {savedAt}</p>}
    </div>
  );
}
