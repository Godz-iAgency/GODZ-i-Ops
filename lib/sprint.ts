import { austinDateStr } from "./austinDate";

// Single source of truth for the 100-day sprint. Today and 100 Days both read
// from here so the day counter can never drift between the two tabs.
export const SPRINT_START = "2026-08-25";

const startDate = new Date(SPRINT_START + "T00:00:00");

export function dayNumber(date: string = austinDateStr()): number {
  return Math.round((new Date(date + "T00:00:00").getTime() - startDate.getTime()) / 86400000) + 1;
}

export function dateForDay(n: number): string {
  const d = new Date(startDate);
  d.setDate(d.getDate() + (n - 1));
  return austinDateStr(d);
}

export function shortDateForDay(n: number): string {
  const d = new Date(startDate);
  d.setDate(d.getDate() + (n - 1));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function dayOfWeekForDay(n: number): number {
  const d = new Date(startDate);
  d.setDate(d.getDate() + (n - 1));
  return d.getDay();
}

export function sprintStartLabel(): string {
  return startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}
