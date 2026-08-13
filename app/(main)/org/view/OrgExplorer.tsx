"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import type { OrgViewData, OrgViewDivision, OrgViewProgram, OrgViewTeam } from "@/lib/orgview";
import { SearchBar } from "./SearchBar";
import { OrgTreeDesktop } from "./OrgTreeDesktop";
import { OrgTreeMobile } from "./OrgTreeMobile";

// THE ORG VIEW client boundary. Focus state ({program, division, team,
// highlight}) is the single source of truth for BOTH presentations, mirrored
// to the URL via history.pushState so the phone back gesture and shareable
// links work, and applied inside document.startViewTransition so the mobile
// focus-and-expand morph animates natively. Reduced motion (or an unsupported
// browser) short-circuits to an instant swap — the global
// prefers-reduced-motion CSS additionally zeroes the view-transition frames.

export type Focus = {
  p: number | null;
  d: number | null;
  t: number | null;
  hl: number | null;
};

export type Resolved = {
  program: OrgViewProgram | null;
  division: OrgViewDivision | undefined;
  team: OrgViewTeam | undefined;
};

function parseSearch(search: string): Focus {
  const q = new URLSearchParams(search);
  const num = (k: string) => {
    const n = Number.parseInt(q.get(k) ?? "", 10);
    return Number.isInteger(n) ? n : null;
  };
  return { p: num("p"), d: num("d"), t: num("t"), hl: num("hl") };
}

function toSearch(f: Focus): string {
  const q = new URLSearchParams();
  if (f.p != null) q.set("p", String(f.p));
  if (f.d != null) q.set("d", String(f.d));
  if (f.t != null) q.set("t", String(f.t));
  if (f.hl != null) q.set("hl", String(f.hl));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function OrgExplorer({
  data,
  initialFocus,
}: {
  data: OrgViewData;
  initialFocus: Focus;
}) {
  const [focus, setFocus] = useState<Focus>(initialFocus);

  // Canonicalize whatever the params claim against the real tree: a team
  // implies its division/program; unknown ids resolve to null. Single-entry
  // layers auto-focus (progressive disclosure — flags from lib/structure).
  const resolved: Resolved = useMemo(() => {
    let program: OrgViewProgram | null = null;
    let division: OrgViewDivision | undefined;
    let team: OrgViewTeam | undefined;
    for (const p of data.programs) {
      for (const d of p.divisions) {
        const t = focus.t != null ? d.teams.find((x) => x.id === focus.t) : undefined;
        if (t) {
          return { program: p, division: d, team: t };
        }
      }
    }
    program =
      (focus.p != null ? data.programs.find((p) => p.id === focus.p) : undefined) ??
      (!data.showPrograms ? (data.programs[0] ?? null) : null) ??
      null;
    if (program) {
      division =
        (focus.d != null
          ? program.divisions.find((d) => d.id === focus.d)
          : undefined) ??
        (!program.showDivisions ? program.divisions[0] : undefined);
    }
    return { program, division, team };
  }, [data, focus]);

  const navigate = useCallback((next: Focus) => {
    const commit = () => {
      flushSync(() => setFocus(next));
      window.history.pushState(null, "", toSearch(next) || window.location.pathname);
    };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => void;
    };
    if (doc.startViewTransition && !reduced) {
      doc.startViewTransition(commit);
    } else {
      commit();
    }
  }, []);

  // Phone/browser back gesture: restore focus from the URL.
  useEffect(() => {
    const onPop = () => setFocus(parseSearch(window.location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Highlighted person (search jump): scroll their card into view.
  useEffect(() => {
    if (focus.hl == null) return;
    const el = document.getElementById(`person-${focus.hl}`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focus.hl, focus.t]);

  // Breadcrumb — only layers that are SHOWN and selected become crumbs.
  const crumbs: { label: string; focus: Focus }[] = [
    { label: data.org.name, focus: { p: null, d: null, t: null, hl: null } },
  ];
  if (resolved.program && data.showPrograms) {
    crumbs.push({
      label: resolved.program.name,
      focus: { p: resolved.program.id, d: null, t: null, hl: null },
    });
  }
  if (resolved.division && (resolved.program?.showDivisions ?? false)) {
    crumbs.push({
      label: resolved.division.name,
      focus: { p: resolved.program?.id ?? null, d: resolved.division.id, t: null, hl: null },
    });
  }
  if (resolved.team) {
    crumbs.push({
      label: resolved.team.name,
      focus: {
        p: resolved.program?.id ?? null,
        d: resolved.division?.id ?? null,
        t: resolved.team.id,
        hl: null,
      },
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchBar index={data.searchIndex} navigate={navigate} />

      {crumbs.length > 1 && (
        <nav className="sticky top-[52px] z-20 flex items-center gap-1 overflow-x-auto bg-black/85 py-1 text-xs backdrop-blur-sm">
          {crumbs.map((c, i) => (
            <span key={i} className="flex shrink-0 items-center gap-1">
              {i > 0 && <span className="text-zinc-600">›</span>}
              {i === crumbs.length - 1 ? (
                <span className="font-bold text-white">{c.label}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate(c.focus)}
                  className="font-semibold text-zinc-400 transition hover:text-red-400"
                >
                  {c.label}
                </button>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="hidden md:block">
        <OrgTreeDesktop data={data} resolved={resolved} hl={focus.hl} navigate={navigate} />
      </div>
      <div className="md:hidden">
        <OrgTreeMobile data={data} resolved={resolved} hl={focus.hl} navigate={navigate} />
      </div>
    </div>
  );
}
