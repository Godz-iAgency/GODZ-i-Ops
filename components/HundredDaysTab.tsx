"use client";

import { useEffect, useMemo, useState } from "react";
import { austinDateStr } from "@/lib/austinDate";
import { dayNumber, dateForDay, shortDateForDay, dayOfWeekForDay } from "@/lib/sprint";
import { X, RefreshCw, Check, Save } from "lucide-react";

type Progress = Record<string, string | number | boolean | undefined>;

// A weekday only counts as done when the whole system ran: 10 emails,
// 10 LinkedIn, plus the build, deliver, content and reading sessions.
function weekdayComplete(p: Progress): boolean {
  return (
    Number(p["Emails Sent"] ?? 0) >= 10 &&
    Number(p["LinkedIn Sent"] ?? 0) >= 10 &&
    Boolean(p["Build Completed"]) &&
    Boolean(p["Deliver Completed"]) &&
    Boolean(p["Content Posted"]) &&
    Boolean(p.Book)
  );
}

function dayState(n: number, progress: Progress | undefined) {
  const dow = dayOfWeekForDay(n);
  if (dow === 0) return { kind: "rest" as const, complete: false };
  if (dow === 6) {
    return { kind: "deep" as const, complete: Boolean(progress?.["Deep Work Completed"]) };
  }
  return { kind: "work" as const, complete: progress ? weekdayComplete(progress) : false };
}

const rowCls = "flex items-start justify-between gap-4 py-2.5 border-b border-border last:border-0";

function Row({ label, value }: { label: string; value?: string | number | boolean }) {
  if (value === undefined || value === "" || value === false) return null;
  return (
    <div className={rowCls}>
      <span className="text-sm uppercase tracking-[0.1em] text-muted font-mono flex-shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right whitespace-pre-wrap">
        {value === true ? <Check size={15} color="var(--color-accent)" /> : String(value)}
      </span>
    </div>
  );
}

