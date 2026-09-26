/**
 * PHONE-FIT CHECK — loads every reachable app page as each kind of user at
 * phone widths and reports anything wider than the screen. On a phone, content
 * wider than the viewport is what lets a page open "slightly zoomed in" and
 * need a pinch-out to see everything (owner note, 2026-09): the browser allows
 * zooming out to fit the widest element.
 *
 *   npx tsx scripts/check-overflow.ts [--url http://localhost:3000] [--webkit] [--verbose]
 *
 * Requires a dev server running against a LOCAL seeded database (seed password
 * "password123"). Refuses any non-localhost URL. Exit code 1 if anything
 * overflows.
 */
import { chromium, webkit, type Browser, type Page } from "playwright";

const args = process.argv.slice(2);
const argValue = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const BASE = argValue("--url") ?? "http://localhost:3000";
const host = new URL(BASE).hostname;
if (host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("check-overflow only runs against localhost.");
}

const WIDTHS = [320, 360, 390]; // smallest common phones → iPhone 12–16
const PASSWORD = "password123";
const MAX_PAGES_PER_USER = 40;

// Who to look as, and where each starts. Links found on each page are
// followed (same origin, no API/logout), so dynamic routes like
// /brand/[id] and /coach/player/[id] are covered without hard-coding ids.
const VISITS: { label: string; login?: string; start: string[] }[] = [
  { label: "logged out", start: ["/login", "/signup", "/join"] },
  // Menu pages listed too: a TIME OUT takeover can cover the ☰ button.
  {
    label: "player (jordan)",
    login: "jordan",
    start: ["/", "/journal", "/leaderboard", "/notifications", "/library"],
  },
  { label: "head coach (gary)", login: "gary@elite24.demo", start: ["/", "/team"] },
  { label: "new player (andre)", login: "andre", start: ["/onboarding"] },
];

type Culprit = { tag: string; cls: string; text: string; right: number };

// Runs in the page: the document's overflow, and the outermost elements that
// stick out past the viewport without an ancestor that clips them.
function measure(): { scrollWidth: number; clientWidth: number; culprits: Culprit[] } {
  const doc = document.documentElement;
  const clientWidth = doc.clientWidth;
  const clips = (el: Element) => {
    const s = getComputedStyle(el);
    return ["hidden", "clip", "auto", "scroll"].includes(s.overflowX);
  };
  const culprits: Culprit[] = [];
  const walk = (el: Element, clipped: boolean) => {
    const rect = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    const visible = s.display !== "none" && s.visibility !== "hidden" && rect.width > 0;
    if (!clipped && visible && rect.right > clientWidth + 1 && s.position !== "fixed") {
      culprits.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.getAttribute("class") ?? "").slice(0, 90),
        text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 50),
        right: Math.round(rect.right),
      });
      return; // report the outermost offender only
    }
    const childClipped = clipped || clips(el);
    for (const child of Array.from(el.children)) walk(child, childClipped);
  };
  walk(document.body, false);
  return { scrollWidth: doc.scrollWidth, clientWidth, culprits };
}

async function login(page: Page, identifier: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#identifier", identifier);
  await page.fill("#password", PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 }),
    page.click('button[type="submit"]'),
  ]);
}

function internalLinks(hrefs: string[]): string[] {
  const out = new Set<string>();
  for (const href of hrefs) {
    const u = new URL(href, BASE);
    if (u.origin !== new URL(BASE).origin) continue;
    if (u.pathname.startsWith("/api") || u.pathname.includes(".")) continue;
    out.add(u.pathname);
  }
  return [...out];
}

async function checkUser(browser: Browser, visit: (typeof VISITS)[number], width: number) {
  const context = await browser.newContext({
    viewport: { width, height: 800 },
    deviceScaleFactor: 3,
    isMobile: true, // honor the meta viewport like a phone does
    hasTouch: true,
  });
  // tsx (esbuild keepNames) wraps functions in a `__name` helper that doesn't
  // exist inside the browser page that `measure` is sent to.
  await context.addInitScript({ content: "window.__name = (f) => f;" });
  const page = await context.newPage();
  if (visit.login) await login(page, visit.login);

  const queue = [...visit.start];
  const seen = new Set<string>();
  let problems = 0;
  while (queue.length > 0 && seen.size < MAX_PAGES_PER_USER) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 90_000 });
    } catch (e) {
      // e.g. the playbook route streams a PDF download instead of a page.
      console.log(`  - ${width}px ${path}: skipped (${(e as Error).message.split("\n")[0]})`);
      continue;
    }
    const landed = new URL(page.url()).pathname;
    const result = await page.evaluate(measure);
    if (result.scrollWidth > result.clientWidth + 1 || result.culprits.length > 0) {
      problems++;
      console.log(`  ✗ ${width}px ${path}${landed !== path ? ` → ${landed}` : ""}: page ${result.scrollWidth}px wide`);
      for (const c of result.culprits.slice(0, 6)) {
        console.log(`      <${c.tag}> right=${c.right}px "${c.text}" .${c.cls}`);
      }
    }
    // Most player pages are only linked from the ☰ menu, which renders its
    // links on open.
    const menu = page.locator('button[aria-label="Menu"]');
    // (force: a TIME OUT takeover may be covering the header.)
    if (await menu.count()) await menu.first().click({ force: true, timeout: 5_000 }).catch(() => {});
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") ?? ""));
    for (const link of internalLinks(hrefs)) if (!seen.has(link)) queue.push(link);
  }
  console.log(`  ${width}px: ${seen.size} pages, ${problems} with overflow`);
  if (args.includes("--verbose")) console.log(`    ${[...seen].join("  ")}`);
  await context.close();
  return problems;
}

async function main() {
  const engine = args.includes("--webkit") ? webkit : chromium;
  const browser = await engine.launch();
  let total = 0;
  try {
    for (const visit of VISITS) {
      console.log(`\n${visit.label}`);
      for (const width of WIDTHS) total += await checkUser(browser, visit, width);
    }
  } finally {
    await browser.close();
  }
  console.log(total === 0 ? "\nAll pages fit the screen." : `\n${total} page/width combos overflow.`);
  process.exit(total === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
