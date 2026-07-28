// The sprint always runs on Austin, TX time (Central), regardless of what
// timezone the viewing device happens to be set to. toISOString()-based date
// math is UTC and rolls over ~5-6 hours too early relative to Central time.
const AUSTIN_TZ = "America/Chicago";

export function austinDateStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: AUSTIN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function austinDayOfWeek(d: Date = new Date()): number {
  // Parsed at local noon to stay clear of any DST midnight edge cases.
  return new Date(austinDateStr(d) + "T12:00:00").getDay();
}
