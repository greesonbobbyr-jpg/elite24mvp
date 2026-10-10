import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// THEME GUARD (light-mode revamp, owner 2026-10-06). Every UI color comes from
// a role in app/globals.css, and the accent is always SOLID — no see-through
// tints (they came out pink on a white page), no raw palette colors (they
// don't change between light and dark). This scans the app's components and
// fails with the file, line and a fix for:
//   1. raw palette colors in classes (bg-red-600, text-white, border-zinc-800 …)
//   2. an opacity modifier on the accent (bg-accent/20, text-brand/70 …)
//   3. hard-coded red rgba()/hex in styles
// Exempt: the Player/Staff card family (its own fixed collectible palette)
// and the dev-only card preview. A line that genuinely needs a fixed color —
// the Elite24MVP wordmark, the always-black header — carries a
// `theme-ok: <reason>` comment on that line or the line above.

const ROOT = join(__dirname, "..");
const EXEMPT = [
  "app/components/PlayerCard.tsx",
  "app/components/StaffCard.tsx",
  "app/components/card/",
  "app/(main)/card-preview/",
  "app/(main)/org/tree/TreeNodes.tsx", // the org tree's mini cards: the card family's dark palette
];

const PALETTE = "red|orange|rose|pink|zinc|gray|neutral|slate|stone|amber|yellow|green|emerald|lime|teal|cyan|sky|blue|indigo|violet|purple|white|black";
const UTILITY = "bg|text|border(?:-[trblxy])?|ring|ring-offset|from|via|to|shadow|outline|accent|fill|stroke|divide|placeholder|decoration|caret";
const RULES: { name: string; pattern: RegExp; fix: string }[] = [
  {
    name: "raw palette color",
    pattern: new RegExp(`(?<![\\w-])(?:[a-z-]+:)*(?:${UTILITY})-(?:${PALETTE})(?:-\\d{2,3})?(?:\\/[\\w.\\[\\]]+)?(?![\\w-])`, "g"),
    fix: "use a role: bg-accent / text-on-accent / text-ink / bg-panel / border-line / text-good …",
  },
  {
    name: "see-through accent",
    pattern: /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|ring|from|via|to|shadow|outline)-(?:accent|brand)(?:-[\w]+)?\/[\w.[\]]+/g,
    fix: "the accent is always solid: drop the /opacity (a solid fill, a border-accent-edge outline, or an accent left bar)",
  },
  {
    name: "faint see-through edge",
    pattern: /(?<![\w-])(?:[a-z-]+:)*(?:border|divide|ring)-(?:ink|canvas|panel)\/[\w.[\]]+/g,
    fix: "edges are solid: border-line, border-line-strong or border-field-line",
  },
  {
    name: "see-through surface",
    pattern: /(?<![\w-])(?:[a-z-]+:)*bg-(?:raised|raised-2|raised-3|canvas|panel|sunken|field)\/[\w.[\]]+/g,
    fix: "surfaces are solid: bg-panel, bg-sunken or bg-raised-2",
  },
  {
    name: "hard-coded color class",
    pattern: new RegExp(`(?<![\\w-])(?:[a-z-]+:)*(?:${UTILITY})-\\[(?:#|rgb|hsl)[^\\]]*\\]`, "g"),
    fix: "add a role to app/globals.css instead of an arbitrary color value",
  },
  {
    name: "hard-coded red",
    pattern: /rgba?\(\s*(?:2[0-5]\d|1[6-9]\d)\s*,\s*(?:\d|[1-6]\d)\s*,\s*(?:\d|[1-6]\d)\s*[,)]|#(?:ef4444|dc2626|b91c1c|e1102a|c81e1e|f87171)\b/gi,
    fix: "use var(--accent) / var(--brand) or a token in globals.css",
  },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

describe("theme guard: colors come from the roles, and the accent is solid", () => {
  it("no raw palette colors, see-through accent or hard-coded red outside the card family", () => {
    const problems: string[] = [];
    for (const file of sourceFiles(join(ROOT, "app"))) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      if (EXEMPT.some((prefix) => rel.startsWith(prefix))) continue;
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, i) => {
        if (line.includes("theme-ok:") || lines[i - 1]?.includes("theme-ok:")) return;
        for (const rule of RULES) {
          for (const match of line.matchAll(rule.pattern)) {
            problems.push(`${rel}:${i + 1}  ${rule.name} "${match[0]}" — ${rule.fix}`);
          }
        }
      });
    }
    expect(problems, `\n${problems.join("\n")}\n`).toEqual([]);
  });
});
