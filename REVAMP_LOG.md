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
