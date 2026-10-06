/**
 * STYLE GUIDE BASELINE — shoots the dev-only /style-guide page (every shared
 * building block) at phone width in light and dark, and compares it with the
 * approved baselines in design/baselines/style-guide-{light,dark}.png. A
 * change to a color role or a building block that shifts the look shows up
 * here; the owner approves a new look, then `--update` records it.
 *
 *   npx tsx scripts/shoot-style-guide.ts [--url http://localhost:3000] [--update]
 *
 * Requires a dev server against a LOCAL seeded database (seed password
 * "password123"). Refuses any non-localhost URL. Exit code 1 on drift.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const urlIndex = args.indexOf("--url");
const BASE = urlIndex >= 0 ? args[urlIndex + 1] : "http://localhost:3000";
const UPDATE = args.includes("--update");
const host = new URL(BASE).hostname;
if (host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("shoot-style-guide only runs against localhost.");
}
const BASELINE_DIR = join(process.cwd(), "design", "baselines");
const OUT_DIR = join(tmpdir(), "e24-style-guide");
// Same tolerance as the card baselines (scripts/shoot-cards.ts).
const MAX_DIFF_PCT = 0.5;

async function shoot(mode: "light" | "dark"): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      colorScheme: mode,
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill("#identifier", "jordan");
    await page.fill("#password", "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
    await page.goto(`${BASE}/style-guide`, { waitUntil: "networkidle" });
    // The page's own content only: no fixed tab bar, dev switcher or dev overlay.
    await page.addStyleTag({
      content: 'nav[aria-label="Primary"], details.fixed, nextjs-portal { display: none !important; }',
    });
    await page.waitForTimeout(500);
    return await page.locator("main").screenshot({ animations: "disabled" });
  } finally {
    await browser.close();
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const { PNG } = await import("pngjs");
  const { default: pixelmatch } = await import("pixelmatch");
  let failures = 0;
  for (const mode of ["light", "dark"] as const) {
    const name = `style-guide-${mode}.png`;
    const shot = await shoot(mode);
    writeFileSync(join(OUT_DIR, name), shot);
    const basePath = join(BASELINE_DIR, name);
    if (UPDATE) {
      writeFileSync(basePath, shot);
      console.log(`  updated ${basePath}`);
      continue;
    }
    if (!existsSync(basePath)) {
      console.log(`  missing ${name} — approve the look, then run with --update`);
      failures++;
      continue;
    }
    const a = PNG.sync.read(readFileSync(basePath));
    const b = PNG.sync.read(shot);
    if (a.width !== b.width || a.height !== b.height) {
      console.log(`  DRIFT ${name}: size ${a.width}x${a.height} -> ${b.width}x${b.height}`);
      failures++;
      continue;
    }
    const diff = new PNG({ width: a.width, height: a.height });
    const bad = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.12 });
    const pct = (bad / (a.width * a.height)) * 100;
    if (pct > MAX_DIFF_PCT) {
      writeFileSync(join(OUT_DIR, `diff-${name}`), PNG.sync.write(diff));
      console.log(`  DRIFT ${name}: ${pct.toFixed(2)}% pixels differ (diff in ${OUT_DIR})`);
      failures++;
    } else {
      console.log(`  ok    ${name} (${pct.toFixed(2)}%)`);
    }
  }
  if (failures > 0) {
    console.error(`\nThe style guide drifted from its approved look. Shots in ${OUT_DIR}.`);
    process.exit(1);
  }
  if (!UPDATE) console.log("\nThe style guide matches its approved look.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
