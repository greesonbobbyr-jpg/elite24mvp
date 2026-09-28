"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { DivisionBadge, MiniPlayerCard, MiniStaffCard, StaffChip } from "./MiniCards";
import { SAMPLE_ORGS, type SampleDivision, type SampleOrg, type SampleTeam } from "./sampleOrg";

// MOCKUP of the org tree, built to the owner's sketch
// (design/reference/org-tree-sketch.jpg): search → Org Owner → age-group
// divisions → head coaches → players, one open branch per level, lines
// branching down. Sample data only; nothing here reads or writes the database.

const WIDE = "(min-width: 768px)";
function useWide() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(WIDE);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(WIDE).matches,
    () => true,
  );
}

type Hit = {
  key: string;
  label: string;
  kind: "Player" | "Head Coach" | "Staff" | "Team" | "Division";
  sub: string;
  divisionId: string | null;
  teamId: string | null;
  /** The node to flash and scroll to. */
  nodeId: string;
};

function searchIndex(org: SampleOrg, showDivisions: boolean): Hit[] {
  const hits: Hit[] = [];
  for (const d of org.divisions) {
    const divisionId = showDivisions ? d.id : null;
    if (showDivisions) {
      hits.push({ key: d.id, label: d.name, kind: "Division", sub: `${d.teams.length} teams`, divisionId, teamId: null, nodeId: d.id });
    }
    for (const t of d.teams) {
      hits.push({ key: t.id, label: t.name, kind: "Team", sub: `${t.players.length} players`, divisionId, teamId: t.id, nodeId: t.id });
      if (t.headCoach) {
        hits.push({ key: t.headCoach.id, label: t.headCoach.name, kind: "Head Coach", sub: t.name, divisionId, teamId: null, nodeId: t.id });
      }
      for (const s of t.staff) {
        hits.push({ key: s.id, label: s.name, kind: "Staff", sub: `${s.role} · ${t.name}`, divisionId, teamId: t.id, nodeId: t.id });
      }
      for (const p of t.players) {
        hits.push({ key: p.id, label: p.name, kind: "Player", sub: t.name, divisionId, teamId: t.id, nodeId: p.id });
      }
    }
  }
  return hits;
}

/** A tree node's element, found by its data-node tag. */
function nodeEl(container: HTMLElement, id: string) {
  return container.querySelector<HTMLElement>(`[data-node="${CSS.escape(id)}"]`);
}

/** One level of the tree: a parent node, its children, and the open child. */
type Branch = { parent: string; children: string[]; open: string | null };

/** Draws the connector lines into the SVG from where the nodes actually are:
 * a drop from the parent, a bar across its children, a drop to each child;
 * the open child's path in red. */
function drawLines(container: HTMLElement | null, svg: SVGSVGElement | null, branches: Branch[]) {
  if (!container || !svg) return;
  const box = container.getBoundingClientRect();
  const at = (id: string) => {
    const r = nodeEl(container, id)?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2 - box.left, top: r.top - box.top, bottom: r.bottom - box.top } : null;
  };
  const paths: string[] = [];
  const line = (d: string, active: boolean) =>
    paths.push(`<path d="${d}" fill="none" stroke-linecap="round" stroke-width="${active ? 2.5 : 1.5}" class="${active ? "stroke-brand" : "stroke-line-strong"}"/>`);
  for (const b of branches) {
    const p = at(b.parent);
    const kids = b.children.flatMap((id) => {
      const pos = at(id);
      return pos ? [{ id, ...pos }] : [];
    });
    if (!p || kids.length === 0) continue;
    const mid = p.bottom + (Math.min(...kids.map((k) => k.top)) - p.bottom) / 2;
    const xs = kids.map((k) => k.x);
    const open = kids.find((k) => k.id === b.open);
    line(`M${p.x},${p.bottom}V${mid}`, Boolean(open));
    line(`M${Math.min(p.x, ...xs)},${mid}H${Math.max(p.x, ...xs)}`, false);
    for (const k of kids) line(`M${k.x},${mid}V${k.top}`, k.id === b.open);
    if (open) line(`M${p.x},${mid}H${open.x}`, true);
  }
  svg.innerHTML = paths.join("");
}

