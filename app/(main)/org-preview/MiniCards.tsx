"use client";

import type { CSSProperties } from "react";
import { finishForStars, starsForPoints, STAFF_FINISH, teamAccentFor, withAlpha } from "@/lib/cardTheme";
import { FRAME_SLICE, STAFF_ART, finishAssets, miniArt } from "@/lib/cardAssets";
import { PORTRAIT, fy, u } from "@/lib/cardGeometry";
import { cutoutCss, isPortraitMetaV2, PORTRAIT_TARGETS } from "@/lib/portrait/normalize";
import { HoloShimmer, PlayerBacklight } from "@/app/components/card/LiveEffects";
import { CardStars } from "@/app/components/card/CardStars";
import { StaffPortrait } from "@/app/components/StaffCard";
import type { SamplePlayer, SampleStaff } from "./sampleOrg";

// MOCKUP (org tree): the tree's nodes are small portrait cards from the card
// family — a player's in their tier's frame and energy, staff in graphite. No
// jersey number: collapsed cards have no room for it (owner, 2026-09-27).

/** The mini card's window onto the full card, in card units (2:3): head,
 * shoulders and the energy around them. */
const MINI_VIEW = { x: 150, y: 250, w: 700 };
const TEAM = { primaryColor: "#c9223a", secondaryColor: "#f2a900" };

/** The torso fades out towards the name, as on the full card. */
const fadeStart = fy(PORTRAIT.fadeStartY) * 100;
const fadeEnd = PORTRAIT_TARGETS.bottomY * 100;
const torsoFade: CSSProperties = {
  WebkitMaskImage: `linear-gradient(180deg, #fff 0%, #fff ${fadeStart}%, transparent ${fadeEnd}%)`,
  maskImage: `linear-gradient(180deg, #fff 0%, #fff ${fadeStart}%, transparent ${fadeEnd}%)`,
};

function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function chamfer(c: number) {
  return `polygon(${c}px 0, calc(100% - ${c}px) 0, 100% ${c}px, 100% calc(100% - ${c}px), calc(100% - ${c}px) 100%, ${c}px 100%, 0 calc(100% - ${c}px), 0 ${c}px)`;
}

type NodeProps = {
  width: number;
  selected?: boolean;
  flash?: boolean;
  onClick?: () => void;
  /** Tags the node's box (data-node) for the tree's connector lines. */
  nodeId?: string;
  ariaExpanded?: boolean;
};

/** Shared node chrome: the open node and a search hit glow red. */
function nodeStyle({ selected, flash }: Pick<NodeProps, "selected" | "flash">): CSSProperties {
  return {
    filter: selected || flash ? "drop-shadow(0 0 7px rgba(225,16,42,0.95))" : "drop-shadow(0 3px 6px rgba(0,0,0,0.5))",
    transition: "filter 200ms, transform 150ms",
  };
}

function Frame({ src, border }: { src: string; border: number }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        borderStyle: "solid",
        borderWidth: border,
        borderColor: "transparent",
        borderImageSource: `url(${src})`,
        borderImageSlice: FRAME_SLICE,
        borderImageWidth: `${border}px`,
        borderImageRepeat: "stretch",
      }}
    />
  );
}

function NameBand({ first, last, accent, children }: { first: string; last: string; accent: string; children?: React.ReactNode }) {
  return (
    <span className="absolute inset-x-0 bottom-0 flex flex-col items-center px-1.5 pb-[9%] text-center" style={{ background: "linear-gradient(transparent, rgba(0,0,0,.72) 30%, #000)" }}>
      <span className="mt-4 block w-full truncate text-[9px] font-bold uppercase leading-none tracking-[0.14em]" style={{ color: accent }}>
        {first}
      </span>
      <span className="mt-0.5 block w-full truncate text-[13px] font-black uppercase italic leading-none text-white" style={{ fontFamily: "var(--font-barlow)" }}>
        {last}
      </span>
      {children}
    </span>
  );
}

/** A player's mini card: tier frame, tier energy, the player, name and stars. */
export function MiniPlayerCard({ player, width, selected, flash, onClick, nodeId }: NodeProps & { player: SamplePlayer }) {
  const stars = starsForPoints(player.careerPoints);
  const finish = finishForStars(stars);
  const art = finishAssets(finish.key);
  const meta = player.cutoutUrl && isPortraitMetaV2(player.photoMeta) ? player.photoMeta : null;
  const border = Math.max(5, Math.round(width / 16));
  const inset = Math.round(border * 0.45);
  const faceW = width - inset * 2;
  const s = faceW / MINI_VIEW.w; // px per card unit
  const [first, ...rest] = player.name.split(" ");

  return (
    <button
      data-node={nodeId}
      type="button"
      onClick={onClick}
      aria-label={`${player.name}, ${player.position}`}
      className="relative shrink-0 active:scale-[0.97]"
      style={{ width, height: width * 1.5, ...nodeStyle({ selected, flash }) }}
    >
      <span className="absolute overflow-hidden" style={{ inset, clipPath: chamfer(border * 0.7), background: "#030406", isolation: "isolate" }}>
        <span
          aria-hidden
          className="absolute"
          style={{ left: -MINI_VIEW.x * s, top: -MINI_VIEW.y * s, width: 1000 * s, height: 1500 * s, "--u": `${s}px` } as CSSProperties}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={art.field.file} alt="" className="absolute inset-0 h-full w-full" style={{ filter: "brightness(1.2)" }} />
          <HoloShimmer finish={finish} isStatic />
          <PlayerBacklight finish={finish} team={teamAccentFor(TEAM)} />
          <span
            className="absolute"
            style={{
              left: u(120), top: u(380), width: u(760), height: u(640), mixBlendMode: "screen",
              background: `radial-gradient(closest-side, ${withAlpha(finish.palette.energy.glow[2], 0.55)}, transparent)`,
            }}
          />
          {meta && (
            <span className="absolute inset-0" style={torsoFade}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={player.cutoutUrl!} alt="" className="absolute" style={cutoutCss(meta)} />
            </span>
          )}
        </span>
        {!meta && (
          <span className="absolute inset-x-0 top-[18%] flex justify-center">
            <span className="font-black uppercase italic text-white/90" style={{ fontFamily: "var(--font-barlow)", fontSize: width * 0.3, textShadow: "0 2px 6px rgba(0,0,0,.8)" }}>
              {initialsOf(player.name)}
            </span>
          </span>
        )}
        <NameBand first={first} last={rest.join(" ")} accent={finish.palette.accent}>
          <span className="mt-1 flex justify-center">
            <CardStars count={stars} finish={finish} sizePx={Math.max(6, Math.round(width / 14))} gapPx={1} />
          </span>
        </NameBand>
      </span>
      <Frame src={miniArt(finish.key).frame} border={border} />
    </button>
  );
}

