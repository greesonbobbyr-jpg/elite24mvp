# MIGRATION-HANDOFF.md

> Written 2026-09-13, on the old laptop (`C:\Users\arrow`), the day before it was
> wiped. You are reading this on a different machine (`C:\Users\grees` or similar)
> as a Claude that has never seen this project. The code explains itself; this file
> holds only what the code cannot tell you: where we stopped mid-motion, why things
> are the way they are, what we already tried and abandoned, and what bites.
>
> Read `CLAUDE.md` first (but see §5 — parts of it are stale), then `HIERARCHY_PLAN.md`,
> then this. The owner is **Bobby Greeson** (greesonbobbyr@gmail.com). "Gary" is the
> creator of the E24P coaching method (Bobby's uncle) and the seeded head-coach persona.
>
> **§0 below was added on the new laptop (2026-09-25) and overrides anything older.**

---

## 0. SINCE THE MOVE (2026-09-25) — read this first

**Codex worked on the card, 2026-09-13 → 09-19.** ChatGPT Codex changed the Platinum
card directly in this checkout without committing; it was committed as a snapshot in the
same commit that added this section. It replaces §1A's five-file asset contract:

- One authored image per level: `public/card/finishes/<level>/plate.webp` (frame +
  background + empty stat boxes, cut from the owner's card art; built by
  `scripts/card-art.ts`).
- An authored energy texture per level (`field.png`; Platinum's is derived from the
  approved B3 reference `design/reference/platinum-b3-outward-approved.png`), attached per
  player to the tops of the shoulders (`FoilField.tsx`, `lib/portrait/foil.ts`).
- Live number / name / stats (`DynamicLayers.tsx`) plus alpha-traced electricity and rim
  light (`PortraitElectricity.tsx`, `CutoutLighting.tsx`), colored by the level's palette
  (`lib/cardTheme.ts`).
- Codex's own notes: `CARD-REDESIGN-HANDOFF.md`, `CARD-VISUAL-PLAN.md`, `public/card/README.md`.
- **Platinum is owner-approved and the geometry is locked (2026-09-26).** The approved
  render is the baseline in `design/baselines/`.

**Owner decisions, 2026-09-25:**

- Review Platinum together with the owner before locking the geometry.
- Bronze / Silver / Gold / Diamond art: **recolor the approved Platinum art with a script**.
  Any file can later be swapped for designer art under the same filename.
- Work order: quick fixes from the owner's notes → cards → org tree → bigger note features.
- The project moves out of OneDrive to `C:\dev\elite24mvp` (the OneDrive copy is a backup).
- **Org view:** rebuild it to the owner's sketch, `design/reference/org-tree-sketch.jpg`.
  It's a top-down branching tree: search bar → Org Owner card → age-group divisions (12U…17U)
  → Head Coach cards (one per team) → player cards. Tap a node to branch out its children;
  search opens the right branch. The 2026-08-13 `/org/view` on `grouping-layers` did not
  match: staff shown as player cards, no connecting lines, phone bugs.
- **E24 Commissioner = announcements, not a data view** (owner clarified 2026-09-25). The
  app owner (Bobby or Gary) needs a way to send ads, updates and app news to all players,
  orgs, leagues, etc.; orgs should be able to send certain things to their own org too.
  No cross-org viewing of player data, so there's no conflict with CLAUDE.md §3.2.
  ⚠ "Ads" reaching player accounts (kids as young as 10) needs an owner ruling under §3.1;
  the recommendation is promotional messages to adults only, clearly labeled, no tracking.

**Owner's handwritten notes (September) — status after a code audit:**

| Note | Status |
|---|---|
| Username login "only email works" | Real: staff have no username; typing "@name" hits the email lookup; iOS autocorrect is on. Quick fix. |
| Pages open slightly zoomed in; you have to zoom out | Two causes: content wider than the phone on some pages (e.g. the fixed 320 px card on `main`), and iOS zooming into 14 px inputs (login, check-in) with the zoom persisting across in-app navigation. Quick fix: overflow check of every page + 16 px inputs on phones. |
| Height in ft + in | Single "inches" box today. Quick fix. |
| Coach sets reminder time | Per-team hour exists, dropdown limited to 3–8 PM. Widen now; minutes + timezone later. |
| Emergency contact / org info | `ProfileContact` + permissions exist, no UI. Later. |
| GM spot + add assistant coaches | Roles exist; no invite UI (seed-only). Later. |
| Coach pictures in Alerts / Timeouts / Team Circle | Not started; needs private storage. Later. |
| Links in Team Circle (coach only) | Not started. Later. |
| Owner announcements to everyone; orgs to their own org | Not started. Alerts are per-team only today. Later. |
| Timeouts + assignments | Timeouts done; "assignments" needs defining. Later. |

Also found by the audit (quick fixes): old Timeouts are shown to newly joined players;
the unread badge sticks past 50 alerts; a two-team athlete can get stuck behind a
Timeout; removed players still get reminders; Team Circle shows Delete to assistant
coaches and GMs, whose deletes the server refuses.

Full plan (local to the new laptop; the essentials are above):
`C:\Users\grees\.claude\plans\c-users-grees-claude-uploads-a1d7a349-e-harmonic-sparkle.md`

### Deployed 2026-10-02: quick fixes, light/dark mode, the new cards, the org tree

The owner said "merge and deploy to live". `main` was fast-forwarded to `grouping-layers`
(fd826f7), which contains everything (`theme-modes` → `card-redesign` → `grouping-layers`).
In order: `npx prisma migrate deploy` applied `20260814032118_card_photo_cutout` (six empty,
optional photo columns) and `20260928120000_grouping_program_division` (Program, Division,
an optional `Team.divisionId`); `scripts/backfill-structure.ts` dry run → `--execute` with
`BACKFILL_CONFIRM=<host>` → `--verify` (2 orgs, 2 teams → hidden "Main" program and
division, all checks pass); then `git push origin main`. The Vercel build succeeded.

After it: existing players' full cards say "Photo pending" until each player opens Your
Brand → Edit my brand → **Re-cut photo** → Save.

### Deployed 2026-10-06: the light-mode revamp (`light-revamp`, 011af26)

The owner, looking at light mode on the live app: things that should have an outline don't,
nothing looks finished, and the accent is see-through and should be "a deeper more solid
reddish orange". Decisions: accent **#D2361A**, solid, in both modes; Team Circle's other
people's messages are solid accent bubbles in light mode too. The rules are in CLAUDE.md §9
("Light & dark design rules"); the guardrails in §6.

- Color roles in `app/globals.css` (accent, a gray page with white cards and visible edges,
  field outlines that pass WCAG non-text contrast, solid status colors, the always-black
  frame, the logo red); shared pieces in `app/components/ui/`; every page swept.
- Guardrails: `tests/theme-guard.test.ts` (no raw, see-through or hard-coded colors),
  `check-pages.ts --outlines` (every card, row and field has a visible edge) and `--pinned`
  (the Appearance switch wins over the phone), and the dev-only `/style-guide` with its
  baselines `design/baselines/style-guide-{light,dark}.png` (`scripts/shoot-style-guide.ts`).
- Card art: the mini frame's dark backdrop is now fully transparent (`scripts/card-art.ts`;
  it showed as a gray box behind every player row on a light page). Card baselines unchanged.
