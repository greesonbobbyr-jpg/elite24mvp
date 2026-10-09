// Build gate for the author-only reflections boundary (HIERARCHY_PLAN.md §4):
// JournalEntry and DailyReview may be queried ONLY from lib/data/reflections.ts
// — directly, through a relation (journalEntries / dailyReviews on a User or
// Profile query), or through raw SQL. CEO View (lib/data/ceo.ts) relies on it.
// Runs automatically before every build via the npm `prebuild` hook (locally
// and on Vercel), so a violating change cannot ship.
//
// Deliberately excludes prisma/seed.ts and scripts/ (operational tooling, not
// app query paths) — the guarantee protects what the RUNNING APP can read.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOTS = ["app", "lib"];
const ALLOWED = join("lib", "data", "reflections.ts");
const PATTERN =
  /\b(?:prisma|tx)\.(?:journalEntry|dailyReview)\b|\b(?:journalEntries|dailyReviews)\s*:|\$(?:queryRaw|executeRaw)/;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) yield path;
  }
}

const violations = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const rel = relative(".", file);
    if (rel === ALLOWED) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (PATTERN.test(line)) violations.push(`${rel.split(sep).join("/")}:${i + 1}  ${line.trim()}`);
    });
  }
}

if (violations.length > 0) {
  console.error(
    "REFLECTIONS BOUNDARY VIOLATION — journal/review queries are allowed only in lib/data/reflections.ts:\n",
  );
  for (const v of violations) console.error("  " + v);
  console.error(
    "\nMove the query into lib/data/reflections.ts (content reads must derive the author from ctx).",
  );
  process.exit(1);
}
console.log("reflections boundary OK (journal/review queries only in lib/data/reflections.ts)");
