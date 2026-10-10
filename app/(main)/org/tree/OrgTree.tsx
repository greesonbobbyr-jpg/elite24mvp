"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { OrgViewData } from "@/lib/orgview";
import {
  buildOrgTree,
  groupNode,
  openNode,
  OWNER_NODE,
  playerNode,
  search,
  searchIndex,
  selectionFromQuery,
  staffNode,
  teamNode,
  toggleGroup,
  toggleTeam,
  treeRows,
  validSelection,
  type SearchHit,
  type Selection,
  type TreeRow,
} from "@/lib/orgtree";
import { CoachNode, GroupNode, OwnerNode, PlayerNode, StaffChip } from "./TreeNodes";

// THE ORG TREE (the owner's sketch): search → Org Owner → groups → head
// coaches → players, lines branching down, one open branch per level. The
// shape, selection and search live in lib/orgtree; this draws them. The open
// branch is kept in the URL (?at=…&team=…) and read back from it, so coming
// Back from a player's Brand page reopens it. (Read on the client: Back
// restores the page as first rendered, before the branch was opened.)

/** A tree node's element, found by its data-node tag. */
function nodeEl(container: HTMLElement, id: string) {
  return container.querySelector<HTMLElement>(`[data-node="${CSS.escape(id)}"]`);
}

/** Scrolls a node's row sideways so the node sits mid-row; the page itself
 * doesn't move. */
function centerInRow(el: Element, behavior: ScrollBehavior) {
  const row = el.closest<HTMLElement>("[data-row]");
  if (!row) return;
  const r = row.getBoundingClientRect();
  const n = el.getBoundingClientRect();
  row.scrollBy({ left: n.left + n.width / 2 - (r.left + r.width / 2), behavior });
}

/** One level of the tree: a parent node, its children, and the open child. */
type Branch = { parent: string; children: string[]; open: string | null };

function branchOf(row: TreeRow): Branch {
  if (row.kind === "groups") {
    return { parent: row.parent, children: row.groups.map((g) => groupNode(g.key)), open: row.open ? groupNode(row.open) : null };
  }
  if (row.kind === "teams") {
    return { parent: row.parent, children: row.teams.map((t) => teamNode(t.id)), open: row.open != null ? teamNode(row.open) : null };
  }
  return { parent: row.parent, children: row.team.players.map((p) => playerNode(row.team.id, p.userId)), open: null };
}

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

