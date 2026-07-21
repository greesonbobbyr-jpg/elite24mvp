# AUDIT_IDEAS.md — independent codebase audit (read-only)

> Audited: every page/component/action under `app/`, all of `lib/`, `prisma/schema.prisma`,
> `globals.css`, seed, middleware, auth. **Note: `BUILD_PLAN.md` does not exist in the repo** —
> only `CLAUDE.md` and `README.md`. This audit is against CLAUDE.md + the actual code.
>
> What's actually built (vs. CLAUDE.md's plan): real auth (Auth.js v5), coach signup + join
> codes, onboarding + Dream, daily check-in + journal wall, Mindset story + takeaway, quests +
> points ledger + leaderboard, coach dashboard/drill-in/adjustments, notifications + TIME OUT
> takeover + read receipts, Team Circle chat (reactions/replies/curated GIFs), gated PDF playbook,
> the PlayerCard identity system (tiers/tilt/team colors), photo uploads, team branding, PWA
> install banner — deployed on Vercel + Supabase Postgres. That is far beyond the MVP scope and
> most of it is genuinely well-built: server-enforced team scoping is consistent, the points
> ledger is a proper source-of-truth design, and privacy calls (journal never coach-readable) are
> defensible to a parent. The ideas below are what I'd do next, not a rebuild list.

---

## A) Player development, metacognition & the Hooked model

The core insight: **the app currently implements half of a habit loop and half of the E24P cycle.**
Players state an intention ("what will you work on today") but never review it. Hooked's
investment phase and E24P's own "Pro Review" both point at the same missing piece.

