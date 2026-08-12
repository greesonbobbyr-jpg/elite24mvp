# HIERARCHY_PLAN.md — Elite24MVP multi-tenant rebuild (official plan)

> **Living document.** Updated at every stage boundary. This is the authoritative plan for
> re-architecting from "a User has one teamId and one global role" to the profile-centric,
> multi-tenant model. Supersedes the exploratory findings report (available in git history
> of the planning session if needed).

**STATUS (2026-08-10)**
| | |
|---|---|
| Branch | `hierarchy-rebuild` (branched from `main` @ `eea25d0`) |
| Stage | **4a of 6 DONE in branch** (`e5de7e6`; Stage 3 `893ac1b`; Stage 2 `53777c7`; Stage 1 in prod: `6dcf636`/`466d1c5`/`3cf226c`) — prod quest flip awaits the merge runbook |
| Database | Shared Supabase Postgres — new-world rows exist and all invariants pass; the live app reads none of them. Branch writers now stamp both worlds in the same transactions (nothing deployed until merge) |
| Tests | 123 passing (vitest): matrix, cross-org, acting, season invariant, shim identity, + end-to-end dual-write (check-in / quest / undo / measured / review / adjustments / offseason) asserting all three cache==Σledger invariants after every step |
| Deploys | Only `main` auto-deploys. This branch never deploys until merged. |
| Next | Stage 4b — Brand/photo cutover (ships the visibility tightening). Prod converge sequence documented in Stage 4a below, gated on owner approval at merge time |

---

## 1. Target model

```
Organization ──< Season ──< (via Membership)
     │
     └──────< Team

User (login) ──1:1── Profile (permanent person)
                        │
                        ├──< Membership  (a role ON A TEAM, IN A SEASON)
                        └──< RoleAssignment (a role AT A SCOPE — org, later team)

Roles: ORG_ADMIN | HEAD_COACH | ASSISTANT_COACH | GENERAL_MANAGER | PLAYER
```

- **Development data attaches to PROFILE** so it follows the athlete across teams/seasons.
- **Program → Division** are NOT built now. The design reserves their slot: authorization is
  anchored on `organizationId` everywhere, so grouping levels can be inserted later as
  optional FKs (`Team.divisionId → Division.programId → Program.organizationId`) without
  touching a single permission check. Grouping is for display; the org id is for security.
- **Journals stay author-only, enforced at the data layer** (see §4).

---

## 2. LOCKED DECISIONS (owner-ruled; design conforms to these)

1. **Points:** every quest-completion and coach-adjustment ledger row is stamped with
   `membershipId` at write time. Check-in/review rows are stamped when an active membership
   exists, and are **NULL-stamped when none does** (offseason ruling, below). Career total =
   Σ profile rows → drives card tier. Leaderboards = Σ membership rows.
2. **Removing a player ENDS A MEMBERSHIP** (`endedAt`), never deletes a User/Profile.
   Person deletion = separate, rare, **operator-only script** — deliberately NOT wired into
   any org screen (an org role must never be able to destroy a cross-org person).
3. **Journals + Daily Reviews are author-only**, guaranteed structurally (§4). No role —
   not coach, not GM, not ORG_ADMIN — has any query path to another person's reflections.
4. **Mindset Takeaways are coach-visible BY DESIGN but at-time-scoped:** each takeaway is
   stamped with the athlete's **acting membership at write time**; visibility = staff of
   that membership's team only. Past/future teams structurally cannot match.
   *Accepted consequence:* a two-team athlete's takeaway is visible only to the acting
   team's staff that day.
5. **Acting-as:** one active membership → used implicitly, zero new friction. 2+ →
   an httpOnly cookie selects the acting membership, validated server-side every request;
   a switcher UI renders only for multi-membership people.
6. **Onboarding:** EVERYONE gets a Profile (staff included). The gate becomes
   `setupCompletedAt` ("profile setup complete"), not "is a player." Players write the
   Dream + basics; staff confirm name/photo.
