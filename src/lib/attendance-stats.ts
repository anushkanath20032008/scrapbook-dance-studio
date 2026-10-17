// Pure date and percentage helpers for the attendance screen. Client-safe.

/** Present marks over marked sessions as a whole percent; null when nothing was marked, never 0%. */
export function attendancePercent(present: number, marked: number): number | null {
  if (marked <= 0) return null;
  return Math.round((present / marked) * 100);
}

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

/** How many days in [from, to] fall on one of the weekdays (0 = Sunday), i.e. the classes a batch schedules. */
export function countScheduledSessions(weekdays: number[], from: string, to: string): number {
  if (weekdays.length === 0 || to < from) return 0;
  const wanted = new Set(weekdays);
  let count = 0;
  for (let date = day(from); iso(date) <= to; date = new Date(date.getTime() + 86_400_000)) {
    if (wanted.has(date.getUTCDay())) count += 1;
  }
  return count;
}

export type RangeKind = "month" | "last30" | "last90";

export const rangeLabels: Record<RangeKind, string> = {
  month: "This month",
  last30: "Last 30 days",
  last90: "Last 90 days",
};

/** The date range for a choice, relative to today (an India date). */
export function rangeFor(kind: RangeKind, today: string): { from: string; to: string } {
  if (kind === "month") {
    const first = `${today.slice(0, 7)}-01`;
    const next = day(first);
    next.setUTCMonth(next.getUTCMonth() + 1);
    return { from: first, to: iso(new Date(next.getTime() - 86_400_000)) };
  }
  const days = kind === "last30" ? 29 : 89;
  return { from: iso(new Date(day(today).getTime() - days * 86_400_000)), to: today };
}
