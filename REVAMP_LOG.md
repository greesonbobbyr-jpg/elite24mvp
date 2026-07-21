# REVAMP_LOG

Running log of the AUDIT_IDEAS.md revamp — one entry per phase. Committed per
phase; nothing pushed/deployed until the owner okays.

## ⚠️ Environment note (applies to all phases)
The Supabase project is currently **paused/unreachable** (free-tier idle pause —
"tenant not found" from the pooler), which also means the deployed site's DB is
down. All migrations in this revamp are **authored and committed but NOT yet
applied**, and the password-rotation script is written but NOT yet run. After the
owner restores the project (Supabase dashboard → Restore), run:
`npx prisma migrate deploy`, then `ROTATE_CONFIRM=<db host> npx tsx
scripts/rotate-passwords.ts`, then a full runtime pass. Until then, verification
is builds + pure-function harnesses.

## Phase 0 — Critical fixes
Fixed the production timezone bug: day keys ("YYYY-MM-DD") now come from a new
pure module `lib/daykey.ts` using `Intl` with `APP_TIMEZONE` (default
America/Chicago) instead of the server's UTC clock — check-ins, streak math,
quest-per-day limits, and the coach's "checked in today" all roll over at local
midnight now (8 boundary cases unit-verified, incl. DST). `lib/journal.ts`
re-exports `todayKey` so all call sites are fixed at once; the seed shares the
same helper. Seeding now requires `SEED_CONFIRM=<exact db host>` (NODE_ENV alone
couldn't catch a local run pointed at prod) and no longer hardcodes a password —
`SEED_PASSWORD` env or a random one printed once. Added DB-backed fixed-window
rate limiting (`RateLimit` table + `lib/ratelimit.ts`, fail-open) on login
(10/5min per identifier+IP), signup (5/hr/IP), join lookup (15/5min/IP), join
create (5/hr/IP), and reactions (60/min/user). Wrote
`scripts/rotate-passwords.ts` (guarded by `ROTATE_CONFIRM=<host>`; writes the
one-time credential table to git-ignored `credentials-rotated.local.txt` —
rotation does NOT invalidate already-issued JWT sessions). RateLimit migration
authored; **not applied yet** (DB paused — see note above).

## Phase 1 — Data foundation
One additive migration (`streaks_predictions_timezone`, authored/committed, not
yet applied): `Team.timezone` (IANA, default America/Chicago — data-model prep
for per-team day math), streak fields on PlayerProfile (`currentStreak`,
`bestStreak`, `lastCheckInDay`, `streakGraceUsed`), `Quest.targetCount` (marks a
measurable quest for the predict-then-log flow), and `QuestLog.predicted/actual`.
New pure `lib/streaks.ts` — `advanceStreak` with a one-missed-day grace "shield"
(a single gap keeps the streak and spends the shield; a second gap resets and
returns it) — wired into `submitCheckIn`'s transaction, 7 cases unit-verified.
Seed: "Free throws" (50) and "Shooting reps" (100) get targetCounts, and streak
fields are backfilled by replaying seeded entry days through the same
`advanceStreak` the app uses. Weekly points intentionally need NO schema — they
derive from `PointsLedger.createdAt` (Phase 4 queries it directly).

## Phase 2 — Quick wins
The Mindset story now UNLOCKS with the check-in: before checking in, the home
page shows a locked strip ("🔒 Check in to unlock today's story" — no title, so
no spoilers); after, the full MindsetCard. That places the app's best variable
content as the reward for the core action (Hooked, without loot-box mechanics).
The "✓ Checked in today" state no longer dead-ends — it chains into "Next up:
Quests · X of Y done →" at the moment of peak motivation. Onboarding was
restyled from leftover light-theme classes to the same dark login/signup field
treatment (a kid's first screen now reads as the same product). And
`cardGradient` gained the mirror of its light-color guard: near-black team
primaries (< ~0.09 luminance) are lifted into a visible charcoal so a team with
black branding doesn't produce an invisible card on the black app background
(unit-verified: #111111 → visible stops; normal colors unchanged).

## Phase 3 — Close the loop (core)
The app now implements the FULL E24P cycle. New `DailyReview` model (+`REVIEW`
points source, migration authored/queued): one per player per day, only after
that day's check-in. The evening **Pro Review** card on home shows the morning
plan and the day's logged quests side by side (plan vs action), asks "did it
happen?" (Yes/Partly/Not today) + "what did you notice?" (required) + an
optional "one line for tomorrow-you" — worth +5 pts, idempotent via the unique
key. The note resurfaces above the NEXT morning's check-in prompt ("📝 From your
last review") — the investment that loads the next trigger. PRIVACY: review text
is player-private like the journal; the coach drill-in shows only a "Pro Review
done / not yet" status chip. Measurable quests (targetCount set) now run
**predict-then-log**: predict your count → Start (PENDING, no points) → log the
actual → Done (APPROVED + points + "guessed X · made Y" calibration line);
one-tap logging is server-blocked for measurable quests, and
`getTodaysCompletedQuestIds` counts only APPROVED so a started-but-unfinished
quest isn't "done". UI copy choices (button "Finish the day · +5", outcome
labels) made per the standing "reasonable choice" rule.

## Phase 4 — Make progress visible
The player home now opens with a progress strip under the Dream — 🔥 day streak
(with a 🛡️ dot while the grace shield is unspent), current tier + "N pts to
<next>", and team rank — so the "why come back" state lives on the first screen.
The quests page gained a gold tier-progress bar ("SILVER · 240 PTS TO GOLD")
turning the card-border tier into a mid-term goal. The leaderboard has All-time /
This-week tabs: the week view (Mon–Sun in APP_TIMEZONE, derived from
PointsLedger.createdAt via the new `getWeeklyRanking`) starts everyone at 0 each
Monday — keeping the bottom of the all-time board in the race — and badges the
"▲ Most improved" player (biggest gain vs. their OWN last week). CoachHome shows
a Streak Milestones card (players at 7/14/30+ days) with "Give a shoutout →"
links that prefill an editable Coach's Spotlight draft in the board composer —
the app prompts, the coach writes and sends; nothing is ever auto-posted.
Week-boundary math (Monday mapping, year rollover, DST-correct week start) is
unit-verified.

## Phase 5 — Coach tools
Team Settings gained a **Roster** section: per-player **Reset password**
(readable temp value like `swish-dunk-42`, bcrypt-hashed, shown ONCE to the
coach with "write it down now" copy) and **Remove** — a HARD delete behind a
two-tap confirm that states exactly what goes with it (journal, points, streak,
messages; for players who have left the team — soft-delete/archive deliberately
deferred). Both actions re-verify coach-only + own-team + PLAYER-only
server-side. The coach dashboard's "X still to check in" count is now
actionable: a **Send check-in reminder** button posts a canned, team-wide
notification (no name-calling) through the existing notification/receipt
machinery, with an optional "send as TIME OUT" checkbox for the full-screen
takeover. Runtime verification of the delete cascade is queued behind the DB
restore (cascades are declared on every User relation in the schema).

## Phase 6 — Scale/performance
The board no longer loads every message ever: `listTeamMessages` fetches the
newest 75 (oldest-first render preserved) with a "Show earlier messages" link
stepping the cap 75→150→… up to 600 — server-first pagination, no client
scroll-anchoring complexity (logged trade-off). Notification lists got the same
treatment (newest 50 for players / 30 with receipts for the coach). Photos left
the HTML: a new authed, TEAM-SCOPED `/api/photo/[userId]` route serves the
stored data-URL as real cacheable image bytes, and all six render sites
(leaderboard incl. weekly + podium, board avatars, header chip, coach roster +
drill-in, brand hero) now use `photoSrc()` (content-hash cache busting) — a
12-player leaderboard drops from >1MB of inline base64 to normal HTML. New
`lib/photoStore.ts`: uploads (player/coach photo, team logo) route through
Supabase Storage IF `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set
(owner-supplied; needs a public "photos" bucket) and otherwise pass through
unchanged — the Storage half stays dormant until keys exist (flagged in the
plan). Loading skeletons added for the route group, leaderboard, and board.
