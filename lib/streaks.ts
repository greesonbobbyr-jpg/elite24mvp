import { diffDays } from "./daykey";

// Check-in streak math. Pure — called inside submitCheckIn's transaction with
// the profile's current fields and today's day key, returns the fields to write.
//
// The grace "shield": ONE missed day per streak is absorbed (the streak keeps
// counting, the shield is spent). A second gap — or a 2+ day gap — resets to 1
// and hands the shield back. Design intent: a kid who misses one Sunday keeps
// their 30-day streak; punishing a single miss teaches quitting, not habits.

export type StreakState = {
  currentStreak: number;
  bestStreak: number;
  lastCheckInDay: string | null;
  streakGraceUsed: boolean;
};

export function advanceStreak(prev: StreakState, todayKey: string): StreakState {
  let current: number;
  let graceUsed: boolean;

  if (!prev.lastCheckInDay) {
    current = 1;
    graceUsed = false;
  } else {
    const gap = diffDays(prev.lastCheckInDay, todayKey);
    if (gap <= 0) {
      // Same day (or clock skew backwards) — nothing advances.
      return prev;
    } else if (gap === 1) {
      current = prev.currentStreak + 1;
      graceUsed = prev.streakGraceUsed;
    } else if (gap === 2 && !prev.streakGraceUsed) {
      // One missed day — shield absorbs it.
      current = prev.currentStreak + 1;
      graceUsed = true;
    } else {
      current = 1;
      graceUsed = false;
    }
  }

  return {
    currentStreak: current,
    bestStreak: Math.max(prev.bestStreak, current),
    lastCheckInDay: todayKey,
    streakGraceUsed: graceUsed,
  };
}
