/**
 * CARD SCREENSHOT RIG (Stage 2) — element-screenshots every card environment
 * on /card-preview at 2x into an output folder. The stage-by-stage shots are
 * the acceptance record of the visual loop; human visual approval stays the
 * design authority (Δ14) — after GEOMETRY LOCKED, `--check` pixel-diffs guard
 * against accidental regressions only.
 *
 *   npx tsx scripts/shoot-cards.ts [--url http://localhost:3000]
 *                                  [--out <dir>]       default: <tmp>/e24-card-shots
 *                                  [--overlay]         shoot at 50% reference blend
 *                                  [--static]          freeze finish motion (?static=1)
 *                                  [--check]           compare against design/baselines/
 *                                  [--master]          the Platinum checkpoint: ONE card at
 *                                                      1000×1500 css px (2000×3000 @2x), overlay 0%
 *                                  [--login <email>]   default: gary@elite24.demo
 *
 * Requires a dev server running against the LOCAL card DB (e24cards) and the
 * seeded dev password. Never point this at production.
 */
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
function flag(name: string): boolean {
  return args.includes(`--${name}`);
}
function opt(name: string, dflt: string): string {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
}

const BASE_URL = opt("url", "http://localhost:3000");
const OUT_DIR = opt("out", join(tmpdir(), "e24-card-shots"));
const LOGIN_EMAIL = opt("login", "gary@elite24.demo");
const LOGIN_PASSWORD = process.env.SHOOT_PASSWORD ?? "password123";
const BASELINE_DIR = join(process.cwd(), "design", "baselines");

async function main() {
  if (/vercel|supabase|elite24mvp\.app/i.test(BASE_URL)) {
    throw new Error("shoot-cards refuses non-local URLs.");
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1500, height: 1000 },
    deviceScaleFactor: 2, // crisp 2x shots for overlay comparison
  });

  // Seeded-login (staff log in by EMAIL).
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="identifier"]', LOGIN_EMAIL);
  await page.fill('input[name="password"]', LOGIN_PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);

  const params = new URLSearchParams();
  if (flag("overlay")) params.set("overlay", "50");
  if (flag("static") || flag("check") || flag("master")) params.set("static", "1");
  if (flag("master")) {
    params.set("master", "1");
    if (!flag("overlay")) params.set("overlay", "0");
    await page.setViewportSize({ width: 1200, height: 1700 });
  }
  const qs = params.size ? `?${params}` : "";
  await page.goto(`${BASE_URL}/card-preview${qs}`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-shot]", { timeout: 20000 });
  // Fixed overlays (dev user switcher, install banner, bottom tab bar) float
  // over cards near the viewport edges — hide them so shots capture only the
  // card.
  await page.addStyleTag({
    content: "[class~='fixed'] { display: none !important; }",
  });
  // Let fonts/images settle before shooting.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);

  const shots = page.locator("[data-shot]");
  const count = await shots.count();
  if (count === 0) throw new Error("no [data-shot] elements found");

  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const el = shots.nth(i);
    const name = (await el.getAttribute("data-shot")) ?? `shot-${i}`;
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(120);
    await el.screenshot({ path: join(OUT_DIR, `${name}.png`) });
    names.push(name);
    console.log(`  shot ${name}.png`);
  }
  await browser.close();
  console.log(`\n${count} shots -> ${OUT_DIR}`);

  if (flag("check")) await check(names);
}

/**
 * Δ11/Δ14 regression check — ONLY meaningful after GEOMETRY LOCKED, when
 * human-approved baselines have been committed to design/baselines/. Pixel
 * diffs flag accidental drift; they never determine design approval.
 */
async function check(names: string[]) {
  if (!existsSync(BASELINE_DIR)) {
    console.log(
      "\n--check: no design/baselines/ directory — baselines are committed " +
        "only after GEOMETRY LOCKED + human visual approval. Skipping.",
    );
    return;
  }
  const { PNG } = await import("pngjs");
  const { default: pixelmatch } = await import("pixelmatch");

  let failures = 0;
  let compared = 0;
  for (const name of names) {
    const basePath = join(BASELINE_DIR, `${name}.png`);
    if (!existsSync(basePath)) continue;
    compared++;
    const a = PNG.sync.read(readFileSync(basePath));
    const b = PNG.sync.read(readFileSync(join(OUT_DIR, `${name}.png`)));
    if (a.width !== b.width || a.height !== b.height) {
      console.log(`  DRIFT ${name}: size ${a.width}x${a.height} -> ${b.width}x${b.height}`);
      failures++;
      continue;
    }
    const diff = new PNG({ width: a.width, height: a.height });
    const bad = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
      threshold: 0.12,
    });
    const pct = (bad / (a.width * a.height)) * 100;
    if (pct > 0.5) {
      console.log(`  DRIFT ${name}: ${pct.toFixed(2)}% pixels differ`);
      failures++;
    } else {
      console.log(`  ok    ${name} (${pct.toFixed(2)}%)`);
    }
  }
  if (compared === 0) {
    console.log("--check: no matching baselines for these shots. Skipping.");
    return;
  }
  if (failures > 0) {
    console.error(`\n${failures} card(s) drifted from approved baselines.`);
    process.exit(1);
  }
  console.log("\nAll compared cards match their approved baselines.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