7. **Quests are org-owned.** Existing global quests are cloned per org in the backfill.
   A completion credits the acting membership; `unique(profileId, questId, day)` prevents
   double-dipping by context-switching.
8. **Join codes are per team, resolving into the org's current season.** A logged-in
   returning athlete can join a new team from inside the app (new membership on their
   existing profile). An org with no current season fails joins with a clear
   "ask your coach" error. **Season rollover:** staff memberships carry into the new
   season; players re-join by code.
9. **Contact data split:** `Profile` = identity (name, photo, jersey, position, grad year,
   bio, height). `ProfileContact` = sensitive (DOB, address, phone, email, guardian,
   emergency contact). **NO medical/allergy fields.** For now, contact is entered by the
   person or ORG_ADMIN. A **parent portal is a separate later initiative** (guardian login
   holding multiple child profiles, consent, guardian-entered contact); `Profile.userId`
   stays nullable and guardian fields exist now so that lands cleanly — but NO parent login
   is built in this migration.
10. **Permission matrix** (implemented exactly; org-bounded ALWAYS — never across orgs):

| Action | ORG_ADMIN | HEAD_COACH | ASSISTANT_COACH | GENERAL_MANAGER | PLAYER |
|---|---|---|---|---|---|
| view roster / player detail | ✔ | ✔ | ✔ (view ONLY — may not add/remove) | ✔ | teammates' **card info only** |
| adjust points | ✔ | ✔ | — | — | — |
| end membership | ✔ | ✔ | — | ✔ | — |
| team settings / join code | ✔ | ✔ | — | — | — |
| post notification | ✔ | ✔ | ✔ | ✔ | — |
| send TIME OUT | ✔ | ✔ | — | — | — |
| view takeaways (at-time scoped) | ✔ | ✔ | ✔ | — | own |
| special board posts / moderate | ✔ | ✔ | — | — | — |
| view emergency contact | ✔ | ✔ | ✔ | ✔ | own |
| full contact / export / create teams+seasons / manage quests | ✔ | — | — | — | own contact |
| read someone else's journal/review | **NOBODY. EVER.** | | | | |

