# CLAUDE.md — Elite24MVP App (Project Context)

> This file is your permanent context. Read it at the start of every session and keep its rules in mind for every change. If a request seems to conflict with the **Non-Negotiables** below, stop and ask before proceeding.

---

## 1. What we're building

A team-private basketball development app that wraps around an existing coaching method (the **Elite24MVP / E24P process**, created by the project owner). The physical coaching playbook is the owner's domain and lives *outside* this app. This app is the **digital companion**: it makes the daily improvement habit easy, stores it, and gives a coach a way to run it with a whole team.

**The one-sentence north star:** Help a player take ownership of their own development by writing down their dream, committing to one improvement each day, logging the work, and seeing their progress and accountability over time — inside a private team space their coach controls.

This is being built as a real product that will eventually be sold to parents and schools. Treat every decision (data handling, safety, clarity) as if a parent and a school administrator will inspect it.

---

## 2. The core loop (the heart of the app — get this right above all else)

1. Player onboards: profile basics + writes their **Dream** (required) + a few favorites.
2. Each day, on first open, the player sees a **quote** and a prompt: *"What will you work on today?"* They type a short reflection.
3. That reflection is saved to a **dated journal** the player can scroll back through (the "look how far I've come" timeline).
4. Player completes **daily quests** (e.g. free throws, sprints, lifting, 1v1) and logs what they did.
5. Completing the daily check-in and quests earns **points**, which place the player on a **team leaderboard**.
6. The **coach** can post notes/notifications to the team; players confirm they've read them; the coach sees who has and hasn't.

Everything else in the app is secondary to this loop working smoothly across multiple users.

---

## 3. Non-Negotiables (these override convenience — never quietly break them)

