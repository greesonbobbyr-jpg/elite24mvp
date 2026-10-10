/**
 * PAGE CHECKS — loads every reachable app page as each kind of user, at phone
 * widths, in light and dark mode, and reports:
 *   - FIT: anything wider than the screen. On a phone, content wider than the
 *     viewport lets a page open "slightly zoomed in" (owner note, 2026-09).
 *   - CONTRAST (--contrast): text that fails WCAG AA against its background,
 *     via axe-core — the light/dark color roles in app/globals.css must keep
 *     every screen readable in both modes.
 *   - OUTLINES (--outlines, light mode): every card, row, pill and field must
 *     have a visible edge (CLAUDE.md §9 rule 3 — the owner's "things that
 *     should have an outline don't" in light mode). Cards and rows need an
 *     edge of at least 1.2:1 against what's behind them; fields 3:1 (WCAG
 *     non-text contrast). Text contrast alone never caught a missing edge.
 *   - SHOTS (--shots <dir>): full-page screenshots per mode/user/page, for review.
 *
 *   npx tsx scripts/check-pages.ts [--url http://localhost:3000] [--webkit]
 *       [--contrast] [--outlines] [--shots <dir>] [--theme light|dark]
 *       [--pinned] [--verbose] [--only player,ceo,...]
 *
 * Mode is the phone's setting (colorScheme emulation) — the "Auto" path.
 * --pinned instead pins each mode with the ☰ Appearance switch's cookie while
 * the phone is set to the OTHER mode, proving the pinned path wins.
 * The seeded TIME OUT only takes over on the day it was seeded: reseed the
 * local database first so the player crawl checks the takeover too.
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
const OUTLINES = args.includes("--outlines");
const PINNED = args.includes("--pinned");
const SHOTS = argValue("--shots");
// --only <labels>: check just these visits (comma-separated labels below).
const ONLY = argValue("--only")?.split(",");
const THEMES = (argValue("--theme") ? [argValue("--theme")] : OUTLINES ? ["light"] : ["light", "dark"]) as ("light" | "dark")[];
// Contrast, outlines and screenshots only need one width; fit needs the narrow ones.
const WIDTHS = CONTRAST || OUTLINES || SHOTS ? [390] : [320, 360, 390];
const PASSWORD = "password123";
const MAX_PAGES_PER_USER = 40;
// Run from the repo root, like the other scripts.
const AXE_PATH = join(process.cwd(), "node_modules", "axe-core", "axe.min.js");

// Who to look as, and where each starts. Links found on each page are
// followed (same origin, no API/logout), so dynamic routes like
// /brand/[id] and /coach/player/[id] are covered without hard-coding ids.
const VISITS: { label: string; login?: string; start: string[]; menuOpen?: boolean; follow?: boolean }[] = [
  { label: "logged-out", start: ["/login", "/signup", "/invite/not-a-real-invite-link"] },
  // Menu pages listed too: a TIME OUT takeover can cover the ☰ button.
  {
    label: "player",
    login: "jordan.carter@example.com",
    start: ["/", "/journal", "/leaderboard", "/notifications", "/library"],
  },
  // The org pages are listed: the page cap can end the crawl before the ☰
  // menu's Organization link is followed.
  { label: "coach", login: "gary@elite24.demo", start: ["/", "/team", "/org"] },
  // Organization View as a group admin (one branch) and a district admin.
  { label: "group-admin", login: "gina@elite24.demo", start: ["/org"] },
  { label: "district-admin", login: "vince@elite24.demo", start: ["/org"] },
  { label: "new-player", login: "andre.washington@example.com", start: ["/onboarding"] },
  // No team: Personal Player Development, a removed player, an org admin.
  { label: "personal", login: "avery.collins@example.com", start: ["/", "/quests", "/journal", "/library"] },
  { label: "removed", login: "devon.price@example.com", start: ["/"] },
  { label: "org-admin", login: "alex@elite24.demo", start: ["/"] },
  // The CEO: CEO View and its detail pages (followed from these).
  { label: "ceo", login: "ceo@elite24.demo", start: ["/ceo", "/ceo/orgs", "/ceo/orgs/new", "/ceo/codes", "/ceo/people?q=jo", "/ceo/activity", "/account/password"] },
  // Sign-up Step 2, and an older username-only account adding its email.
  { label: "new-account", login: "taylor.reed@example.com", start: ["/welcome"], follow: false },
  { label: "username-only", login: "tyrese", start: ["/account/email"], follow: false },
  // The ☰ menu open (it isn't a page of its own).
  { label: "menu", login: "tyler.nguyen@example.com", start: ["/"], menuOpen: true, follow: false },
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

// Runs in the page (light mode): surfaces and fields without a visible edge.
// A "surface" is a rounded box with its own opaque background (a card, row,
// pill, tile); it needs a border (or the .e24-surface ring) that stands out
// from what's behind it, or a fill that does (a solid accent button). Fields
// need a 3:1 outline. The always-dark brand frame, the Player/Staff cards and
// images are their own design, so they're skipped.
type OutlineIssue = { what: string; ratio: string };
function outlines(): OutlineIssue[] {
  type RGBA = [number, number, number, number];
  const parse = (c: string): RGBA | null => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = "1"] = m[1].split(/[\s,/]+/).filter(Boolean);
    return [Number(r), Number(g), Number(b), Number(a)];
  };
  const over = (top: RGBA, under: RGBA): RGBA => {
    const a = top[3];
    return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a), 1];
  };
  const lum = (c: RGBA) => {
    const f = (v: number) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const ratio = (a: RGBA, b: RGBA) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  // The color behind an element: the nearest ancestor with an opaque fill.
  const behind = (el: Element): RGBA => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const c = parse(getComputedStyle(p).backgroundColor);
      if (c && c[3] > 0.5) return c;
    }
    return parse(getComputedStyle(document.body).backgroundColor) ?? [255, 255, 255, 1];
  };
  const skip = '.theme-dark, [data-finish], [data-staff], .pc-stage, details.fixed, nextjs-portal, svg, img, [aria-hidden="true"]';
  const issues: OutlineIssue[] = [];
  const describe = (el: Element) =>
    `<${el.tagName.toLowerCase()}> "${(el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40)}" .${(el.getAttribute("class") ?? "").slice(0, 70)}`;
  for (const el of Array.from(document.body.querySelectorAll("*"))) {
    if (el.closest(skip)) continue;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (s.display === "none" || s.visibility === "hidden" || r.width < 40 || r.height < 24) continue;
    // Disabled controls are exempt (WCAG 1.4.11).
    if ((el as HTMLButtonElement).disabled) continue;
    const back = behind(el);
    const field = (el.tagName === "INPUT" && !["checkbox", "radio", "hidden", "range"].includes((el as HTMLInputElement).type)) || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
    const fill = parse(s.backgroundColor);
    // A see-through field inside an outlined bar (the Team Circle composer):
    // the bar is the visible field, checked as a surface.
    if (field && (!fill || fill[3] < 0.5)) continue;
    const surface = el.classList.contains("e24-surface") || (fill !== null && fill[3] > 0.5 && parseFloat(s.borderTopLeftRadius) >= 6);
    if (!field && !surface) continue;
    const own = fill && fill[3] > 0.5 ? over(fill, back) : back;
    const borderW = parseFloat(s.borderTopWidth);
    const border = parse(s.borderTopColor);
    let edge = borderW >= 1 && border ? ratio(over(border, back), back) : 1;
    // .e24-surface draws its edge as an inset ring in box-shadow.
    const ring = s.boxShadow.match(/(rgba?\([^)]+\))\s+0px 0px 0px 1px inset/);
    if (ring) edge = Math.max(edge, ratio(over(parse(ring[1])!, own), back));
    if (field) {
      if (edge < 3) issues.push({ what: `field ${describe(el)}`, ratio: edge.toFixed(2) });
      continue;
    }
    const fillContrast = ratio(own, back);
    if (edge < 1.2 && fillContrast < 1.5) issues.push({ what: `surface ${describe(el)}`, ratio: edge.toFixed(2) });
  }
  return issues;
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
    // --pinned: the phone says the opposite; the Appearance cookie must win.
    colorScheme: PINNED ? (theme === "light" ? "dark" : "light") : theme,
  });
  if (PINNED) await context.addCookies([{ name: "e24_theme", value: theme, url: BASE }]);
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
    if (visit.menuOpen) {
      await page.locator('button[aria-label^="Menu"]').first().click({ timeout: 10_000 });
      await page.waitForTimeout(400);
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
    if (OUTLINES) {
      const missing = await page.evaluate(outlines);
      if (missing.length > 0) {
        problems++;
        console.log(`  ✗ OUTLINES ${where}: ${missing.length}`);
        for (const m of missing.slice(0, 8)) console.log(`      ${m.ratio}:1  ${m.what}`);
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
    if (visit.follow === false) continue;
    const menu = page.locator('button[aria-label^="Menu"]');
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
    for (const visit of VISITS.filter((v) => !ONLY || ONLY.includes(v.label))) {
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