export default function HundredDaysTab() {
  const [byDate, setByDate] = useState<Record<string, Progress>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSavedAt, setNoteSavedAt] = useState<string | null>(null);

  const today = austinDateStr();
  const day = dayNumber();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/progress?all=1");
      if (!res.ok) throw new Error("Could not load progress");
      const data = await res.json();
      const map: Record<string, Progress> = {};
      for (const d of data.days as Progress[]) {
        if (typeof d.Date === "string") map[d.Date] = d;
      }
      setByDate(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    let complete = 0;
    let logged = 0;
    for (let n = 1; n <= 100; n++) {
      const p = byDate[dateForDay(n)];
      if (p) logged++;
      if (dayState(n, p).complete) complete++;
    }
    return { complete, logged };
  }, [byDate]);

  const selectedDate = selectedDay ? dateForDay(selectedDay) : null;
  const selected = selectedDate ? byDate[selectedDate] : undefined;
  const selectedState = selectedDay ? dayState(selectedDay, selected) : null;

  const openDay = (n: number) => {
    setSelectedDay(n);
    setNoteDraft((byDate[dateForDay(n)]?.["Day Note"] as string) || "");
    setNoteSavedAt(null);
  };

  const saveNote = async () => {
    if (!selectedDate || selectedDay == null) return;
    setNoteSaving(true);
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Date: selectedDate, "Day Note": noteDraft }),
      });
      if (!res.ok) throw new Error("Could not save note");
      setByDate((prev) => ({
        ...prev,
        [selectedDate]: { ...prev[selectedDate], Date: selectedDate, "Day Note": noteDraft },
      }));
      setNoteSavedAt(
        new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save note");
    } finally {
      setNoteSaving(false);
    }
  };

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <p className="text-base text-muted">
            {stats.complete} days complete · {stats.logged} logged. Tap a day to see what happened.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm bg-surface2 border border-border text-textSecondary hover:text-white hover:border-accent transition-all disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-base mb-4 bg-[rgba(232,67,10,0.1)] border border-[rgba(232,67,10,0.4)] text-accentLight">
          {error}
        </div>
      )}

      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3">
        {Array.from({ length: 100 }, (_, i) => i + 1).map((n) => {
          const date = dateForDay(n);
          const p = byDate[date];
          const state = dayState(n, p);
          const isToday = date === today;
          const isRest = state.kind === "rest";
          const hasLog = !!p;

          const background = state.complete
            ? "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))"
            : isRest
              ? "rgba(255,255,255,0.012)"
              : hasLog
                ? "rgba(232,67,10,0.12)"
                : "rgba(255,255,255,0.025)";

          return (
            <button
              key={n}
              onClick={() => openDay(n)}
              className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all hover:scale-[1.08]"
              style={{
                border: isToday
                  ? "2px solid #fff"
                  : `1px solid ${state.complete ? "var(--color-accent)" : "var(--color-border)"}`,
                background,
                color: state.complete ? "#fff" : isRest ? "rgba(255,255,255,0.25)" : "var(--color-muted)",
                opacity: n > day + 30 ? 0.5 : 1,
              }}
            >
              <span className="text-lg sm:text-xl font-bold">{n}</span>
              <span className="text-[11px] sm:text-xs font-mono opacity-70">{shortDateForDay(n)}</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 flex-wrap mt-5 text-xs text-muted font-mono">
        <span className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded"
            style={{ background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))" }}
          />
          Complete
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ background: "rgba(232,67,10,0.12)" }} />
          Partly logged
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ background: "rgba(255,255,255,0.012)" }} />
          Sunday, rest
        </span>
      </div>

      {selectedDay && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 sm:p-5 z-50 bg-black/70"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 bg-surface2 border border-border max-h-[85vh] overflow-y-auto"
            style={{ boxShadow: "var(--shadow-elevated)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-foreground">
                  Day {selectedDay} · {shortDateForDay(selectedDay)}
                </h3>
                <p className="text-sm text-muted font-mono mt-0.5">
                  {selectedState?.kind === "rest"
                    ? "Sunday · rest"
                    : selectedState?.kind === "deep"
                      ? "Saturday · deep work"
                      : selectedState?.complete
                        ? "Complete"
                        : "Incomplete"}
                </p>
              </div>
              <button onClick={() => setSelectedDay(null)}>
                <X size={18} color="var(--color-muted)" />
              </button>
            </div>

            {selectedState?.kind === "rest" && (
              <p className="text-base text-muted py-2">Nothing tracked on Sundays.</p>
            )}
            {selectedState?.kind !== "rest" && !selected && (
              <p className="text-base text-muted py-2">Nothing logged for this day.</p>
            )}
            {selectedState?.kind !== "rest" && selected && (
              <div className="flex flex-col mb-2">
                <Row label="Emails" value={`${selected["Emails Sent"] ?? 0} / 10`} />
                <Row label="LinkedIn" value={`${selected["LinkedIn Sent"] ?? 0} / 10`} />
                <Row label="Objective" value={selected["Build Objective"] as string} />
                <Row label="Built" value={selected["Build Notes"] as string} />
                <Row label="Feedback" value={selected["Feedback Received"] as string} />
                <Row label="Follow-up" value={selected["Needs Follow-up"] as string} />
                <Row label="Next action" value={selected["Deliver Next Action"] as string} />
                <Row label="Camera" value={selected["Camera Practice"] as boolean} />
                <Row label="Posted" value={selected["Content Title"] as string} />
                <Row label="Platform" value={selected["Content Platform"] as string} />
                <Row label="Book" value={selected.Book as string} />
                <Row label="Pages" value={selected["Pages or Chapter"] as string} />
                <Row label="Learned" value={selected.Learned as string} />
                <Row label="Apply" value={selected.Apply as string} />
                <Row label="Deep work" value={selected["Deep Work Notes"] as string} />
              </div>
            )}

            <div className="pt-3 mt-1 border-t border-border">
              <label className="text-sm uppercase tracking-[0.1em] text-muted font-mono">Note</label>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Anything worth remembering about this day..."
                rows={4}
                className="w-full mt-2 text-base px-4 py-3 rounded-xl outline-none resize-none bg-black/30 text-foreground border border-border placeholder:text-muted"
              />
              <button
                onClick={saveNote}
                disabled={noteSaving}
                className="w-full mt-2.5 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 text-white disabled:opacity-50 transition-all hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))",
                  boxShadow: "var(--shadow-cta)",
                }}
              >
                <Save size={15} /> {noteSaving ? "Saving…" : "Save note"}
              </button>
              {noteSavedAt && <p className="text-xs text-center text-muted mt-2">Saved at {noteSavedAt}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