1. **Child safety first.** Users may be as young as 10. Design every feature so it is safe for minors and defensible to a parent or school. When unsure, choose the more protective option and flag it.
2. **Team-private by default.** No public profiles, no public feed, no discovery by strangers. Data is visible only within a player's own team and to that team's coach (and, later, the player's parent). There is **no open social network** in this MVP.
3. **Digital-first daily loop.** The daily reflection is **typed in the app.** Do **NOT** build photo-upload-of-handwriting or AI "grading/scoring" of player writing. The app may *encourage* using the physical playbook and may *reference* the E24P process, but the app's own loop must not depend on photo upload or AI grading. (These are explicitly deferred — see §8.)
4. **Data minimization.** Collect only what the loop needs. No collecting of sensitive personal data, no third-party advertising/tracking SDKs, no selling data. Keep what's stored small, named clearly, and easy to export or delete.
5. **Architect for scale, show small.** Model the data so a player belongs to a Team, a Team can belong to a larger grouping (conference/region) later, and leaderboards can be scoped to any level. But in the UI, only show the single-team view for now. Never hard-code "one team" in a way that blocks future grouping.
6. **No legal claims.** This file encodes safety *design guardrails*, not legal advice. Don't claim the app "is COPPA compliant" anywhere in code, UI, or docs. Build the guardrails; leave the legal sign-off to humans.

---

## 4. Scope — what's IN the MVP

- Auth with two roles: **Coach** (team admin) and **Player**.
- A set of seeded **fake users** + a **dev user switcher** so the owner can test multi-user UX fast (see §7).
- **Onboarding + Dream** capture.
- The **daily check-in** (quote → "what will you work on today" → typed reflection) + dated **journal timeline**.
- **Daily quests** + logging + **points** + single-**team leaderboard**.
- **Coach notifications** with **read-confirmation** tracking.
- **E24P reference library**: browsable, structured documentation of the process (placeholder content for now, clearly marked, easy to replace with the owner's real material).
- A **player profile / "Your Brand"** page: basic basketball stats (height, points-per-game, rebounds, etc. as structured fields), the dream, points/leaderboard standing, and journal access.

## 5. Scope — what's OUT of the MVP (do not build unless explicitly asked)

- Photo upload of handwritten pages; AI grading/scoring of writing.
- Native video upload/hosting. (Highlight reels, if touched at all, are a **pasted link** field only — and even that is low priority.)
- Public/social feed, likes, comments, follower counts, cross-team discovery.
- Recruiting / NBA / NCAA news feed.
- The mascot character ("Prospect") and any animation.
- Multi-team / conference / state / national leaderboard *views* (the data model supports growth; the UI does not show it yet).
- Real push notifications infrastructure (in-app notifications only for now).
- Payments / subscriptions.
- The parent/individual track as a separate mode (build the coach+player team mode first; parents come later).

---

## 6. Tech stack & conventions

- **Framework:** Next.js (App Router) + **TypeScript**.
- **Styling:** Tailwind CSS. Keep components simple and readable; mobile-first layouts (this will mostly be used on phones).
- **Database:** **SQLite via Prisma** — runs locally with no cloud account, persists to a file, and is trivial to seed. (This is an MVP/testing choice; the data layer should stay swappable for a hosted DB later.)
- **Auth:** Use a vetted, well-known auth approach — do **not** hand-roll password hashing or session crypto. For local testing, a seeded email/password login plus the dev user switcher is fine. Keep auth logic isolated so it can be hardened before any real launch.
- **State/data:** Server components + server actions / route handlers where natural. Avoid unnecessary client-side complexity.
- **Conventions:** Clear file and variable names over cleverness. Small, focused components. Comment the *why* when something isn't obvious. No dead code, no unused deferred-feature stubs left lying around.
- **One repo, one command to run:** `npm run dev` should start everything. Document any other command in the README.

---

## 7. Testing with fake users (a first-class requirement, not an afterthought)

The owner needs to validate UX across many users without manually creating accounts. So:

- Maintain a **seed script** (`npm run seed` or similar) that creates:
  - One Team ("Team A") with **1 coach + ~8 players**.
  - A **second Team ("Team B")** with 1 coach + a few players — this exists to prove the multi-team data model works, even though the UI shows one team at a time.
  - Realistic fake data: dreams filled in, **journal entries back-dated across several weeks** (so the timeline looks real), quest logs, points, and a couple of coach notifications with mixed read/unread status.
- Provide a **dev-only user switcher** (a simple menu, only visible in development) to jump between any seeded user instantly without logging out — so the owner can see the coach view, then a player view, then another player, in seconds.
- After **every** phase that adds a feature, **update the seed script** so the new feature has fake data to demonstrate it, and tell the owner exactly how to test it with the fake users.
- The seed script must be safe to re-run (reset-and-reseed), and must never run automatically against a real/production database.

---

## 8. Explicitly deferred (record decisions here so we don't relitigate)

- **Photo-upload + AI grading of handwriting:** deferred. High technical risk, subjective scoring, cost, and child-data sensitivity. The physical playbook stays physical for now.
- **Native video / highlight reels:** deferred to a pasted-link field at most; no hosting.
- **Public feed / social layer / Prospect mascot:** deferred; they raise the safety bar and aren't core to the loop.
- **Recruiting news, multi-team leaderboard views, parent mode, payments, real push:** deferred; sequenced after the core loop is proven.

If the owner asks for any of these later, treat it as a new project phase with its own plan — don't fold it silently into current work.

---

## 9. Branding & Visual Identity

- **Colors:** Black is the base/background. The accent is a bold **red / orange-red**. Primary text is **white**. Black theme throughout.
- **Master logo:** the **"E24 / MVP"** basketball mark (Elite 24, "Most Valuable Process").
- **Tagline:** "Most Valuable Process."
- **Mascot:** **"Prospect"** — a pit bull in a #24 basketball jersey. Brand character, used for personality/flavor.
- **Always-present mark:** **"Powered by Elite 24 MVP"** should appear consistently (e.g. footer), on every team's pages.
- **Frame vs. slot rule:** The Elite24 brand is the **fixed frame** and is never overridden. Each team gets a **bounded slot** they control: their team logo (top-center of dashboard) + their team name + optionally **ONE** accent color. Teams may **NOT** restyle the whole app, change fonts, recolor the black base, or move/hide the Elite24 marks. Every team's page must still clearly read as an Elite24 product.
- **The E24P method** is a 4-part cycle: **Pro Plan → Pro Preview → Pro Perform → Pro Review** (mottos include "See It. Say It. Sketch It. Feel It." and ball-handling mantras like "Value the Ball"). Keep this in mind for the daily-loop design, but **do not build it speculatively.**

> **Note:** This is the visual spec for later phases. No logo/mascot image files are added yet — those come when the visible branding/dashboard is built. The `logoUrl` and `accentColor` Team fields already exist as placeholders.

---

## 10. Rules for you, Claude Code

1. **Plan before building.** For each phase, propose a short plan (files you'll create/change, data model changes, how it'll be testable) and wait for approval before writing code.
2. **Keep changes scoped to the current phase.** Don't jump ahead to deferred features or refactor unrelated code without asking.
3. **Keep the seed + dev switcher working.** If your change affects the data model, update the seed script in the same change so the app is always testable with fake users.
4. **End every phase in a runnable, testable state**, and finish your message with concrete steps: "To test this, run X, log in as Y, do Z."
5. **Migrations:** when you change the Prisma schema, create the migration and update the seed in the same step. Never leave the schema and the seed out of sync.
6. **If a request conflicts with the Non-Negotiables (§3), stop and say so** rather than quietly complying.
7. **No secrets in code.** Use environment variables; provide a `.env.example`.
8. Prefer boring, well-supported solutions over clever ones. This will be maintained by a small team.