**Ruling recorded (visibility tightening):** "card info only" is deliberate — the **Dream
and per-game stats are NO LONGER teammate-visible** on the Brand page (the Dream lives on
the athlete's own Home; stats move to a card-back in a later redesign). Implemented at
stage 4b.

**Offseason ruling:** the daily loop (check-in, review, streaks, career points) keeps
working with no active membership; such rows credit no team board. (Amends the original
"every row stamped" wording — accepted.)

**Other recorded rulings:** one-current-season-per-org is app-enforced transactionally and
**a test must own that invariant**; takeaway write-time stamp accepted; career points/tier
crossing orgs accepted as designed (the one deliberate hole in org-bounding — it's the
athlete's own progression).

---

## 3. DATA MODEL (target schema)

### New tables
- **Organization** — id, name. Parent of seasons/teams/quests/role grants.
- **Season** — org FK, name, optional dates, `isCurrent` (exactly one per org,
  app-enforced + test-owned).
- **Profile** — the permanent person. `userId Int? @unique` (nullable ON PURPOSE for
  future unclaimed/roster-first/guardian flows). Identity fields (name, photoUrl,
  jerseyNumber, position, gradYear, bio, heightInches), personal fields (dream, favorites,
  highlightUrl, per-game stats), **career aggregates** (careerPoints cache, streak fields),
  `setupCompletedAt` (the new gate).
- **ProfileContact** — 1:1 sensitive split (DOB/address/phone/email/guardian/emergency,
  `updatedByProfileId` audit, NO medical). Separate table ⇒ separate permission-gated read
  path (full vs emergency-only field sets).
- **Membership** — profileId + teamId + seasonId + role (PLAYER/HC/AC/GM — never
  ORG_ADMIN, app-enforced), per-team jersey override, `startedAt/endedAt(+endedBy)`,
  **points cache** (team-board sum). `@@unique([profileId, teamId, seasonId])`.
- **RoleAssignment** — profileId + role + **organizationId ALWAYS SET** (org-bounding is
  structural) + optional teamId (unused in v1), createdAt/revokedAt. V1 usage: ORG_ADMIN
  only; team authority comes from Membership.

### Changed tables (new dimensions; legacy columns remain until Stage 6)
- **JournalEntry / DailyReview** — + `profileId` (author-only person data;
  `@@unique([profileId, day])`).
- **MindsetTakeaway** — + `profileId`, + `membershipId` (the at-time visibility stamp).
- **QuestLog** — + `profileId`, + `membershipId` (credit);
  `@@unique([profileId, questId, day])`.
- **PointsLedger** — + `profileId` (career/tier), + `membershipId?` (team boards; NULL
  allowed only for offseason check-in/review sources).
- **Quest** — + `organizationId` (org-owned; global rows cloned per org at backfill).
- **Team** — + `organizationId` (the anchor). `parentId` retired at Stage 6.
- **Notification / TeamMessage** — + `authorProfileId` + `authorRole` **snapshot**
  (ORG_ADMINs with no membership can post; display survives later role changes; SetNull so
  posts survive rare person deletion).
- **NotificationRead / MessageReaction** — + `profileId` (per-person uniques mirrored).
- **User** — becomes login-only. `role`/`teamId`/`photoUrl` dropped at Stage 6.
- **Unchanged:** PushSubscription (devices belong to the LOGIN; cron resolves
  User→Profile→memberships), RateLimit.
- **Dissolved at Stage 6:** PlayerProfile (fields split into Profile).

### Cache discipline (same as today's, extended)
Every ledger insert runs in one transaction that also increments `Profile.careerPoints`
and (when stamped) `Membership.points`; undo decrements both; recompute helpers exist for
reconciliation. Card tier reads careerPoints; team boards read Membership.points; weekly
boards sum ledger by `(membershipId, createdAt)`.

---

## 4. AUTHORIZATION — one helper, one matrix

Single module **`lib/authz.ts`**; no scattered role checks anywhere else.

```ts
can(ctx, action, target: { organizationId; teamId?; membershipId? }): boolean
requireCan(ctx, action, target)   // throwing/refusing variant for actions
```

Resolution order: **(1) org-bound check first, always** (target org must be one where ctx
holds an unrevoked ORG_ADMIN grant or an active membership — cross-org fails before any
role logic); (2) ORG_ADMIN grant → org-admin matrix row; (3) else active membership on the
target team → that role's row; (4) else deny. The matrix in §2.10 is encoded as a constant
map, unit-tested cell by cell.

**The journal guarantee (structural, not permission-based):** journals/reviews have NO
action in the matrix — there is nothing to grant. A single data module
(`lib/data/reflections.ts`) is the only code allowed to touch those tables, and its entire
read surface takes **no profile parameter** — every function derives the profile from the
session context, so the signature cannot express "someone else's journal." Backed by a CI
grep that fails the build if `prisma.journalEntry` / `prisma.dailyReview` appears outside
that module. Coach surfaces continue to receive only status booleans/timestamps. (Postgres
RLS noted as optional future hardening; not load-bearing.)

**Takeaway rule:** reads join `takeaway.membershipId → membership.teamId` and gate with
`can(view_takeaways)` — only that day's team staff, org-bounded, can ever match.

---

## 5. SESSION CONTRACT

New resolver **`getCurrentContext()`** (`lib/context.ts`):

```ts
Ctx = {
  user      { id, email, username }
  profile   { id, name, photoUrl, setupCompletedAt, careerPoints, streaks, ... }
  memberships ActiveMembership[]     // all active
  membership  ActiveMembership|null  // the ACTING one
  team / org / season                // of the acting membership
  orgAdminOf number[]                // unrevoked org grants
}
```

**Acting membership:** exactly one active → implicit. 2+ → httpOnly cookie (`e24_ctx`)
selects; validated against the profile's active memberships on EVERY request (a hint,
never an authority); stale/foreign → most-recent fallback. Switcher UI renders only when
`memberships.length > 1` (or org-admin-without-membership context). Zero memberships + no
grants → "no active team — join with a code" screen.

**Backward compatibility:** `getCurrentUser()` remains exported with today's exact shape,
reimplemented as a shim over ctx (role collapses to COACH/PLAYER; teamId = acting team;
profile.points ← careerPoints; onboardedAt ← setupCompletedAt). Surfaces migrate off the
shim one at a time; the shim dies at Stage 6. Auth internals (JWT uid-only, middleware)
untouched.

---

## 6. STAGED MIGRATION (strangler — every stage leaves the app working + committed)

### ✅ Stage 0 — Additive schema — **BUILT + COMMITTED (`6dcf636`), migration NOT yet applied**
**As built:**
- All §3 tables/columns/indexes added to `prisma/schema.prisma` alongside the old model;
  migration `prisma/migrations/20260810221114_hierarchy_stage0_additive/` (286 lines)
  generated by local schema-to-schema diff (no DB contact) and verified **strictly
  additive**: 6 CREATE TABLE, 11 nullable-column ALTERs, 21 indexes, 4 enum-value adds,
  zero DROP/NOT NULL/data statements. New enum values are added but never used in the
  migration (single-transaction-safe on PG15).
- Prisma client generated; full production build green with the old app completely
  untouched.

**Deltas from the design doc (recorded for the reviewer):**
1. **`Role` enum extended in place** rather than created fresh: existing values
   `COACH`/`PLAYER` + the four new ones. `COACH` is marked legacy-do-not-use and is
   removed at Stage 6. (Design showed only the 5 target values; extension is the additive
   path on a shared DB.)
2. **`User.profileRecord`** is the temporary relation name for User→Profile, because
   `User.profile` is still taken by the legacy `PlayerProfile` relation. Renamed to
   `profile` at Stage 6 when PlayerProfile dissolves.
3. **Mirrored uniques added early** on legacy tables (`[profileId, day]`,
   `[profileId, questId, day]`, `[notificationId, profileId]`, `[messageId, profileId]`)
   — safe now (Postgres treats NULLs as distinct) and they catch backfill bugs at Stage 1
   instead of at cutover.
4. **One type-only app edit:** `DevUserSwitcher`'s local `Role = "COACH"|"PLAYER"` union
   widened to `string` (it only renders a label) — the sole app-code touch in Stage 0.
5. FK actions as generated: Cascade only Profile→person-owned data; SetNull on author
   snapshots (posts survive person deletion) and on optional org/membership dims;
   Restrict on structural FKs (Season→Org, Membership→Team/Season).

**Gate:** owner reviews the SQL → `npx prisma migrate deploy` against the shared DB →
verify prod untouched → Stage 1.

### Stage 1 — Backfill ✅ DONE (executed against the shared DB 2026-08-10)
`scripts/backfill-hierarchy.ts` — dry-run default / `--execute` (guarded by
`BACKFILL_CONFIRM=<db host>`) / `--verify`; idempotent by construction (find-else-create +
`updateMany WHERE new-column IS NULL`); single transaction. Proven first on a throwaway
local Postgres (`scripts/localpg.ts`, embedded-postgres, UTF8 initdb), then run in prod.

**As built:** per Team → Organization (name = team name) + one current Season ("2026") +
`Team.organizationId`. Per User → Profile (identity/stats; careerPoints ← points; streaks;
setupCompletedAt ← onboardedAt, createdAt for coaches) + Membership (COACH→HEAD_COACH,
PLAYER→PLAYER; membership.points ← points); coaches also get ORG_ADMIN@their org. Every
legacy row stamped (ledger/logs/journal/review/takeaway+membership/reads/reactions/author
snapshots). 6 global quests cloned per org. **Production result: all 21 verify checks
PASS** (counts, full stamp coverage, both sum invariants); idempotent re-run creates 0.

**Incident + hardening (recorded for the reviewer):** the first execute created quest
clones with `active=true` and re-pointed ALL quest logs. Both are visible to the legacy
app: `listActiveQuests()` filters only on `active` (page briefly listed 18 quests), and
the quest page matches TODAY's logs by global quest id (a re-pointed today-log would show
incomplete and allow double completion). Fixed within minutes by
`scripts/hotfix-stage1-legacy-window.ts` (clones deactivated; today-log revert — prod had
**zero** today-logs, so no player ever saw a wrong state and no duplicates existed). The
backfill script is now hardened so re-runs are legacy-invisible by construction:
**clones are created INACTIVE** and **only `day < today` logs are re-pointed**; verify
asserts both. Today-window logs converge at the Stage 4a cutover (below).