export function OrgTreeMockup() {
  const wide = useWide();
  const size = wide
    ? { owner: 132, coach: 112, player: 88, division: 76 }
    : { owner: 112, coach: 96, player: 84, division: 64 };

  const [orgId, setOrgId] = useState(SAMPLE_ORGS[0].id);
  const org = SAMPLE_ORGS.find((o) => o.id === orgId) ?? SAMPLE_ORGS[0];
  // Small clubs (one division) go straight from the owner to head coaches.
  const showDivisions = org.divisions.length > 1;
  const [divisionId, setDivisionId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);

  const division: SampleDivision | null = showDivisions
    ? (org.divisions.find((d) => d.id === divisionId) ?? null)
    : org.divisions[0];
  const team: SampleTeam | null = division?.teams.find((t) => t.id === teamId) ?? null;

  const q = query.trim().toLowerCase();
  const results = q
    ? searchIndex(org, showDivisions)
        .filter((h) => h.label.toLowerCase().includes(q))
        .sort((a, b) => Number(!a.label.toLowerCase().startsWith(q)) - Number(!b.label.toLowerCase().startsWith(q)))
        .slice(0, 8)
    : [];

  // Nodes and rows are tagged (data-node / data-row) and looked up in the
  // DOM by the effects below, for the connector lines and scrolling.
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const branches: Branch[] = [];
  if (showDivisions) branches.push({ parent: org.owner.id, children: org.divisions.map((d) => d.id), open: divisionId });
  if (division) branches.push({ parent: showDivisions ? division.id : org.owner.id, children: division.teams.map((t) => t.id), open: teamId });
  if (team) branches.push({ parent: team.id, children: team.players.map((p) => p.id), open: null });
  const branchKey = JSON.stringify(branches);

  // Lines are drawn after layout and again whenever a row scrolls sideways or
  // the page resizes, straight into the SVG (no re-render).
  useLayoutEffect(() => {
    const layout: Branch[] = JSON.parse(branchKey);
    const container = containerRef.current;
    const draw = () => drawLines(container, svgRef.current, layout);
    draw();
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    };
    const observer = new ResizeObserver(schedule);
    if (container) observer.observe(container);
    const scrollers = [...(container?.querySelectorAll<HTMLElement>("[data-row]") ?? [])];
    scrollers.forEach((el) => el.addEventListener("scroll", schedule, { passive: true }));
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      scrollers.forEach((el) => el.removeEventListener("scroll", schedule));
      window.removeEventListener("resize", schedule);
    };
  }, [branchKey, wide]);

  // Bring a newly opened branch (or a search hit) into view.
  useEffect(() => {
    const container = containerRef.current;
    if (focus && container) nodeEl(container, focus.id)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }, [focus]);
  useEffect(() => {
    if (!flashId) return;
    const t = setTimeout(() => setFlashId(null), 2400);
    return () => clearTimeout(t);
  }, [flashId]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const focusOn = (id: string | undefined) => {
    if (id) setFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }));
  };
  function openDivision(d: SampleDivision) {
    const closing = divisionId === d.id;
    setDivisionId(closing ? null : d.id);
    setTeamId(null);
    if (!closing) focusOn(d.teams[0]?.id);
  }
  function openTeam(t: SampleTeam) {
    const closing = teamId === t.id;
    setTeamId(closing ? null : t.id);
    if (!closing) focusOn(t.players[0]?.id);
  }
  function pick(hit: Hit) {
    setDivisionId(hit.divisionId);
    setTeamId(hit.teamId);
    setFlashId(hit.nodeId);
    focusOn(hit.nodeId);
    setQuery("");
  }
  function switchOrg(id: string) {
    setOrgId(id);
    setDivisionId(null);
    setTeamId(null);
    setQuery("");
  }

  const row = "overflow-x-auto py-2 [scrollbar-width:none]";
  const rowInner = "mx-auto flex w-max items-start px-4";

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-2 py-8 sm:px-6">
      <header className="px-4 sm:px-0">
        <p className="e24-eyebrow">Organization · mockup</p>
        <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-ink">{org.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {SAMPLE_ORGS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => switchOrg(o.id)}
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide transition ${
                o.id === org.id ? "border-red-500 bg-red-600/20 text-brand-3" : "border-ink/15 text-muted hover:border-ink/30"
              }`}
            >
              {o.name} · {o.divisions.length > 1 ? `${o.divisions.length} divisions` : "1 team"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-subtle">Sample data. Tap a division, then a head coach; search finds any player, coach or team.</p>
      </header>

      {/* Search: a pick opens the right branch and flashes the match. */}
      <div className="relative mx-auto w-full max-w-xl px-4 sm:px-0">
        <label htmlFor="org-search" className="sr-only">Search a player, team or coach</label>
        <input
          id="org-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) pick(results[0]);
            if (e.key === "Escape") setQuery("");
          }}
          placeholder="Search a player, team or coach"
          autoComplete="off"
          className="w-full rounded-full border border-line-strong bg-field px-5 py-2.5 text-sm text-ink outline-none focus:border-red-500"
        />
        {results.length > 0 && (
          <ul className="absolute inset-x-4 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-line bg-raised shadow-lg sm:inset-x-0">
            {results.map((h) => (
              <li key={h.key}>
                <button type="button" onClick={() => pick(h)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-ink/5">
                  <span className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-wide text-brand">{h.kind}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{h.label}</span>
                    <span className="block truncate text-xs text-subtle">{h.sub}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {q && results.length === 0 && (
          <p className="absolute inset-x-4 top-full z-20 mt-1 rounded-2xl border border-line bg-raised px-4 py-3 text-sm text-muted shadow-lg sm:inset-x-0">
            No player, team or coach matches “{query.trim()}”.
          </p>
        )}
      </div>

      {/* The tree; its lines sit behind the nodes. */}
      <div ref={containerRef} className="relative flex flex-col gap-10 pb-6">
        <svg ref={svgRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden" />

        {/* Org Owner (tap to fold the tree back up) */}
        <div className="relative flex justify-center">
          <MiniStaffCard
            person={org.owner}
            width={size.owner}
            nodeId={org.owner.id}
            flash={flashId === org.owner.id}
            onClick={() => {
              setDivisionId(null);
              setTeamId(null);
            }}
          />
        </div>

        {/* Age-group divisions (only when there's more than one) */}
        {showDivisions && (
          <div data-row className={row}>
            <div className={`${rowInner} gap-4 sm:gap-8`}>
              {org.divisions.map((d) => (
                <DivisionBadge
                  key={d.id}
                  name={d.name}
                  teams={d.teams.length}
                  size={size.division}
                  nodeId={d.id}
                  selected={d.id === divisionId}
                  flash={flashId === d.id}
                  ariaExpanded={d.id === divisionId}
                  onClick={() => openDivision(d)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Head coaches: one card per team in the open division */}
        {division && (
          <div data-row className={row}>
            <div className={`${rowInner} gap-3 sm:gap-5`}>
              {division.teams.map((t) => (
                <MiniStaffCard
                  key={t.id}
                  person={t.headCoach}
                  team={showDivisions ? t.name.replace(`${division.name} `, "") : t.name}
                  width={size.coach}
                  nodeId={t.id}
                  selected={t.id === teamId}
                  flash={flashId === t.id}
                  ariaExpanded={t.id === teamId}
                  onClick={() => openTeam(t)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Players on the open team, with its other staff as chips */}
        {team && (
          <div className="flex flex-col gap-3">
            <div data-row className={row}>
              <div className={`${rowInner} gap-2.5 sm:gap-3`}>
                {team.players.map((p) => (
                  <MiniPlayerCard
                    key={p.id}
                    player={p}
                    width={size.player}
                    nodeId={p.id}
                    flash={flashId === p.id}
                    onClick={() => setToast(`Opens ${p.name}'s Brand page`)}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 px-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-subtle">
                {team.name} · {team.players.length} players
              </span>
              {team.staff.map((s) => (
                <StaffChip key={s.id} person={s} />
              ))}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <p role="status" className="fixed inset-x-0 bottom-24 z-30 mx-auto w-max max-w-[90vw] rounded-full border border-line bg-raised px-4 py-2 text-sm font-semibold text-ink shadow-lg">
          {toast}
        </p>
      )}
    </main>
  );
}
