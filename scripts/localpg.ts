/**
 * Throwaway LOCAL PostgreSQL for migration/backfill testing (no Docker, no
 * system install — real PG binaries via the embedded-postgres dev package).
 * The data dir lives outside the repo; the server daemonizes so separate
 * prisma/seed/backfill processes can connect.
 *
 *   npx tsx scripts/localpg.ts start   → prints the DATABASE_URL to export
 *   npx tsx scripts/localpg.ts stop    → stops the server
 *   npx tsx scripts/localpg.ts reset   → stop + wipe data dir
 */
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const DATA_DIR = join(tmpdir(), "e24-localpg-data");
const PORT = 5433;
const USER = "postgres";
const PASSWORD = "localtest";
const DB = "e24local";

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: true, // daemonize — survives this process so other tools connect
  // Windows initdb defaults to the OS codepage (WIN1252), which can't store
  // emoji in the seed. Supabase is UTF8 — match it.
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

async function main() {
  const cmd = process.argv[2];
  if (cmd === "start") {
    try {
      await pg.initialise();
    } catch {
      /* already initialised — fine */
    }
    await pg.start();
    try {
      await pg.createDatabase(DB);
    } catch {
      /* already exists — fine */
    }
    console.log("LOCAL PG READY");
    console.log(
      `DATABASE_URL=postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DB}`,
    );
  } else if (cmd === "stop") {
    await pg.stop();
    console.log("stopped");
  } else if (cmd === "reset") {
    try {
      await pg.stop();
    } catch {
      /* not running */
    }
    rmSync(DATA_DIR, { recursive: true, force: true });
    console.log("stopped + wiped");
  } else {
    console.error("usage: localpg.ts start|stop|reset");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