### Stage 2 — Choke point v2 ✅ DONE (`53777c7`)
**As built:** `lib/context.ts` (getCurrentContext; acting membership implicit-when-one /
`e24_ctx` cookie-when-2+, validated every request, most-recent fallback; cookie SETTER
lands with the switcher UI at Stage 5) · `lib/authz.ts` (§2.10 matrix as a constant map;
org-bound first; a membership carrying ORG_ADMIN fails CLOSED — org authority only via
RoleAssignment; hole caught by the matrix tests) · `lib/data/reflections.ts` (the only
module that may query JournalEntry/DailyReview; content fns derive the author from ctx —
no profile parameter exists; coach status fns content-free; enforced by
`scripts/check-reflections-boundary.mjs` on every build via npm prebuild, incl. Vercel) ·
`lib/seasons.ts` startNewSeason transaction · compat `getCurrentUser()` shim.

**Shim delta (recorded):** the shim returns `ctx.user` — the legacy row loaded by the
VERBATIM legacy query — rather than reconstructing the shape from new-world fields as the
design's mapping table sketched. Identity beats mapping while legacy columns still exist
(they die with the shim in Stage 6). Proven byte-identical for every user by
`tests/shim-identity.test.ts`, including a legacy-only login created after the backfill.

**Tests:** 115 passing — every matrix cell transcribed from the plan independently of the
code map, cross-org denial before role logic, acting-membership fallbacks, the
one-current-season invariant (sweep + rollover ×3), shim identity. Stage 2 wrote ZERO
database rows (the Stage-1 incident class is structurally impossible here).

