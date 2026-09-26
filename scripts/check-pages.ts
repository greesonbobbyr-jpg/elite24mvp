/**
 * PAGE CHECKS — loads every reachable app page as each kind of user, at phone
 * widths, in light and dark mode, and reports:
 *   - FIT: anything wider than the screen. On a phone, content wider than the
 *     viewport lets a page open "slightly zoomed in" (owner note, 2026-09).
 *   - CONTRAST (--contrast): text that fails WCAG AA against its background,
 *     via axe-core — the light/dark color roles in app/globals.css must keep
 *     every screen readable in both modes.
 *   - SHOTS (--shots <dir>): full-page screenshots per mode/user/page, for review.
 *
 *   npx tsx scripts/check-pages.ts [--url http://localhost:3000] [--webkit]
 *       [--contrast] [--shots <dir>] [--theme light|dark] [--verbose]
 *
 * Mode is the phone's setting (colorScheme emulation) — the "Auto" path.
 * Requires a dev server running against a LOCAL seeded database (seed password
 * "password123"). Refuses any non-localhost URL. Exit code 1 on any problem.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, webkit, type Browser, type Page } from "playwright";

const args = process.argv.slice(2);
const argValue = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const BASE = argValue("--url") ?? "http://localhost:3000";
const host = new URL(BASE).hostname;
if (host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("check-pages only runs against localhost.");
}
const CONTRAST = args.includes("--contrast");
const SHOTS = argValue("--shots");
const THEMES = (argValue("--theme") ? [argValue("--theme")] : ["light", "dark"]) as ("light" | "dark")[];
// Contrast and screenshots only need one width; fit needs the narrow ones.
const WIDTHS = CONTRAST || SHOTS ? [390] : [320, 360, 390];
const PASSWORD = "password123";
const MAX_PAGES_PER_USER = 40;
// Run from the repo root, like the other scripts.
const AXE_PATH = join(process.cwd(), "node_modules", "axe-core", "axe.min.js");

// Who to look as, and where each starts. Links found on each page are
// followed (same origin, no API/logout), so dynamic routes like
// /brand/[id] and /coach/player/[id] are covered without hard-coding ids.
const VISITS: { label: string; login?: string; start: string[] }[] = [
  { label: "logged-out", start: ["/login", "/signup", "/join"] },
  // Menu pages listed too: a TIME OUT takeover can cover the ☰ button.
  {
    label: "player",
    login: "jordan",
    start: ["/", "/journal", "/leaderboard", "/notifications", "/library"],
  },
  { label: "coach", login: "gary@elite24.demo", start: ["/", "/team"] },
  { label: "new-player", login: "andre", start: ["/onboarding"] },
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

type ContrastIssue = { target: string; text: string; detail: string };

async function contrastIssues(page: Page): Promise<ContrastIssue[]> {
  await page.addScriptTag({ path: AXE_PATH });
  return page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (...a: unknown[]) => Promise<{ violations: { nodes: { target: string[]; html: string; any: { message: string }[] }[] }[] }> } }).axe;
    // The Elite24MVP wordmark is a logo — WCAG 1.4.3 exempts logotypes, and
    // its brand red stays exactly the brand red.
    const result = await axe.run(
      { exclude: [['[aria-label="Elite24MVP"]']] },
      { runOnly: ["color-contrast"] },
    );
    return result.violations.flatMap((v) =>
      v.nodes.map((n) => ({
        target: n.target.join(" "),
        text: n.html.replace(/\s+/g, " ").slice(0, 90),
        detail: n.any[0]?.message ?? "",
      })),
    );
  });
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

async function checkUser(
  browser: Browser,
  visit: (typeof VISITS)[number],
  theme: "light" | "dark",
  width: number,
) {
  const context = await browser.newContext({
    viewport: { width, height: 800 },
    deviceScaleFactor: SHOTS ? 2 : 1,
    isMobile: true, // honor the meta viewport like a phone does
    hasTouch: true,
    colorScheme: theme,
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
      console.log(`  - ${theme} ${width}px ${path}: skipped (${(e as Error).message.split("\n")[0]})`);
      continue;
    }
    const landed = new URL(page.url()).pathname;
    const where = `${theme} ${width}px ${path}${landed !== path ? ` → ${landed}` : ""}`;

    const fit = await page.evaluate(measure);
    if (fit.scrollWidth > fit.clientWidth + 1 || fit.culprits.length > 0) {
      problems++;
      console.log(`  ✗ FIT ${where}: page ${fit.scrollWidth}px wide`);
      for (const c of fit.culprits.slice(0, 6)) {
        console.log(`      <${c.tag}> right=${c.right}px "${c.text}" .${c.cls}`);
      }
    }
    if (CONTRAST) {
      const issues = await contrastIssues(page);
      if (issues.length > 0) {
        problems++;
        console.log(`  ✗ CONTRAST ${where}: ${issues.length}`);
        for (const i of issues.slice(0, 8)) console.log(`      ${i.text}\n        ${i.detail}`);
      }
    }
    if (SHOTS) {
      const dir = join(SHOTS, theme, visit.label);
      mkdirSync(dir, { recursive: true });
      const name = path === "/" ? "home" : path.slice(1).replace(/\//g, "_");
      await page.screenshot({ path: join(dir, `${name}.png`), fullPage: true });
    }

    // Most player pages are only linked from the ☰ menu, which renders its
    // links on open. (force: a TIME OUT takeover may be covering the header.)
    const menu = page.locator('button[aria-label="Menu"]');
    if (await menu.count()) await menu.first().click({ force: true, timeout: 5_000 }).catch(() => {});
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") ?? ""));
    for (const link of internalLinks(hrefs)) if (!seen.has(link)) queue.push(link);
  }
  console.log(`  ${theme} ${width}px: ${seen.size} pages, ${problems} with problems`);
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
      for (const theme of THEMES) {
        for (const width of WIDTHS) total += await checkUser(browser, visit, theme, width);
      }
    }
  } finally {
    await browser.close();
  }
  console.log(total === 0 ? "\nAll pages pass." : `\n${total} page checks failed.`);
  process.exit(total === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