- No schema change, no migration, no new environment variables.

Deployed on the owner's go ("Deploy"): `main` fast-forwarded to `origin/light-revamp` and
pushed; the Vercel build succeeded. No migration was needed (production schema up to date).

**Then (2026-10-06): the accent became the wordmark's red.** The owner didn't like the
red-orange: "Change it to the color of the 24 in elite24mvp. But keep any other changes."
The accent is now `#E1102A` (branch `accent-logo-red`), with accent text a shade darker on
the light page (`#C00D24`) and lighter on black (`#FF3B4F`) for contrast. Only color values
in `app/globals.css` changed, plus the style-guide baselines.

**Then (2026-10-06): light-mode polish** (branch `light-polish`), from the owner's
screenshots: the full card showed the plate's black surround as a box on a light page (now
clipped to the frame's outline, `CARD_SILHOUETTE`; card baselines re-recorded, identical
inside the outline); the roster and leaderboard lists looked like loose pieces (each now
one panel, with roster status as chips); the sideways rows' frame edges looked ragged (the
mini frame is now cut from one even band of the rail, `scripts/card-art.ts`). No migration.

### Deployed 2026-10-09: home tiles, star progress, the "read" reaction (`home-alerts-polish`, 66bb147)

From the owner: the home tiles' values sat at the top and "PROSPECT" didn't fit; "915 pts to
Bronze" "is not the ranking system" (it's stars); marking an alert read showed no reaction.
Now the tiles (`app/components/ui/StatTile.tsx`) center the value with the label at the
bottom; progress reads "N pts to M★" (`starProgress()` in `lib/cardTheme.ts`, also on
Quests); tapping "I've read this" folds the card away with a toast ("✓ Marked as read · N
still to read") (`notifications/UnreadAlerts.tsx`). Style-guide baselines re-recorded.
No migration. Deployed on the owner's "Deploy": `main` fast-forwarded to 66bb147 and pushed.

**Next (approved plan, 2026-10-09): accounts for everyone, the CEO, flexible org structure,
announcements.** Plan: `~/.claude/plans/c-users-grees-claude-uploads-a1d7a349-e-harmonic-sparkle.md`.
The owner approved the Phase 0 mockup (`/preview/*`, dev only). The order was changed so that
Gary Harper (the CEO) can log in sooner: Phase 1, then the CEO step, then Phases 2 → 3 → 5.

### Ready, awaiting "Deploy": Phase 1 + the CEO step (branch `person-first-p1`)

- **Phase 1:**
  - `User.teamId` is nullable; screens read persona (`lib/persona.ts`), not `User.role`.
  - Personal athletes have no team.
  - Fixed: the removed-player TIME OUT bug; quests now earn career points with no team; new orgs get active quests.
  - The ☰ menu shows an unread count.
- **CEO step:**
  - `PlatformGrant`, `AuditEvent`, `User.mustChangePassword`.
  - CEO View `/ceo`, read-only, never journals or reflections.
  - Change password.
  - `scripts/grant-platform-role.ts`.

**Production runbook.** Migrations are additive; the `.env` database is production.

1. `npx prisma migrate deploy` applies `user_team_optional` and `ceo_platform_grant`.
2. Turn on the Elite24 quest set for no-team athletes. The 2026-10-09 dry run showed 0 of 6 active and no empty orgs.
   - `BACKFILL_CONFIRM=<host> npx tsx scripts/activate-platform-quests.ts --execute`
   - Then `--verify`.
3. Fast-forward `main` to `person-first-p1` and push; wait for Vercel's "Deployment has completed".
4. Create Gary's account. The owner asked for it on 2026-10-09; the starting password came from the owner in chat, is passed only as an env var, and is never written down.
   - `BACKFILL_CONFIRM=<host> CEO_INITIAL_PASSWORD=… npx tsx scripts/grant-platform-role.ts --email <Gary's email> --name "Gary Harper" --execute`
   - Then `--verify`.
   - At first login he must pick his own password.

---

## 1. WHERE WE ARE (mid-motion, this second)

Two workstreams were live when the laptop was retired. Last real work: **2026-08-25**.

### A. The Player Card compositor — at a deliberate HARD STOP (branch `card-redesign`)

The card system was rebuilt twice. The current architecture ("Plan v4") is a
**deterministic layered compositor**: authored static artwork + dynamic player/data
layers + mask-driven live lighting. The full engineering scaffold is built and
committed (`0f519e3`); it renders today with amber **ASSET MISSING** placeholders
because the real Platinum artwork does not exist yet.

**We are waiting on the owner to supply production art.** The exact contract —
filenames, pixel sizes, alpha rules, layer positions, what may/may not appear in
each file — is codified in `lib/cardAssets.ts` (typed) and `public/card/README.md`
(human drop-zone guide). Required to unblock: `public/card/finishes/platinum/
{chassis,background,chassis-fg}.webp`, `public/card/masks/{foil,reflection}.webp`,
plus a Cason Wallace cutout for the checkpoint portrait.

When those land, the next motion is exactly: run the **Platinum checkpoint**
(`/card-preview?master=1&static=1` in the dev preview; `npx tsx scripts/shoot-cards.ts
--master` to capture it at 2000×3000), overlay it against the reference, present to
the owner, iterate, and only on his explicit approval declare **GEOMETRY LOCKED** —
then and only then build Bronze/Silver/Gold/Diamond.

Meaningful progress since the stop: the owner's designer produced near-final card
art via ChatGPT. The **`design-reference/pitch-deck/card-art-source.pptx`** in this
repo contains, as embedded media (unzip it; it's a zip — `ppt/media/image*.png`):
the finished 1000×1500 Platinum card render, the **empty Platinum chassis with
background (1024×1536)** — the closest thing to the required `chassis`/`background`
assets that exists — the original Cason Wallace photo, and his alpha cutout. It is
NOT yet split per the asset contract (no separate face-window transparency, no
masks), but it is the source to cut them from.

### B. The pitch deck — DELIVERED (lives outside the app)

Gary presented an investor/partner-ish pitch (~Aug 26). The deck is a single
self-contained HTML slide deck (15 slides, white background, arrow keys, `F`
fullscreen, `S` speaker notes), archived at
**`design-reference/pitch-deck/Elite24MVP-Pitch.html`** — this file IS the deck,
with every screenshot and card render embedded as base64. A PDF export and this
HTML were also placed on the old machine's OneDrive Desktop
(`Elite24MVP-Pitch.html/.pdf`) and published privately at
`https://claude.ai/code/artifact/7a82a2cf-08a8-4d2d-a19b-8f2f92c33ec4`.

Unfinished on the deck: the title/close slides say just **"Gary — Creator &
Founder"** (his last name was requested repeatedly, never provided), and the owner
never said "push it" on hosting the deck at `elite24mvp.vercel.app/pitch` (which
would require a push to `main` → auto-deploy — see §7). The deck's build scripts
(`build-deck.js` etc.) lived in a session scratchpad and are **gone**; to change the
deck now, edit the archived HTML directly (it's readable), or rebuild from scratch —
the two one-off visuals it needs are archived beside it (`missing-piece-comparison.png`,
`hierarchy-profile-out.png`; these existed nowhere else recoverable).

### C. Production state

Production (`elite24mvp.vercel.app`, Vercel auto-deploy from `main`, Supabase
Postgres) runs the **merged + converged hierarchy rebuild** (multi-tenant
Organization/Season/Profile/Membership) as of 2026-08-12. It went through a
dual-write → backfill → atomic converge flip; all 21 verify checks passed. It has
been in "production soak" ever since — the owner **never formally declared soak
complete**, so the Stage 6 legacy-decommission (deleting the legacy fallback paths
marked "dies at Stage 6" throughout the code) has not been done.

---

## 2. WHY THE BRANCHES EXIST

Pushed to GitHub as part of this handoff (they existed only on the wiped laptop):

- **`main`** — production. Every push auto-deploys to Vercel (§7). At handoff time
  local `main` was 1 commit ahead of `origin/main`: `c487132`, a docs-only update
  to `HIERARCHY_PLAN.md` ("merged + converged, soak begins" + post-merge roadmap).
  That commit is deliberately NOT pushed to `origin/main` (a push deploys); it is
  preserved because it is the ancestor/base of `card-redesign` and the tip of
  `hierarchy-rebuild`, both pushed. When the owner next approves any push to main,
  it rides along or fast-forwards trivially.

- **`card-redesign`** — ALIVE, the active workstream. Branched from `main`
  (`c487132`). Ten commits: geometry/finish-token foundations, screenshot+overlay
  harness, the on-device photo pipeline (upload → background removal → face/shoulder
  normalization), the v3 card build, its recomposed sizes, the StaffCard family,
  and finally the v4 compositor replacing v3's rendering. **Do not merge** until:
  Platinum checkpoint passed → owner approves → GEOMETRY LOCKED → four other
  finishes derived → regression baselines committed → its own deploy runbook
  (it carries a schema migration applied only locally — §5). Plan of record:
  `C:\Users\arrow\.claude\plans\eventual-pondering-panda.md` on the old machine is
  gone; the plan's operative content is encoded in `lib/cardAssets.ts`,
  `public/card/README.md`, the commit messages of this branch, and §3 below.

- **`grouping-layers`** — ALIVE and COMPLETE, awaiting an owner-gated deploy after the
  cards. Adds Program/Division grouping between Organization and Team (additive migration
  `20260928120000_grouping_program_division`, re-dated to sort after the card migration),
  an ORG_ADMIN structure-management page (`/org`), and the org tree (`/org/view`, rebuilt
  2026-09-28 to the owner's sketch) with progressive disclosure (single-entry layers
  hidden). Contains `card-redesign` (merged in). Deploy runbook: §0, "Then: the org tree".

- **`hierarchy-rebuild`** — DEAD, fully merged into `main` via `aa00fb0`.
  Safe to delete after confirming `origin/main` contains it (it does).

- **`master`** — DEAD. The original pre-rebuild line; entirely an ancestor of
  `origin/main`. Its stash (`WIP: PlayerCard chunk...`) was an early card
  experiment fully superseded by `card-redesign`; both branch and stash were
  intentionally left to die with the laptop. Nothing to recover.

---

## 3. DECISIONS AND THEIR REASONS (don't relitigate these)

### The card system (owner rulings — several were hard-won reversals)

- **Authored art, never CSS-fabricated.** The v3 card built the chassis from
  clip-paths, conic gradients and feTurbulence. The owner rejected it flatly:
  "a web UI styled to resemble a card." Plan v4's rule is absolute: physical
  card artwork (chassis, background, stat-rail/footer chassis, foil/reflection
  masks) comes ONLY from authored image assets; a missing asset renders a labeled
  **ASSET MISSING** state and that layer STOPS. There is no "try CSS first"
  fallback. Never generative AI at render time either.
- **Authority chain before lock:** approved visual reference → human visual
  judgment → the provisional 1000×1500 geometry numbers. Coordinates bend to the
  reference, never the reverse. Pixel diffs are diagnostic only; **only the owner
  declares GEOMETRY LOCKED**, never Claude. After lock, pixelmatch becomes
  regression protection (baselines in `design/baselines/`, shot with `?static=1`).
- **One geometry, five materials.** Prospect level (1★–5★ from career points:
  0 / 1,000 / 5,000 / 20,000 / 50,000 — owner chose these over the old
  100/300/700/1500) selects FINISH tokens/assets only. **Team identity is a
  separate token system** (`TeamAccent` — environmental light/accents only) and
  must never recolor the physical metal. A 3★ kid on a red team gets a GOLD
  chassis in a red-lit room.
- **Naming:** user-facing tier language is always **"PROSPECT" + earned stars**.
  Bronze/Silver/Gold/Platinum/Diamond are internal token names that never render
  (the owner extended this rule to the pitch deck too). Stars are **earned only**
  — never hollow/dim placeholder stars.
- **Layout rulings:** team logo top-LEFT; top-right intentionally EMPTY (a slot
  component that renders nothing — no Player ID, no invented filler); giant
  background number zero-padded for single digits ("07") while the details line
  stays "#7"; the cutout's own opaque pixels ARE the giant number's occlusion
  (ordering, not masks).
- **Photo failure = rejection, not degradation (Δ5).** A failed upload stores
  nothing and shows: "We couldn't create your Player Card from this photo. Upload
  a clear chest-up photo facing the camera with your full head and shoulders
  visible." Players without a photo get a clearly-PENDING initials state — a
  rectangular photo never renders in the hero zone. But general UI (avatars,
  compact rows) keeps photo/initials fallbacks.
- **Validation starts conservative (Δ12).** Hard-reject only: no face, multiple
  significant faces, head cut off, genuinely too-low resolution, catastrophic
  segmentation, normalization impossible. Brightness/blur are soft warnings,
  never gates. Thresholds tune only after a real 8–12-photo stress test — which
  has NOT run; the portrait system is explicitly **NOT PRODUCTION-READY** until
  it does (Δ7).
- **On-device photo processing** was chosen deliberately (minors' app — the
  photo never leaves the phone for processing): `@imgly/background-removal` WASM
  + self-hosted model, MediaPipe BlazeFace for landmarks. Landmarks primary,
  alpha-silhouette secondary, never alpha-bounds-only (hair/hoodies would shrink
  the athlete). Normalization anchors the EYE→SHOULDER span.

### Hierarchy / data model

- `endMembership` ends (never deletes); a same-team+season rejoin REACTIVATES the
  old membership so board points return (forced by the unique constraint + ledger
  sum invariant). Career points (`Profile.careerPoints`) cross teams/orgs by
  design — they are the athlete's; `Membership.points` is the per-team board.
- **Converge rollback rule** (still relevant until Stage 6): if the quest system
  must be rolled back, run `npx tsx scripts/converge-quests.ts --rollback` FIRST;
  never revert the deploy while the DB is in converged state. Both scripts are
  state-aware/idempotent.
- Legacy fallbacks guarded by `isPreBackfillTeam`-style checks exist on purpose
  and are all tagged "dies at Stage 6."

### Infrastructure

- **Local test DBs:** embedded Postgres on port 5433 (`scripts/localpg.ts`),
  with TWO databases: `e24local` (hierarchy/grouping work, has the grouping
  migration) and `e24cards` (card branch, has the cutout migration). They were
  split because the two branches' migrations diverge and `prisma migrate deploy`
  would break crossing them. On a fresh machine the data dir is empty — just
  `npx tsx scripts/localpg.ts start e24cards` (keep the launcher process alive),
  `prisma migrate deploy`, then seed. The data dir is `~/.e24-localpg` (it was
  in `%TEMP%` until 2026-09, where Windows' temp cleanup deleted the cluster).
  `e24main` is the quick-fixes / light-dark database.
- **`@imgly/background-removal` is PINNED to 1.4.5** — see §4. Model assets are
  copied into git-ignored `public/bg-removal/` + `public/face/wasm/` by the
  postinstall script; the tiny BlazeFace `.tflite` IS committed.
- Pitch-deck rulings: white background; thesis is **"THEY build the team, WE
  build the player"** (they = TeamSnap/SportsEngine — never "everybody"); only
  page 1 of the card pptx is used (owner explicitly rejected page 2); business
  content light, no "ask" slide.

---

## 4. DEAD ENDS (expensive to rediscover — do not retry)

1. **CSS/SVG card chassis (the entire v3 rendering).** Built completely
   (commits `5c8fc50`…`6937550`), looked like "a web UI styled to resemble a
   card," rejected by the owner, deleted in `0f519e3`. Any instinct to "just
   approximate the frame with gradients until the art arrives" is explicitly
   forbidden — that's what the ASSET MISSING state is for.
2. **`@imgly/background-removal` 1.7.0 with self-hosted assets.** 1.7.0 expects
   a 1.7.0 data package layout (`/models/isnet_fp16` keys), but the newest
   published `@imgly/background-removal-data` is **1.4.5** (`/models/medium`
   keys) — mismatched resources.json = runtime failure. Hence both pinned 1.4.5.
   Also: chunk files are named by bare content hash (`chunk.hash`, no extension).
3. **Prisma `startsWith`/`contains` with underscores.** `_` is a LIKE wildcard;
   filtering test-artifact names like `"__team"` via Prisma string filters
   matches everything/nothing. Filter in JS. This bit us twice.
4. **Starting embedded PG with `pg_ctl` directly** → "pre-existing shared memory
   block is still in use" wedges. Recovery that works:
   `taskkill //F //IM postgres.exe //T`, delete `~/.e24-localpg/postmaster.pid`,
   then relaunch via `scripts/localpg.ts` (keep that launcher process running —
   it holds the daemon; killing it mid-startup wedges the cluster).
5. **Detecting Vercel deploys by content-hashed chunk fingerprints** — false
   negatives when the page you probe didn't change. The reliable signal is the
   GitHub commit-status API on the pushed SHA ("Deployment has completed").
6. **`rm -rf .next` while the dev server is running** — destroys the live dev
   cache, every route 500s. Stop the server first. (OneDrive also corrupts
   `.next` on its own; same recovery.)
7. **Uniform dilate+blur rim light around the cutout** reads as a cheap neon
   sticker outline. Survives only as the face-damped, shoulder-weighted
   `RimLight` SVG filter — don't "simplify" it back to a drop-shadow chain.
8. **Chromium PDF/preview note:** changing `location.hash` alone doesn't reload
   a deck page — the archived deck listens for `hashchange`, but any Playwright
   automation should navigate-then-`reload()`.

---

## 5. UNCOMMITTED OR DELIBERATE ODDITIES

- **`.env` is git-ignored and now DESTROYED with the laptop.** It held the real
  Supabase connection strings (DATABASE_URL pooler :6543 / DIRECT_URL :5432),
  AUTH_SECRET, VAPID keys, CRON_SECRET. All values are recoverable from the
  **Vercel project's environment variables** (owner has access). `.env.example`
  documents the shape. Nothing else secret existed locally.
- **`CLAUDE.md` §6 was stale** (it said "SQLite via Prisma"). Corrected
  2026-09-25 to the real stack: Supabase Postgres in prod, embedded local
  Postgres for tests, Auth.js v5 credentials+JWT, real Web Push (VAPID), Vercel.
  The Non-Negotiables (§3) and scope rules in CLAUDE.md remain in force.
- **`AGENTS.md` (untracked)** is the owner's own copy of CLAUDE.md (retitled)
  that he feeds to ChatGPT. Deliberately left untracked; don't delete, don't
  commit without asking.
- **Migration `20260814032118_card_photo_cutout` is committed on `card-redesign`
  but has NEVER run against production** — it was applied only to the local
  `e24cards` DB. Production gets it via the card branch's own deploy runbook.
  Similarly `20260928120000_grouping_program_division` (on `grouping-layers`)
  is local-only (`e24local`).
- **`/card-preview` 404s in production on purpose** (NODE_ENV gate). The
  `/api/dev/reference/*` route likewise. Not bugs.
- **`public/bg-removal/` and `public/face/wasm/` are git-ignored on purpose**
  (~120MB of model/wasm assets); `npm install` regenerates them via the
  postinstall copy script. `public/face/blaze_face_short_range.tflite` IS
  committed (224KB, fetched once from Google's model CDN).
- **Two lint warnings/errors are pre-existing and accepted:** the
  `react-hooks/set-state-in-effect` error in `InstallBanner.tsx`, and unused-var
  warnings in `lib/context.ts` / `lib/leaderboard.ts` / `scripts/backfill-hierarchy.ts`.
- **Known open design flags on the card geometry** (to resolve at the Platinum
  checkpoint, not before): the approved reference screenshot's card region is
  ~0.60 wide:tall vs the 1000×1500 master's 0.667; the handoff's inner safe area
  "x 72–828" is assumed a typo for 72–928; the Barlow Semi Condensed typeface is
  PROVISIONAL until validated against the reference.
- **`design-reference/pitch-deck/`** was added by this very handoff commit — it
  archives the delivered pitch deck and the only copies of its irreplaceable
  inputs (see §1B). The 17MB is deliberate: the alternatives were a wiped
  Downloads folder and an assumed-alive OneDrive account.

---

## 6. WHAT COMES NEXT (in order)

1. **Cut the Platinum production assets** from `design-reference/pitch-deck/
   card-art-source.pptx` (unzip → `ppt/media/`): split the empty-chassis image
   into `chassis.webp` (transparent outside silhouette AND inside the face
   window) + `background.webp` + `chassis-fg.webp`, author grayscale
   `masks/foil.webp` (face region black) and `masks/reflection.webp`, all
   full-canvas 2000×3000 per `lib/cardAssets.ts` / `public/card/README.md`.
   This is image-editing work the owner/ChatGPT may do; Claude may NOT
   improvise these with CSS/SVG, but preparing/splitting supplied art is fine —
   ask the owner where the line is if unsure.
2. **Run the Platinum checkpoint and STOP for the owner.** Drop assets in,
   `npx tsx scripts/localpg.ts start e24cards` + seed + dev server on e24cards,
   open `/card-preview?master=1&static=1`, use the crop-aligned reference
   overlay, `scripts/shoot-cards.ts --master`, present, iterate on his eye.
   Only his explicit approval = GEOMETRY LOCKED. Then derive the other four
   finishes (assets only), commit baselines, run the 8–12-photo stress test.
3. **Deploy `grouping-layers`** (owner-gated runbook in §0, after the cards deploy). The
   migration ordering with the card branch is resolved (re-dated; the branch contains
   `card-redesign`).
4. **Close the hierarchy soak → Stage 6 decommission.** Ask the owner to declare
   the soak done (it began 2026-08-12; it's long past), then delete every legacy
   path tagged "dies at Stage 6" (legacy quest globals, `user.teamId` fallbacks,
   pre-backfill guards) in one reviewed sweep with the full suite green.
5. **Pitch follow-ups (small):** get Gary's last name onto the deck title/close;
   if the owner says "push it," host the deck at `/pitch` on the app domain.
   Then the deferred roadmap item: **person-first entry & org tier** (recorded in
   HIERARCHY_PLAN.md — profile-first signup like Instagram/LinkedIn; org
   creation gated by an Elite24-issued code; emergency contact visible to all
   staff, full contact ORG_ADMIN-only — these were owner-ruled).

---

## 7. GOTCHAS (things that bit us)

- **A push to `main` deploys production immediately** (Vercel). Never push main
  without the owner's explicit go. Feature-branch pushes are safe (no deploy).
- **The seed WIPES the target database.** Guards: it refuses without
  `SEED_CONFIRM=localhost`, and without `SEED_PASSWORD=password123` it generates
  a random password and every seeded login mysteriously fails (this cost us an
  hour once). Full local reseed:
  `SEED_CONFIRM=localhost SEED_PASSWORD=password123 DATABASE_URL=postgresql://postgres:localtest@localhost:5433/e24cards DIRECT_URL=... npx prisma db seed`.
- **Staff log in by EMAIL** (`gary@elite24.demo`), **players by USERNAME**
  (`jordan`, `diego`, …), shared password `password123`. "CredentialsSignin"
  usually means the wrong identifier type, not the wrong password.
- **Everything DB-ish needs the embedded PG running** (port 5433) and the right
  DB per branch (§3). The launcher process must stay alive. DB test suites
  self-skip unless `TEST_DATABASE_URL` points at localhost.
- **`prisma generate` fails with EPERM while the dev server runs** (query-engine
  DLL locked) — stop the dev server (and `taskkill //F` any orphaned `node.exe`
  holding port 3000; TaskStop-style kills leave children alive on Windows).
- **OneDrive was a constant source of pain** (corrupted `.next`, EPERM on
  renames, undeletable worktree dirs). The owner intended to move the project
  off OneDrive — if the new machine's checkout is outside OneDrive, several
  §4 recovery rituals become unnecessary.
- **Playwright needs its browser once per machine:** `npx playwright install
  chromium`. `scripts/shoot-cards.ts` refuses non-localhost URLs by design.
- Old-machine absolute paths (`C:\Users\arrow\...`) appear in this file and in
  archived scratchpad-era scripts; translate to the new user profile. The
  claude.ai artifact links and the OneDrive copies of the pitch deck belong to
  the owner's accounts and survive independently of the laptop.