### Stage 3 — Dual-write ✅ DONE (`893ac1b`)
**As built:** `lib/data/points.ts` holds the points write paths — extracted VERBATIM from
the actions and extended so every transaction stamps `profileId`/`membershipId` and
updates PlayerProfile.points + Profile.careerPoints + Membership.points in the SAME
commit; undo reverses by the ledger row's OWN stamps. Offseason ruling applied
(check-in/review: profile stamp + nullable membership; quests/adjustments:
all-or-nothing). Stamps across every writer: reflections creates, takeaway (at-time
membership; updates fill pre-Stage-3 rows), notification/message author snapshots,
reads, reactions, onboarding/brand/coach-photo Profile mirrors. **join** now creates
Profile + current-season Membership with the login; **signup** creates the whole world
in both models (org, season, team, profile, HEAD_COACH membership, ORG_ADMIN grant,
quest clones INACTIVE — the Stage 1 lesson applied at the source). **removePlayer**
(still the legacy hard delete until 4e) now also ends the target's memberships and
re-trues the new caches after the ledger cascade, in one transaction. Legacy-only
logins (pre-Stage-3 signups) stamp nothing and converge at the 4a backfill re-run.
End-to-end test suite drives the real write paths and asserts all three
cache==Σledger invariants after every step. Audit: no legacy query filters on any
stamped column; the only new rows in legacy-queried tables are inactive signup clones.