/** The page URL for a selection (other query params kept). */
function urlFor(selection: Selection) {
  const params = new URLSearchParams(window.location.search);
  params.delete("at");
  params.delete("team");
  if (selection.groups.length > 0) params.set("at", selection.groups.join("."));
  if (selection.teamId != null) params.set("team", String(selection.teamId));
  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ""}`;
}

export function OrgTree({ data }: { data: OrgViewData }) {
  const params = useSearchParams();
  const root = useMemo(() => buildOrgTree(data), [data]);
  const index = useMemo(() => searchIndex(root, data.owner), [root, data.owner]);
  const [initial] = useState(() => validSelection(root, selectionFromQuery(params.get("at"), params.get("team"))));
  const [selection, setSelection] = useState(initial);
  const [query, setQuery] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  // A node to bring into view; `n` makes a repeat of the same node count.
  // Starts at the open branch, so Back from a Brand page lands where you were.
  const [focus, setFocus] = useState<{ node: string; n: number } | null>(() => {
    const node = openNode(initial);
    return node ? { node, n: 0 } : null;
  });

  const rows = treeRows(root, selection);
  const results = search(index, query);

  // Nodes and rows are tagged (data-node / data-row) and looked up in the
  // DOM by the effects below, for the connector lines and scrolling.
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const branchKey = JSON.stringify(rows.map(branchOf));

  // Lines are drawn after layout and again whenever a row scrolls sideways or
  // the page resizes, straight into the SVG (no re-render).
  useLayoutEffect(() => {
    const branches: Branch[] = JSON.parse(branchKey);
    const container = containerRef.current;
    const draw = () => drawLines(container, svgRef.current, branches);
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
  }, [branchKey]);

  // Keep the open branch in the URL (no navigation, no history entry).
  useEffect(() => {
    window.history.replaceState(null, "", urlFor(selection));
  }, [selection]);

  // Bring a newly opened branch (or a search hit) into view, with every open
  // node above it in view in its own row, so the red path reads on a phone.
  useEffect(() => {
    const container = containerRef.current;
    if (!focus || !container) return;
    const behavior = focus.n === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    container.querySelectorAll('[aria-expanded="true"]').forEach((el) => centerInRow(el, behavior));
    nodeEl(container, focus.node)?.scrollIntoView({ behavior, block: "center", inline: "center" });
  }, [focus]);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2400);
    return () => clearTimeout(t);
  }, [flash]);

  const focusOn = (node: string | undefined) => {
    if (node) setFocus((f) => ({ node, n: (f?.n ?? 0) + 1 }));
  };
  function pick(hit: SearchHit) {
    setSelection(hit.selection);
    setFlash(hit.node);
    focusOn(hit.node);
    setQuery("");
  }

  const row = "overflow-x-auto py-2 [scrollbar-width:none]";
  const rowInner = "mx-auto flex w-max items-start px-4";

  return (
    <>
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
          spellCheck={false}
          className="w-full rounded-full border border-field-line bg-field px-5 py-2.5 text-sm text-ink outline-none transition focus:border-accent-edge focus:ring-1 focus:ring-accent-edge"
        />
        {results.length > 0 && (
          <ul className="absolute inset-x-4 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-line bg-raised shadow-lg sm:inset-x-0">
            {results.map((h) => (
              <li key={h.key}>
                <button type="button" onClick={() => pick(h)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-sunken">
                  <span className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-wide text-brand">{h.kind}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{h.label}</span>
                    {h.sub && <span className="block truncate text-xs text-subtle">{h.sub}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim() && results.length === 0 && (
          <p className="absolute inset-x-4 top-full z-20 mt-1 rounded-2xl border border-line bg-raised px-4 py-3 text-sm text-muted shadow-lg sm:inset-x-0">
            No player, team or coach matches “{query.trim()}”.
          </p>
        )}
      </div>

      {/* The tree; its lines sit behind the nodes. */}
      <div ref={containerRef} className="relative flex flex-col gap-10 pb-6">
        <svg ref={svgRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden" />

        <div className="relative flex justify-center">
          <OwnerNode owner={data.owner} lit={flash === OWNER_NODE} onClick={() => setSelection({ groups: [], teamId: null })} />
        </div>

        {rows.map((r, depth) => {
          if (r.kind === "groups") {
            const round = r.groups.every((g) => g.name.length <= 4);
            return (
              <div key={`groups-${r.parent}`} data-row className={row}>
                <div className={`${rowInner} gap-4 sm:gap-8`}>
                  {r.groups.map((g) => (
                    <GroupNode
                      key={g.key}
                      group={g}
                      round={round}
                      open={g.key === r.open}
                      lit={flash === groupNode(g.key)}
                      onClick={() => {
                        const next = toggleGroup(selection, depth, g.key);
                        setSelection(next);
                        if (next.groups.length > depth) focusOn(firstChild(treeRows(root, next).at(-1)));
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          }
          if (r.kind === "teams") {
            if (r.teams.length === 0) {
              return <p key={`teams-${r.parent}`} className="text-center text-sm text-subtle">No teams here yet.</p>;
            }
            return (
              <div key={`teams-${r.parent}`} data-row className={row}>
                <div className={`${rowInner} gap-3 sm:gap-5`}>
                  {r.teams.map((t) => (
                    <CoachNode
                      key={t.id}
                      team={t}
                      open={t.id === r.open}
                      lit={flash === teamNode(t.id)}
                      onClick={() => {
                        const next = toggleTeam(selection, t.id);
                        setSelection(next);
                        if (next.teamId != null) focusOn(t.players[0] ? playerNode(t.id, t.players[0].userId) : teamNode(t.id));
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          }
          const team = r.team;
          return (
            <div key={`players-${team.id}`} className="flex flex-col gap-3">
              {team.players.length > 0 ? (
                <div data-row className={row}>
                  <div className={`${rowInner} gap-2.5 sm:gap-3`}>
                    {team.players.map((p) => (
                      <PlayerNode key={p.userId} player={p} team={team} lit={flash === playerNode(team.id, p.userId)} />
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-center text-sm text-subtle">No players on {team.name} yet.</p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-2 px-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-subtle">
                  {team.name} · {team.players.length} {team.players.length === 1 ? "player" : "players"}
                </span>
                {team.staff.map((s) => (
                  <StaffChip key={s.userId} person={s} teamId={team.id} lit={flash === staffNode(team.id, s.userId)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** The first node of a newly opened row — where the eye should go next. */
function firstChild(row: TreeRow | undefined): string | undefined {
  if (!row) return undefined;
  if (row.kind === "groups") return row.groups[0] ? groupNode(row.groups[0].key) : undefined;
  if (row.kind === "teams") return row.teams[0] ? teamNode(row.teams[0].id) : undefined;
  return row.team.players[0] ? playerNode(row.team.id, row.team.players[0].userId) : undefined;
}
