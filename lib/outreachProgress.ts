export type OutreachProgressTone = "red" | "orange" | "blue" | "green";

const TONE_COLORS: Record<OutreachProgressTone, string> = {
  red: "#ff453a",
  orange: "#ff9f0a",
  blue: "#0a84ff",
  green: "#30d158",
};

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function outreachProgressPercent(count: number, target: number): number {
  const safeTarget = finiteNonNegative(target);
  if (safeTarget === 0) return 0;
  return Math.min(100, (finiteNonNegative(count) / safeTarget) * 100);
}

export function outreachProgressTone(count: number, target: number): OutreachProgressTone {
  const safeTarget = finiteNonNegative(target);
  const percentage = safeTarget === 0 ? 0 : (finiteNonNegative(count) / safeTarget) * 100;

  if (percentage <= 25) return "red";
  if (percentage <= 50) return "orange";
  if (percentage <= 75) return "blue";
  return "green";
}

export function outreachProgressColor(count: number, target: number): string {
  return TONE_COLORS[outreachProgressTone(count, target)];
}
