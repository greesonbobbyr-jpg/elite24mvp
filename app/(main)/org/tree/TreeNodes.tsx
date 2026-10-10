"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { FRAME_SLICE, STAFF_ART } from "@/lib/cardAssets";
import type { OrgAdmin, OrgPerson } from "@/lib/orgview";
import { OWNER_NODE, groupNode, playerNode, staffNode, staffShort, teamNode, type TreeGroup, type TreeTeam } from "@/lib/orgtree";
import { PlayerCard } from "@/app/components/PlayerCard";
import { StaffCard, StaffPortrait, type StaffPerson } from "@/app/components/StaffCard";
import { MINI_CARD, MiniBorder, MiniFace } from "@/app/components/card/MiniFrame";

// The org tree's nodes: small cards from the card family (a player's own card
// at a smaller size, staff in graphite) and round group badges.
// Each node carries data-node for the tree's connector lines, search flash
// and scrolling. The open node and a search hit glow in the accent.

function glow(lit: boolean): CSSProperties {
  return {
    filter: lit ? "drop-shadow(0 0 7px var(--accent))" : "drop-shadow(0 3px 6px rgba(0,0,0,0.5))",
    transition: "filter 200ms, transform 150ms",
  };
}

const staffPerson = (p: OrgPerson | OrgAdmin, role: string, teamName: string | null = null): StaffPerson => ({
  name: p.name,
  role,
  teamName,
  photoUrl: p.photoUrl,
  cutoutUrl: p.photoCutoutUrl,
  photoMeta: p.photoMeta,
});

/** A staff-shaped card for an empty seat ("No head coach yet"). */
function EmptySeatCard({ title, sub }: { title: string; sub: string | null }) {
  return (
    <div className="relative w-full" style={MINI_CARD}>
      <MiniFace style={{ background: `#040506 url(${STAFF_ART.plate.file}) 50% 30% / 260% auto` }}>
        <span className="absolute inset-x-0 flex justify-center" style={{ top: "11cqw" }}>
          <span
            className="flex items-center justify-center rounded-full border-2 border-dashed border-white/35 font-black text-white/60"
            style={{ width: "58cqw", height: "58cqw", fontSize: "20cqw" }}
          >
            ?
          </span>
        </span>
        <span className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center" style={{ padding: "0 5cqw 9cqw" }}>
          <span className="block w-full font-bold uppercase leading-tight text-white/80" style={{ fontSize: "10cqw" }}>
            {title}
          </span>
          {sub && (
            <span className="block w-full truncate font-semibold uppercase leading-none text-white/60" style={{ marginTop: "2cqw", fontSize: "7cqw", letterSpacing: "0.08em" }}>
              {sub}
            </span>
          )}
        </span>
      </MiniFace>
      <MiniBorder frame={STAFF_ART.frame} />
    </div>
  );
}

/** The Org Owner at the top; tapping it folds the tree back up. */
export function OwnerNode({ owner, lit, onClick }: { owner: OrgAdmin | null; lit: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      data-node={OWNER_NODE}
      onClick={onClick}
      aria-label={owner ? `Org Owner: ${owner.name}` : "Org Owner"}
      className="relative w-[120px] shrink-0 active:scale-[0.97] md:w-36"
      style={glow(lit)}
    >
      {owner ? <StaffCard size="mini" person={staffPerson(owner, "Org Owner")} /> : <EmptySeatCard title="Org Owner" sub={null} />}
    </button>
  );
}

/** A group: a round badge for short names ("12U", "JV"), a plaque for long
 * ones ("Lincoln High"); a row uses one shape throughout. */
