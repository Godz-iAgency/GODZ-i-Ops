"use client";

import { useLocalStorage } from "@/lib/useLocalStorage";
import { useState } from "react";
import { X } from "lucide-react";

const SPRINT_START = "2026-07-14";
const startDate = new Date(SPRINT_START + "T00:00:00");
const todayStr = () => new Date().toISOString().slice(0, 10);
const dayNumber = () => Math.round((new Date(todayStr() + "T00:00:00").getTime() - startDate.getTime()) / 86400000) + 1;
const dateForDay = (n: number) => {
  const d = new Date(startDate);
  d.setDate(d.getDate() + (n - 1));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function HundredDaysTab() {
  const [dayNotes, setDayNotes] = useLocalStorage<Record<number, string>>("godzi-day-notes", {});
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
    <div className="max-w-3xl mx-auto">
      <p className="text-xs mb-4 text-[#999]">Tap a day to write a note. Filled boxes have a note saved.</p>
      <div className="grid grid-cols-8 sm:grid-cols-10 gap-2">
        {Array.from({ length: 100 }, (_, i) => i + 1).map((n) => {
          const hasNote = !!dayNotes[n];
          const isToday = n === day;
          return (
            <button
              key={n}
              onClick={() => openDay(n)}
              className="card-hover aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 border"
              style={{
                background: hasNote ? "#F0451F" : "#1F1F1F",
                borderColor: isToday ? "#fff" : hasNote ? "#F0451F" : "#2C2C2C",
                borderWidth: isToday ? 1.5 : 1,
              }}
            >
              <span className="text-xs font-semibold" style={{ color: hasNote ? "#fff" : "#999" }}>
                {n}
              </span>
              <span className="text-[9px] font-mono" style={{ color: hasNote ? "rgba(255,255,255,0.8)" : "#999" }}>
                {dateForDay(n)}
              </span>
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div className="fixed inset-0 flex items-center justify-center p-5 z-50 bg-black/70" onClick={() => setSelectedDay(null)}>
          <div className="w-full max-w-sm rounded-xl p-5 bg-[#141414] border border-[#2C2C2C]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-heading">
                Day {selectedDay} · {dateForDay(selectedDay)}
              </h3>
              <button onClick={() => setSelectedDay(null)}>
                <X size={16} color="#999" />
              </button>
            </div>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="What happened today?"
              rows={5}
              className="w-full text-sm px-3 py-2.5 rounded-lg outline-none resize-none mb-3 bg-[#1F1F1F] text-white border border-[#2C2C2C]"
            />
            <button onClick={saveDayNote} className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[#F0451F] text-white">
              Save note
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
