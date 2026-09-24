"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, Plus, Trash2, Clock } from "lucide-react";

type Event = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  description?: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toISODate(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function eventDateKey(e: Event): string {
  return e.start.slice(0, 10);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// A deliberately small calendar: month grid, click a day, add or remove an
// event. This is your personal Google Calendar (the "primary" calendar on
// the same account Gmail uses) -- Cal.com's booking page is separate and
// untouched by any of this.
export default function CalendarTab() {
  const [monthStart, setMonthStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rangeStart = new Date(monthStart);
      const rangeEnd = new Date(monthStart);
      rangeEnd.setMonth(rangeEnd.getMonth() + 1);
      const res = await fetch(
        `/api/calendar?start=${rangeStart.toISOString()}&end=${rangeEnd.toISOString()}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load your calendar");
      setEvents(data.events || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [monthStart]);

  useEffect(() => {
    load();
  }, [load]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, Event[]> = {};
    for (const e of events) (map[eventDateKey(e)] ||= []).push(e);
    return map;
  }, [events]);

  const cells = useMemo(() => {
    const firstWeekday = monthStart.getDay();
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const out: Array<{ date: string; day: number } | null> = [];
    for (let i = 0; i < firstWeekday; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), d);
      out.push({ date: toISODate(date), day: d });
    }
    return out;
  }, [monthStart]);

  const monthLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const today = toISODate(new Date());

  const changeMonth = (delta: number) => {
    const d = new Date(monthStart);
    d.setMonth(d.getMonth() + delta);
    setMonthStart(d);
  };

  return (
    <div className="mx-auto max-w-[960px]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-foreground sm:text-2xl">{monthLabel}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeMonth(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface2 text-textSecondary transition-all hover:border-accent hover:text-white sm:h-9 sm:w-9"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setMonthStart(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; })}
            className="min-h-11 rounded-full border border-border bg-surface2 px-4 py-2 text-sm text-textSecondary transition-all hover:border-accent hover:text-white sm:min-h-9"
          >
            Today
          </button>
          <button
            onClick={() => changeMonth(1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface2 text-textSecondary transition-all hover:border-accent hover:text-white sm:h-9 sm:w-9"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-base mb-4 bg-[rgba(232,67,10,0.1)] border border-[rgba(232,67,10,0.4)] text-accentLight">
          {error}
        </div>
      )}

      <div className="-mx-2 mb-2 grid grid-cols-7 gap-0.5 sm:mx-0 sm:gap-2">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 text-center font-mono text-[10px] uppercase tracking-[0.06em] text-muted sm:text-xs sm:tracking-[0.1em]">
            {w}
          </div>
        ))}
      </div>

      <div className="-mx-2 grid grid-cols-7 gap-0.5 sm:mx-0 sm:gap-2">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`blank-${i}`} />;
          const dayEvents = eventsByDate[cell.date] || [];
          const isToday = cell.date === today;
          return (
            <button
              key={cell.date}
              onClick={() => setSelectedDate(cell.date)}
              onMouseEnter={() => setHoveredDate(cell.date)}
              onMouseLeave={() => setHoveredDate((d) => (d === cell.date ? null : d))}
              className="flex aspect-square min-w-0 flex-col items-start rounded-lg p-1 text-left transition-all sm:aspect-[4/3] sm:rounded-xl sm:p-2"
              style={{
                background: dayEvents.length ? "rgba(232,67,10,0.08)" : "rgba(255,255,255,0.02)",
                border:
                  hoveredDate === cell.date
                    ? "2px solid var(--color-accent)"
                    : isToday
                      ? "2px solid #fff"
                      : "1px solid var(--color-border)",
              }}
            >
              <span
                className="flex-shrink-0 text-xs font-bold sm:text-sm"
                style={{ color: isToday ? "#fff" : "var(--color-muted)" }}
              >
                {cell.day}
              </span>
              <div className="mt-auto flex w-full gap-0.5 overflow-hidden sm:hidden">
                {dayEvents.slice(0, 3).map((event) => (
                  <span key={event.id} className="h-1.5 w-1.5 rounded-full bg-accent" />
                ))}
              </div>
              <div className="mt-1 hidden w-full flex-col gap-0.5 overflow-hidden sm:flex">
                {dayEvents.slice(0, 2).map((e) => (
                  <span
                    key={e.id}
                    className="text-[10px] sm:text-xs truncate px-1.5 py-0.5 rounded font-mono"
                    style={{ background: "rgba(232,67,10,0.18)", color: "var(--color-accent-light)" }}
                  >
                    {e.title}
                  </span>
                ))}
                {dayEvents.length > 2 && (
                  <span className="text-[10px] text-muted font-mono px-1.5">+{dayEvents.length - 2} more</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {loading && <p className="text-sm italic text-muted mt-4 px-1">Loading…</p>}

      {selectedDate && (
        <DayModal
          date={selectedDate}
          events={eventsByDate[selectedDate] || []}
          onClose={() => setSelectedDate(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function DayModal({
  date,
  events,
  onClose,
  onChanged,
}: {
  date: string;
  events: Event[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(events.length === 0);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const label = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, date, time: time || undefined, description: description || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setTitle("");
      setTime("");
      setDescription("");
      setAdding(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/calendar/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Could not delete");
      }
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-5" onClick={onClose}>
      <div
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-surface2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-h-[85vh] sm:rounded-2xl sm:p-6"
        style={{ boxShadow: "var(--shadow-elevated)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-foreground">{label}</h3>
          <button onClick={onClose}>
            <X size={18} color="var(--color-muted)" />
          </button>
        </div>

        {error && <p className="text-sm text-accentLight mb-3">{error}</p>}

        {events.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {events.map((e) => (
              <div
                key={e.id}
                className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-surface3 border border-border"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-foreground">{e.title}</p>
                  {!e.allDay && (
                    <p className="text-xs text-muted font-mono flex items-center gap-1 mt-0.5">
                      <Clock size={11} /> {formatTime(e.start)}
                    </p>
                  )}
                  {e.description && (
                    <p className="text-sm text-textSecondary mt-1 whitespace-pre-wrap">{e.description}</p>
                  )}
                </div>
                <button
                  onClick={() => remove(e.id)}
                  disabled={deletingId === e.id}
                  className="flex-shrink-0 p-1.5 rounded-lg hover:bg-black/30 transition-all disabled:opacity-50"
                >
                  <Trash2 size={14} color="var(--color-muted)" />
                </button>
              </div>
            ))}
          </div>
        )}

        {!adding ? (
          <button
            onClick={() => setAdding(true)}
            className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 bg-black/30 border border-border text-foreground hover:border-accent transition-all"
          >
            <Plus size={14} /> Add something
          </button>
        ) : (
          <div className="flex flex-col gap-2.5">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's happening?"
              className="w-full text-base px-4 py-3 rounded-xl outline-none bg-black/30 text-foreground border border-border placeholder:text-muted"
            />
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="flex-1 text-base px-4 py-3 rounded-xl outline-none bg-black/30 text-foreground border border-border"
              />
              {time && (
                <button
                  onClick={() => setTime("")}
                  className="text-xs text-muted font-mono px-2 whitespace-nowrap"
                  title="Make it all-day"
                >
                  All day
                </button>
              )}
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes (optional)"
              rows={3}
              className="w-full text-base px-4 py-3 rounded-xl outline-none resize-none bg-black/30 text-foreground border border-border placeholder:text-muted"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setAdding(events.length === 0 ? true : false);
                  setTitle("");
                  setTime("");
                  setDescription("");
                }}
                className="px-4 py-2.5 rounded-lg text-sm bg-surface3 border border-border text-textSecondary"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={!title.trim() || saving}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 text-white disabled:opacity-40 transition-all"
                style={{ background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))" }}
              >
                <Plus size={14} /> {saving ? "Saving…" : "Add"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