export function GroupNode({
  group,
  round,
  open,
  lit,
  onClick,
}: {
  group: TreeGroup;
  round: boolean;
  open: boolean;
  lit: boolean;
  onClick: () => void;
}) {
  const teams = `${group.teamCount} ${group.teamCount === 1 ? "team" : "teams"}`;
  return (
    // The whole badge (shape + team count) is the node, so its line leaves
    // below the count instead of cutting through it.
    <div data-node={groupNode(group.key)} className="flex shrink-0 flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        aria-expanded={open}
        aria-label={`${group.name}, ${teams}`}
        className={`relative active:scale-[0.96] ${round ? "aspect-square w-16 md:w-[76px]" : "h-14 w-[104px] md:h-16 md:w-[124px]"}`}
        style={{ ...glow(open || lit), containerType: "inline-size" }}
      >
        {round ? (
          <>
            <span className="absolute inset-[9%] flex items-center justify-center rounded-full" style={{ background: "radial-gradient(circle at 50% 35%, #1b1e24, #07080a)" }}>
              <span className="font-black italic leading-none text-white" style={{ fontFamily: "var(--font-barlow)", fontSize: "30cqw" }}>
                {group.name}
              </span>
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={STAFF_ART.ring} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
          </>
        ) : (
          <Plaque>{group.name}</Plaque>
        )}
      </button>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-subtle">{teams}</span>
    </div>
  );
}

function Plaque({ children }: { children: ReactNode }) {
  return (
    <>
      <span
        className="absolute inset-[3px] flex items-center justify-center rounded-md px-2"
        style={{ background: "radial-gradient(ellipse at 50% 35%, #1b1e24, #07080a)" }}
      >
        <span className="line-clamp-2 text-balance text-center font-black uppercase italic leading-[1.05] text-white" style={{ fontFamily: "var(--font-barlow)", fontSize: "13cqw" }}>
          {children}
        </span>
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          borderStyle: "solid",
          borderWidth: 7,
          borderColor: "transparent",
          borderImageSource: `url(${STAFF_ART.frame})`,
          borderImageSlice: FRAME_SLICE,
          borderImageWidth: "7px",
          borderImageRepeat: "stretch",
        }}
      />
    </>
  );
}

/** A team, shown as its head coach's card; tapping it opens the players. */
export function CoachNode({ team, open, lit, onClick }: { team: TreeTeam; open: boolean; lit: boolean; onClick: () => void }) {
  const coach = team.headCoach;
  return (
    <button
      type="button"
      data-node={teamNode(team.id)}
      onClick={onClick}
      aria-expanded={open}
      aria-label={coach ? `Head Coach ${coach.name}, ${team.name}` : `${team.name}: no head coach yet`}
      className="relative w-[104px] shrink-0 active:scale-[0.97] md:w-[124px]"
      style={glow(open || lit)}
    >
      {coach ? (
        <StaffCard size="mini" person={staffPerson(coach, "Head Coach", team.label)} />
      ) : (
        <EmptySeatCard title="No head coach yet" sub={team.label} />
      )}
    </button>
  );
}

/** A player's own card at a smaller size; tapping it opens their Brand page. */
export function PlayerNode({ player, team, lit }: { player: OrgPerson; team: TreeTeam; lit: boolean }) {
  return (
    <Link
      href={`/brand/${player.userId}`}
      data-node={playerNode(team.id, player.userId)}
      aria-label={player.position ? `${player.name}, ${player.position}` : player.name}
      className="relative w-24 shrink-0 active:scale-[0.97] md:w-28"
      style={glow(lit)}
    >
      <PlayerCard
        size="mini"
        player={{
          name: player.name,
          jerseyNumber: player.jerseyNumber,
          position: player.position,
          rank: player.teamRank,
          rosterSize: team.players.length,
          points: player.careerPoints,
          total: player.careerPoints,
          photoUrl: player.photoUrl,
          cutoutUrl: player.photoCutoutUrl,
          photoMeta: player.photoMeta,
        }}
        team={{ name: team.name, logoUrl: team.logoUrl, primaryColor: team.primaryColor, secondaryColor: team.secondaryColor }}
      />
    </Link>
  );
}

/** An assistant coach or GM on the open team. */
export function StaffChip({ person, teamId, lit }: { person: OrgPerson; teamId: number; lit: boolean }) {
  return (
    <span
      data-node={staffNode(teamId, person.userId)}
      className={`inline-flex items-center gap-1.5 rounded-full border bg-panel py-0.5 pl-0.5 pr-2.5 text-[11px] font-semibold text-ink-mid transition ${
        lit ? "border-brand" : "border-line"
      }`}
    >
      <StaffPortrait person={staffPerson(person, staffShort(person.role))} size={22} />
      <span className="text-subtle">{staffShort(person.role)}</span>
      {person.name}
    </span>
  );
}