/** A staff member's mini card: graphite frame, ring portrait, name and role. */
export function MiniStaffCard({ person, team, width, selected, flash, onClick, nodeId, ariaExpanded }: NodeProps & { person: SampleStaff | null; team?: string }) {
  const border = Math.max(5, Math.round(width / 16));
  const inset = Math.round(border * 0.45);
  const [first, ...rest] = (person?.name ?? "").split(" ");

  return (
    <button
      data-node={nodeId}
      type="button"
      onClick={onClick}
      aria-expanded={ariaExpanded}
      aria-label={person ? `${person.role}: ${person.name}${team ? `, ${team}` : ""}` : `${team}: no head coach yet`}
      className="relative shrink-0 active:scale-[0.97]"
      style={{ width, height: width * 1.5, ...nodeStyle({ selected, flash }) }}
    >
      <span
        className="absolute overflow-hidden"
        style={{ inset, clipPath: chamfer(border * 0.7), background: `#040506 url(${STAFF_ART.plate.file}) 50% 30% / 260% auto` }}
      >
        <span className="absolute inset-x-0 top-[12%] flex justify-center">
          {person ? (
            <StaffPortrait person={{ name: person.name, role: person.role }} px={Math.round(width * 0.56)} />
          ) : (
            <span
              className="flex items-center justify-center rounded-full border-2 border-dashed border-white/35 text-lg font-black text-white/60"
              style={{ width: width * 0.56, height: width * 0.56 }}
            >
              ?
            </span>
          )}
        </span>
        {person ? (
          <NameBand first={first} last={rest.join(" ")} accent={STAFF_FINISH.palette.accent}>
            <span className="mt-1 block w-full truncate text-[8px] font-bold uppercase leading-none tracking-[0.12em] text-white/85">{person.role}</span>
            {team && <span className="mt-0.5 block w-full truncate text-[8px] font-semibold uppercase leading-none tracking-[0.08em] text-white/55">{team}</span>}
          </NameBand>
        ) : (
          <span className="absolute inset-x-0 bottom-0 flex flex-col items-center px-1.5 pb-[9%] text-center">
            <span className="block w-full text-[10px] font-bold uppercase leading-tight text-white/80">No head coach yet</span>
            <span className="mt-0.5 block w-full truncate text-[8px] font-semibold uppercase tracking-[0.08em] text-white/55">{team}</span>
          </span>
        )}
      </span>
      <Frame src={STAFF_ART.frame} border={border} />
    </button>
  );
}

/** An age-group division: a round badge in the graphite ring. */
export function DivisionBadge({ name, teams, size, selected, flash, onClick, nodeId, ariaExpanded }: Omit<NodeProps, "width"> & { name: string; teams: number; size: number }) {
  return (
    // The whole badge (circle + team count) is the node, so its line leaves
    // below the label instead of cutting through it.
    <div data-node={nodeId} className="flex shrink-0 flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        aria-expanded={ariaExpanded}
        aria-label={`${name}, ${teams} teams`}
        className="relative active:scale-[0.96]"
        style={{ width: size, height: size, ...nodeStyle({ selected, flash }) }}
      >
        <span className="absolute inset-[9%] flex items-center justify-center rounded-full" style={{ background: "radial-gradient(circle at 50% 35%, #1b1e24, #07080a)" }}>
          <span className="font-black italic leading-none text-white" style={{ fontFamily: "var(--font-barlow)", fontSize: size * 0.3 }}>
            {name}
          </span>
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={STAFF_ART.ring} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
      </button>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-subtle">{teams} {teams === 1 ? "team" : "teams"}</span>
    </div>
  );
}

/** A small staff chip (assistant coach, GM) on the open team. */
export function StaffChip({ person }: { person: SampleStaff }) {
  const short = person.role === "General Manager" ? "GM" : person.role === "Assistant Coach" ? "Asst. Coach" : person.role;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel py-0.5 pl-0.5 pr-2.5 text-[11px] font-semibold text-ink-mid">
      <StaffPortrait person={{ name: person.name, role: person.role }} px={22} />
      <span className="text-subtle">{short}</span>
      {person.name}
    </span>
  );
}