### Stage 4 — Surface-by-surface cutover (easiest → hardest)
- **4a** ✅ DONE in branch (`e5de7e6`) — home/quests/journal on getCurrentContext;
  `listActiveQuestsForOrg` with a legacy-global fallback that makes the new code correct
  in BOTH database states (no deploy/flip race — dies at Stage 6); org-bound guard on
  quest actions; `scripts/converge-quests.ts`: the atomic, state-aware, idempotent flip
  (logs re-point + clones inherit actives + globals retire, ONE transaction) with a
  symmetric one-command `--rollback`. Round-trip proven on local PG, including the
  ordering fact that a legacy-shape read post-flip shows every org's clones — hence the
  runbook order: backfill re-run → **merge+deploy** → converge flip → verify. The prod
  flip runs only on owner approval of that runbook.
- **4b** Brand / photo route / identity chip → profile reads; team-equality checks become
  org-bounded `can()` checks; **implements the visibility tightening** (Dream + stats no
  longer teammate-visible; card info only).
- **4c** Board + notifications → author snapshots, receipts by membership roster,
  TIME OUT = acting team only.
- **4d** Leaderboards + points → team boards from membership sums; weekly from
  ledger(membershipId); tier from careerPoints.
- **4e** Coach surfaces + matrix live → roster views via memberships; adjustPoints targets
  a membership; **Remove becomes endMembership** (the destructive fix); HC/AC/GM
  differentiated UI.
- **4f** Signup / join / onboarding → signup creates User+Profile+Org+Season+Team+
  HEAD_COACH membership+ORG_ADMIN grant; join = membership into current season, with the
  **returning-athlete path** (existing login joins a new team from inside the app); setup
  gate for everyone; "no current season" join error.

### Stage 5 — Seed v2 + dev switcher
Orgs/seasons/memberships/grants incl. an ASSISTANT_COACH, a GM, an org-admin-without-
membership, and a two-team athlete (exercises matrix + switcher). DailyReview demo rows
(existing gap). Dev switcher groups org→team→member and sets the acting cookie.

### Stage 6 — Decommission (the ONLY destructive stage; after merge → deploy → soak)
Remove shim + legacy reads; drop User.role/teamId/photoUrl, legacy userId columns,
PlayerProfile, Team.parentId, orphaned global quests; enforce NOT NULL on the new keys;
rename `User.profileRecord`→`profile`; retire legacy `COACH` enum value.

---

## 7. OPERATIONAL CONSTRAINTS
- **Shared database:** prod `main` runs against the same Supabase DB the whole time.
  Stages 0–3 therefore ship only additive migrations + additive data. Stage 6 waits for
  merge + production soak.
- **Branch discipline:** all work on `hierarchy-rebuild`; only `main` auto-deploys;
  nothing is pushed/merged without owner OK (standing rule).
- **Every stage:** builds green, is committed, and leaves the running app unchanged until
  its cutover stage explicitly changes behavior.

## 8. OPEN ITEMS
1. **NOW:** build Stage 4a (person-scope cutover + quest converge step). Note the
   dual-write code ships to prod only when the branch merges — until then prod keeps
   writing legacy-only rows, all converged by the idempotent backfill re-run at 4a.
2. Legacy writes between Stage 1 and Stage 3 create unstamped rows by design — the
   idempotent backfill re-runs at 4a (and can be re-run any time) to converge them.
3. Stage 4b ships the teammate-visibility tightening (Dream/stats hidden) — flag for
   comms to existing users when it lands.
4. Parent portal: separate initiative after this migration (design hooks already in place).
5. Person-deletion operator script: written as part of Stage 6 scope.
