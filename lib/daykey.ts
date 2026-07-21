// Timezone-aware calendar-day keys ("YYYY-MM-DD").
//
// THE bug this fixes: day keys used to come from the server's local clock, which
// is UTC on Vercel — so a kid checking in at 7:30pm Central was writing
// TOMORROW's key, corrupting one-check-in-per-day, streaks, and the coach's
// "checked in today" view. All day math now happens in the app timezone.
//
// APP_TIMEZONE is app-wide for now (both real teams are Oklahoma-based);
// Team.timezone exists in the schema for a later per-team refactor. Pure module
// (no prisma) so the seed and unit harnesses can import it too.

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Chicago";

// "en-CA" formats as YYYY-MM-DD directly.
export function dayKeyInTz(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// The current (or given instant's) calendar day in the app timezone.
export function todayKey(date = new Date(), timeZone = APP_TIMEZONE): string {
  return dayKeyInTz(date, timeZone);
}

// Whole days between two day keys (b - a). Keys are timezone-free once created,
// so plain UTC date math is exact here.
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000,
  );
}

// A day key shifted by n whole days (n may be negative).
export function addDays(dayKey: string, n: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

// Monday of the week containing `dayKey` (leaderboard weeks are Mon–Sun).
export function mondayOf(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 0=Mon
  return addDays(dayKey, -weekday);
}

// The UTC instant when `dayKey` begins in `timeZone` (handles DST via a
// guess-and-correct pass). Used for time-window queries (weekly points).
export function zonedStartOfDay(dayKey: string, timeZone = APP_TIMEZONE): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  let guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  // Correct up to twice (second pass settles DST-transition days).
  for (let i = 0; i < 2; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(guess));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const shownAsUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") % 24,
      get("minute"),
    );
    guess += Date.UTC(y, m - 1, d) - shownAsUtc;
  }
  return new Date(guess);
}