1. **Close the loop: add an evening "Pro Review" (the app's own method demands it).**
   E24P is Pro Plan → Pro Preview → Pro Perform → **Pro Review**, but the app only builds the
   morning Plan; a 30-second evening prompt — "You said: *100 free throws*. Did it happen? What
   did you notice?" — turns a to-do list into actual self-regulation training, and it's the
   single highest-leverage feature in this list.

2. **Intention → evidence → review is the metacognition engine; wire quests into it.**
   Today the check-in text and the quest log never touch; if the reflection mentions free throws
   and the player logs the "Free throws" quest, show them side-by-side at review time — "plan
   matched action" is the calibration feedback that builds self-awareness.

3. **Make the review the *investment* that loads the next trigger (Hooked's flywheel).**
   End the evening review with "one line for tomorrow-you"; show that line inside the next
   morning's check-in prompt — the player's own words become the internal trigger, which is
   Eyal's loop used for metacognition instead of engagement.

4. **Unlock the Mindset story *after* check-in, not before (variable reward, correctly placed).**
   The story is the best variable content in the app (different every day, deliberately spoiler-
   free) but it's currently just sitting on the page; making it the *reward* for checking in
   gives the action an unpredictable payoff without any slot-machine mechanics.

5. **Streaks exist nowhere in the data model — add them, but count "showing up," not perfection.**
   A `currentStreak/bestStreak` (or derive from JournalEntry days) with a "don't break the chain"
   wall tile is the classic external-to-internal trigger bridge; use a 1-day grace ("shield") so
   a missed Sunday doesn't nuke a 30-day habit — punishing breaks teaches quitting, not habits.

6. **Add a prediction/calibration mechanic — the research-backed core of basketball IQ.**
   Before a quest, ask "predict your makes out of 50"; after, log actual; a simple
   predicted-vs-actual trend teaches self-assessment accuracy (the measurable core of
   metacognition) and it's cheap: two integers on QuestLog.

7. **Variable rewards should come from the *tribe*, not from loot.**
   The coach Spotlight already exists on the board — systematize it: after N check-ins the app
   privately prompts the coach "Jordan hit a 7-day streak — give him a shoutout?"; unpredictable
   coach recognition is the most defensible variable reward for minors.

8. **Surface the takeaway archive back to the player (stored value that's currently write-only).**
   MindsetTakeaways are written daily but a player can never see their own past ones (only the
   coach sees today's); a "your takeaways" scroll — like the journal wall — makes weeks of
   micro-thoughts visible as accumulated identity ("look how I think now").

9. **Re-visit the Dream on a cadence (the app's emotional anchor is currently static).**
   The Dream is captured once at onboarding and displayed forever; a monthly "re-read your dream
   — still right? edit or re-commit" ritual is investment (Hooked) and goal-recommitment
   (motivation science), and edits should be versioned so growth is visible.

10. **The leaderboard rewards volume; add a "most improved" / weekly-sprint view before it demotivates.**
    All-time points ossify: the top 3 stay top 3 and the bottom kid disengages by week 3 —
    a weekly-reset board and a "most improved vs. your own last week" stat keep the bottom half
    playing without touching the data model (it's all derivable from the ledger).

11. **Tiers are currently cosmetic — make tier progress visible at the point of action.**
    `tierForPoints` drives only the card border; a small "Silver → Gold: 240 pts to go" strip on
    the quests page converts the prettiest visual in the app into a mid-term goal gradient
    (Hooked's "rewards of the hunt", pointed at effort).

12. **Effort-rating fallback for bad days (tiny-habits floor).**
    Some days a 10-year-old won't type; let the minimum viable check-in be picking an effort
    emoji + one word, keeping the streak alive — the habit survives the bad day, and the typed
    reflection returns tomorrow (never let the ideal action kill the habit).

13. **Candid disagreement — "no push notifications" is the plan's biggest self-inflicted wound.**
    CLAUDE.md defers push, but the entire Hooked model starts with external triggers, and a PWA
    with a manifest (already shipped) is 80% of the way to Web Push; a single coach-controlled
    "check-in window" notification (no marketing spam, coach-set time, parent-explainable) would
    do more for the daily loop than any in-app feature on this list.

---

## B) Open-ended: design, UX, branding, mechanics, out-of-the-box

1. **Team colors currently live only on the cards — decide if that's a feature or a gap.**
   `primaryColor/secondaryColor` are consumed exclusively by PlayerCard/avatars; the rest of the
   chrome is Elite24 red, so an OKC-blue card sits inside red-glowing surfaces — either lean in
   (cards are the team's "jersey", chrome is the league; make card containers neutral-zinc so
   colors never fight the red) or extend one team-color accent into the leaderboard/board headers;
   right now it's ambiguously in between.

2. **Add a dark-primary contrast guard to `cardGradient` (the mirror of the light-color guard).**
   `luminance()` already darkens light primaries, but a near-black primary produces a card that
   melts into the black app background — clamp the low end (lift very dark colors or brighten the
   mid-stop) so every team's card pops off the page.

3. **The player home never shows *why to come back* — streak/tier/points are all off-screen.**
   Home is Dream → check-in → Mindset (good hierarchy), but the return-visit motivators live on
   /quests and /leaderboard; one slim strip under the Dream (streak flame · tier progress · rank)
   makes the first screen carry the motivational state.

4. **Post-check-in dead end: the "✓ Checked in today" state is a cul-de-sac.**
   After checking in, home offers nothing to do; that moment is peak engagement — route it:
   "✓ Checked in · next: today's quests →" turns one habit into the chain the points system
   already assumes.

5. **Loading states don't exist, and you're on serverless + a pooled DB now.**
   Every page is a full server render with zero `loading.tsx`/skeletons; Vercel cold starts +
   Supabase round-trips will read as "the app froze" on a kid's phone — skeleton cards for
   home/leaderboard/board are cheap and transform perceived speed.

6. **The board loads every message ever posted (`findMany`, no `take`) — it will not survive a season.**
   A chatty team posts thousands of messages; add `take: 100` + a "load earlier" cursor before
   this becomes a multi-megabyte page (same unbounded query in `getTeamReadStatus`).

7. **Data-URL photos will bloat list pages — plan the Supabase Storage swap.**
   Each player photo is ~100-200KB of base64 *inlined into the HTML* of leaderboard/roster/board;
   at 12 players that's >1MB per page load — the DB pattern was right for launch, but Supabase
   Storage (already in your stack) with public URLs is the natural next step.

8. **Losers of the join-code lottery: there's no roster management at all.**
   A coach cannot remove a player who left, rename someone, or reset a forgotten password —
   the first real team will hit all three within a month; a minimal "Roster" section in Team
   Settings (remove + reset-password-link) is table stakes before selling to a school.

9. **A "report to coach" button on board messages is your cheapest child-safety win.**
   Coaches can delete messages but only if they happen to see them; a one-tap report that flags a
   message on the coach's dashboard (plus maybe a tiny profanity wordlist on `postMessage`) is a
   parent/school-meeting talking point that costs an afternoon.

10. **The privacy stance is a selling point — put it on screen.**
    "Your journal is yours: your coach sees *that* you checked in, never *what* you wrote" —
    players don't know this and it materially changes how honestly they write; one sentence under
    the check-in box, and a "privacy pledge" section in the parent-facing pitch.

11. **The one-team-per-user model quietly contradicts CLAUDE.md §3.5.**
    `User.teamId` is a required 1:N — a kid playing school + AAU ball, or a coach running varsity
    and JV, needs two accounts; `Team.parentId` exists for hierarchy but membership can't scale
    the same way — worth a deliberate decision (TeamMembership join table) before real sales,
    while migration is still cheap.

12. **Coach's read-receipt "Waiting" list is a nag goldmine — let the coach act on it.**
    The data is already computed (`notYet` names); a "remind waiting players" button that re-ups
    the notification (or queues a TIME OUT) closes the loop the receipts open.

13. **Onboarding form is visually off-brand.**
    It still uses light-theme-first classes (`bg-white`, `border-zinc-300`) with dark: overrides —
    a kid's literal first screen is the least polished one in the app; restyle with the same
    field classes as login/signup.

14. **TIME OUT is a great mechanic — protect it from dilution.**
    Nothing stops a coach sending three takeovers a day, which trains players to ignore them;
    consider a soft cooldown (one active TIME OUT at a time is already implicit — surface "you
    already have an unacknowledged TIME OUT" in the composer).

15. **Login could remember the last identity per device.**
    Kids share family tablets and forget usernames; a "last logged in as jordan — not you?" hint
    from localStorage removes the most common support ping without weakening auth.

---

## C) Technical debt, architecture, half-finished

**Top three (fix before real users):**

1. **🔴 Timezone bug: `todayKey()` uses server-local time, which is UTC on Vercel.**
   A kid checking in at 7:30pm Central is already on *tomorrow's* `day` key: streaks, "one
   check-in per day", "checked in today" on the coach dashboard, and quest-per-day limits all
   roll over at ~6-7pm local — this silently corrupts the core loop in production *today*; fix by
   storing a team timezone (or hardcoding one for now) and deriving day keys from it.

2. **🔴 Local `npm run seed` now wipes the production database.**
   `.env` points at Supabase and the seed's only guard is `NODE_ENV === "production"` — which is
   `"development"` on your laptop; one habitual reseed after the demo goes live deletes every real
   user; add an explicit `SEED_CONFIRM=<db host>` env check or a separate dev-branch database
   (Supabase branching) immediately.

3. **🔴 Auth hardening is still open: no rate limiting anywhere.**
   Login/signup/join-code/reactions all accept unlimited requests — bcrypt(12) on a serverless
   function makes a credential-stuffing run both a security and a *billing* incident; Upstash
   ratelimit (or Vercel WAF rules) on the auth endpoints is a half-day job. Also still open:
   rotate the Supabase DB password that transited chat, password reset flow, and account lockout.

**The rest:**

4. **README.md is badly stale — it still describes Phase 1.**
   It claims SQLite, "not yet a git repository", dev-switcher-only auth, and Team A/B logins that
   no longer exist; CLAUDE.md §6 explicitly requires the README to document reality — a rewrite
   is 20 minutes and prevents onboarding confusion (including future-you).

5. **CLAUDE.md itself has drifted from decisions you made.**
   It still says SQLite (§6), one accent color (§9 — you approved two), and no real push;
   the file is the project's constitution — update it so future sessions don't "correct" the app
   back toward outdated rules.

6. **No CLAUDE.md §3.4 compliance: export/delete doesn't exist.**
   "Easy to export or delete" is a stated non-negotiable, but there is no account deletion, no
   data export, and cascade behavior on `User` delete is untested — a school will ask about this
   in the first procurement conversation.

7. **Zero automated tests.**
   All verification this whole build has been ad-hoc curl/tsx harnesses (they worked, but they're
   gone); the highest-value floor: a Playwright smoke (login → check-in → quest → leaderboard) +
   unit tests for `todayKey`, `tierForPoints`, `validateImageDataUrl`, ranking ties.

8. **The middleware redirect drops the destination.**
   Unauthenticated visits to `/board` redirect to `/login` with no `?next=` — after login you land
   on `/`, losing the deep link (matters more once notification emails/push exist).

9. **`/card-preview` design sandbox ships to production.**
   Any logged-in player can visit it (it even runs a real ranking query); either delete it (its
   job is done) or gate it behind `NODE_ENV !== "production"` like the dev switcher.

10. **Duplicated helpers are spreading.**
    `initials()` exists in 4 files, `formatHeight()` in 2, day-key logic in seed + lib; small
    now, but the card/identity refactor doubled it — one `lib/identity.ts` sweep.

11. **`isTeamColor` is dead code after the hex-validation change.**
    It's exported from `teamColors.ts` but no longer called anywhere; delete it or re-point it at
    swatch-highlight logic to avoid future confusion about which validator is live.

12. **Points cache has no reconciliation path.**
    `PlayerProfile.points` is a cache over the ledger, updated transactionally everywhere today —
    but one future code path that forgets will drift silently; a `recomputePoints(userId)` helper
    (the seed already has the logic) callable from the coach page or a cron keeps trust in the
    number kids stare at.

13. **`getTeamRanking` is recomputed from scratch on five different pages.**
    Fine at 12 players, but it's a full-team fetch + sort per request (brand, leaderboard, home,
    coach overview, drill-in); when teams/conferences grow, make it one cached call (unstable_cache
    keyed by teamId, invalidated on ledger writes).

14. **Board reactions cause a full-page revalidate per tap.**
    `toggleReaction` → `revalidatePath("/board")` re-renders the entire (unbounded) board for one
    emoji; combined with C6 this is the first real performance cliff — optimistic client state or
    at least the `take`-limited query softens it.

15. **`AvatarCard`/chip prop contract is awkward: `points` is required but ignored.**
    Callers pass `points: 0` lies (board page) to satisfy the type; make `points` optional on
    `CardPlayer` and let sizes that need it require it — small, but it's the kind of lie that
    confuses the next contributor.

16. **The playbook route holds the whole 13MB PDF in lambda memory per instance.**
    `cachedFile` is fine at this size, but it's also re-downloaded per cold start and doubles if
    the file grows — Supabase Storage + a signed URL (keeping the auth gate in the route) is the
    scalable shape.

17. **No error boundaries or `not-found.tsx` anywhere.**
    A thrown Prisma error currently yields Next's default white error screen inside a kids' app —
    a branded `error.tsx`/`not-found.tsx` pair ("Coach, something broke — try again") is an hour.

18. **The repo still lives inside OneDrive.**
    It has corrupted `.next` repeatedly this project (documented recovery ritual in this repo's
    history); now that GitHub + Vercel are wired, `git clone` to `C:\dev\elite24mvp` and retire the
    whole failure class — the working copy no longer needs cloud-file-sync backup.

19. **Join-code lookup has no brute-force friction.**
    6 chars over a 32-symbol alphabet is ~1B combos — fine odds, but `lookupJoinCode` is an
    unthrottled oracle; fold it into the same rate-limit layer as auth (C3) rather than treating
    it separately.

20. **Seed demo passwords are a launch foot-gun.**
    Every seeded account shares `password123` printed to console — perfect for tomorrow's demo,
    dangerous the day a real team joins the same database; before onboarding real users, wipe demo
    teams or force-rotate their credentials (ties into C2's environment separation).
