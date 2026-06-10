# Elite24MVP

A team-private basketball development app — the digital companion to the
Elite24MVP / E24P coaching method. See [`CLAUDE.md`](./CLAUDE.md) for the full
product context, scope, and non-negotiables. That file is the source of truth.

> **Status: Phase 1 — data model, fake users, and the dev user switcher.**
> The foundation is in place: teams, users (coach/player), and player profiles
> with the Dream, realistic seed data for two teams, and a dev-only switcher to
> test the app as any user. Feature screens (daily check-in, journal, quests,
> leaderboard, coach notifications) arrive in later phases.

## Tech stack

- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS** (v4)
- **Prisma** (v6) + **SQLite** (local file database)

## Prerequisites

- **Node.js 20+** and npm (developed on Node 24 / npm 11)

## First-time setup

```bash
cp .env.example .env     # create your local env file
npm install              # install deps + generate the Prisma client
npm run db:reset         # create the SQLite DB, apply the schema, and seed fake data
npm run dev              # start the app at http://localhost:3000
```

`npm run db:reset` asks for confirmation before resetting (it wipes and
recreates the local database). On a fresh clone that's exactly what you want.

## Run

```bash
npm run dev
```

Open **http://localhost:3000**. With no user selected you'll see a prompt to
pick one. Use the **“Dev: switch user”** menu (bottom-left, development only) to
view the app as any coach or player.

## Testing with fake users

The seed creates two teams so you can validate multi-user UX (see `CLAUDE.md`
section 7). The UI shows one team at a time; the second team exists to prove the
data model supports many.

- **Team A** — Coach Marcus Bell + 8 players (Jordan Carter, Malik Johnson, …)
- **Team B** — Coach Tasha Reed + 3 players

Each player has a **Dream** and structured stats (height, position, PPG, etc.).
To test: run `npm run dev`, open the **Dev: switch user** menu, and jump between
a coach and several players — the home page updates to show whoever you select.

## Seed (fake data)

```bash
npm run seed
```

Re-creates Team A and Team B with fresh fake data. It is **safe to re-run**
(it wipes and reseeds) and refuses to run against anything but a local SQLite
(`file:`) database.

## Database & resetting it

The app uses a local **SQLite** database via **Prisma**. The connection string
lives in `.env` (`DATABASE_URL="file:./dev.db"`), which resolves to
`prisma/dev.db` (git-ignored).

```bash
npm run db:migrate   # create & apply a new migration after editing the schema
npm run db:reset     # drop, re-apply all migrations, and re-seed the local DB
npm run db:studio    # open Prisma Studio to browse the database in the browser
```

To wipe everything manually, delete `prisma/dev.db` and run `npm run db:reset`.

## Scripts

| Command              | What it does                                         |
| -------------------- | ---------------------------------------------------- |
| `npm run dev`        | Start the dev server at http://localhost:3000        |
| `npm run build`      | Production build                                     |
| `npm start`          | Start the production server (after `npm run build`)  |
| `npm run lint`       | Run ESLint                                           |
| `npm run seed`       | Reset and seed fake teams/users                      |
| `npm run db:migrate` | Create & apply a Prisma migration                    |
| `npm run db:reset`   | Reset, re-migrate, and re-seed the local database    |
| `npm run db:studio`  | Browse the database with Prisma Studio               |

## Project structure

```
app/
  layout.tsx           Root layout (mounts the dev switcher in development)
  page.tsx             Home — shows the currently-selected user
  components/
    DevUserSwitcher.tsx  Dev-only user switcher widget
  dev/
    switch-user.ts       Server actions backing the switcher
lib/
  prisma.ts            Shared Prisma client
  session.ts           Dev "current user" session (cookie-based; not prod auth)
prisma/
  schema.prisma        Team, User, PlayerProfile
  seed.ts              Fake Team A / Team B data
  migrations/          Migration history
.env.example           Template for .env (copy to .env)
CLAUDE.md              Product context & rules — source of truth
```

## Notes

- **Auth:** Phase 1 uses the dev switcher for fast multi-user testing. Real
  email/password login (with a vetted library) is a later, security-focused
  phase; `lib/session.ts` is the single place it will plug in.
- **Environment variables:** copy `.env.example` to `.env`. Never commit `.env`
  or the SQLite database file (both are git-ignored).
- **Version control:** this folder is not yet a git repository. To start one,
  run `git init` (a `.gitignore` is already in place).
