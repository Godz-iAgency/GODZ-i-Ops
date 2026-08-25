"use client";

import { useLocalStorage } from "@/lib/useLocalStorage";
import { austinDateStr } from "@/lib/austinDate";
import { useState } from "react";
import { X } from "lucide-react";

const SPRINT_START = "2026-08-25";
const startDate = new Date(SPRINT_START + "T00:00:00");
const todayStr = () => austinDateStr();
const dayNumber = () => Math.round((new Date(todayStr() + "T00:00:00").getTime() - startDate.getTime()) / 86400000) + 1;
const dateForDay = (n: number) => {
  const d = new Date(startDate);
  d.setDate(d.getDate() + (n - 1));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function HundredDaysTab() {
  const [dayNotes, setDayNotes] = useLocalStorage<Record<number, string>>("godzi-day-notes-2026-07-27", {});
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const day = dayNumber();

  const openDay = (n: number) => {
    setSelectedDay(n);
    setNoteDraft(dayNotes[n] || "");
  };
  const saveDayNote = () => {
    if (selectedDay == null) return;
    setDayNotes({ ...dayNotes, [selectedDay]: noteDraft });
    setSelectedDay(null);
  };

  return (
    <div className="max-w-[1100px] mx-auto">
      <p className="text-base text-muted mb-5">Tap a day to write a note. Filled boxes have a note saved.</p>
      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3">
        {Array.from({ length: 100 }, (_, i) => i + 1).map((n) => {
          const hasNote = !!dayNotes[n];
          const isToday = n === day;
          return (
            <button
              key={n}
              onClick={() => openDay(n)}
              className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all hover:scale-[1.08]"
              style={{
                border: isToday ? "2px solid #fff" : `1px solid ${hasNote ? "var(--color-accent)" : "var(--color-border)"}`,
                background: hasNote
                  ? "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))"
                  : "rgba(255,255,255,0.025)",
                color: hasNote ? "#fff" : "var(--color-muted)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 4px 14px rgba(232,67,10,0.35)";
                e.currentTarget.style.borderColor = "var(--color-accent-light)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.borderColor = isToday ? "#fff" : hasNote ? "var(--color-accent)" : "var(--color-border)";
              }}
            >
              <span className="text-lg sm:text-xl font-bold">{n}</span>
              <span className="text-[11px] sm:text-xs font-mono opacity-70">{dateForDay(n)}</span>
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-5 z-50 bg-black/70" onClick={() => setSelectedDay(null)}>
          <div
            className="w-full max-w-md rounded-2xl p-6 bg-surface2 border border-border"
            style={{ boxShadow: "var(--shadow-elevated)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-foreground">
                Day {selectedDay} · {dateForDay(selectedDay)}
              </h3>
              <button onClick={() => setSelectedDay(null)}>
                <X size={18} color="var(--color-muted)" />
              </button>
            </div>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="What happened today?"
              rows={5}
              className="w-full text-base px-4 py-3 rounded-xl outline-none resize-none mb-4 bg-black/30 text-foreground border border-border placeholder:text-muted"
            />
            <button
              onClick={saveDayNote}
              className="w-full py-4 rounded-xl text-base font-bold text-white transition-all hover:-translate-y-0.5"
              style={{
                background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))",
                boxShadow: "var(--shadow-cta)",
              }}
            >
              Save note
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
