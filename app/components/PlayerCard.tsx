"use client";
import { EnergyEmission, FoilField } from "@/app/components/card/FoilField";


import type { CSSProperties } from "react";
import {
  withAlpha,
  FINISHES,
  finishForStars,
  starsForPoints,
  teamAccentFor,
  type Finish,
  type FinishKey,
} from "@/lib/cardTheme";
import { PORTRAIT, fy, u, zoneStyle, giantNumber } from "@/lib/cardGeometry";
import { FRAME_SLICE, finishAssets, miniArt } from "@/lib/cardAssets";
import { cutoutCss, isPortraitMetaV2, PORTRAIT_TARGETS } from "@/lib/portrait/normalize";
import { CardCompositor } from "@/app/components/card/CardCompositor";
import { AssetLayer } from "@/app/components/card/AssetLayer";
import {
  GiantNumber,
  NameBlock,
  DetailsLine,
  StatRailText,
  FooterMark,
} from "@/app/components/card/DynamicLayers";
import {
  BackgroundIllumination,
  PlayerBacklight,
  ForegroundPlate,
  FrameFinish,
  HoloShimmer,
} from "@/app/components/card/LiveEffects";
import { CardStars } from "@/app/components/card/CardStars";
import { PortraitElectricity } from "@/app/components/card/PortraitElectricity";
import { DepthShadow, RimLight } from "@/app/components/card/CutoutLighting";
import { TeamLogoBadge, TopRightSlot } from "@/app/components/card/TeamLogoBadge";
import { useImageOk } from "@/app/components/card/PortraitDisc";
import { MINI_CARD, MiniBorder, MiniFace, MiniNameBand } from "@/app/components/card/MiniFrame";
import { formatHeight } from "@/lib/height";

// THE PLAYER IDENTITY CARD FAMILY (card redesign). One design language, four
// sizes — full (the locked master), mini, compact, avatar — each RECOMPOSED
// for its context, never scaled down (§44). Geometry lives in lib/cardGeometry (one
// card, locked); material finishes in lib/cardTheme FINISHES and each level's
// authored art (level changes swap tokens and art only — Δ4). The team is an
// environmental accent (§51); readability is a hard rule: text always sits on
// darkness. Keyframes live in a component <style> so globals.css stays
// untouched and the component is drop-in reusable.

export type CardSize = "full" | "mini" | "compact" | "avatar";

export type CardPlayer = {
  name: string;
  jerseyNumber?: number | null;
  position?: string | null;
  heightInches?: number | null;
  rank?: number | null;
  points: number;
  /** Career total (drives stars/finish); falls back to `points` when absent. */
  total?: number;
  /** Roster size for the LEADERBOARD panel ("#1 of 7"). */
  rosterSize?: number | null;
  photoUrl?: string | null;
  /** Card-portrait cutout (photo pipeline A) + its normalization meta (v2). */
  cutoutUrl?: string | null;
  photoMeta?: unknown;
  initials?: string | null;
};

export type CardTeam = {
  name: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

function makeInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}


export function PlayerCard({
  size,
  player,
  team,
  finishOverride,
  staticRender = false,
  width,
  avatarPx,
}: {
  size: CardSize;
  player: CardPlayer;
  team: CardTeam;
  /** Full card only: rendered width in CSS px (or a CSS length like "100%").
   * The mini card always fills its container's width. */
  width?: number | string;
  /** Avatar only: diameter in CSS px (default 40). */
  avatarPx?: number;
  /**
   * DEV PREVIEW ONLY (card-preview studio): force a level regardless of
   * points, so every level can share identical sample data.
   */
  finishOverride?: FinishKey;
  /** Freeze all dynamic finish motion + tilt (regression baselines, Δ11). */
  staticRender?: boolean;
}) {
  if (size === "avatar") return <AvatarCard player={player} team={team} finishOverride={finishOverride} px={avatarPx} />;
  if (size === "compact") return <CompactCard player={player} team={team} finishOverride={finishOverride} />;
  if (size === "mini") return <MiniCard player={player} team={team} finishOverride={finishOverride} />;
  return (
    <FullCard
      player={player}
      team={team}
      finishOverride={finishOverride}
      staticRender={staticRender}
      width={width}
    />
  );
}


// ---------------------------------------------------------------- FULL ------
//
// THE FULL PLAYER CARD = the deterministic layered COMPOSITOR (Plan v4 §4.5).
// One geometry (lib/cardGeometry, 1000×1500 master units — PROVISIONAL until
// ★ GEOMETRY LOCKED ★); MATERIAL from finish tokens + authored finish assets;
// ENVIRONMENT from team tokens. Flat 16-layer stack, front → back:
//   1 specular · 2 foil · 3 frame highlights · 4 team logo · 5 footer type ·
//   6 stat text + stars · 7 stat-rail fg chassis (art) · 8 name + details ·
//   9 player rim light · 10 cutout · 11 backlight · 12 atmosphere · 13 giant
//   number · 14 background illumination · 15 background art · 16 chassis art.
// Authored artwork that is not supplied renders ASSET MISSING — never a
// CSS/SVG substitute.

function FullCard({
  player,
  team,
  finishOverride,
  staticRender = false,
  width,
}: {
  player: CardPlayer;
  team: CardTeam;
  finishOverride?: FinishKey;
  staticRender?: boolean;
  width?: number | string;
}) {
  const initials = player.initials || makeInitials(player.name);
  const height = formatHeight(player.heightInches);

  // FINISH (material) <- prospect level; TEAM (environment) <- team colors.
  const total = player.total ?? player.points;
  const earnedStars = starsForPoints(total);
  const finish: Finish = finishOverride ? FINISHES[finishOverride] : finishForStars(earnedStars);
  const shownStars = finishOverride ? finish.stars : earnedStars;
  const teamAccent = teamAccentFor(team);
  const art = finishAssets(finish.key);

  // Portrait: only a real normalized cutout renders as the hero.
  const meta = isPortraitMetaV2(player.photoMeta) ? player.photoMeta : null;
  const cutout = player.cutoutUrl ?? null;
  const cutoutPlacement = meta ? cutoutCss(meta) : null;

  const words = player.name.trim().split(/\s+/);
  const surname = words.length > 1 ? words[words.length - 1] : words[0];
  const firstName = words.length > 1 ? words.slice(0, -1).join(" ") : null;
  const bigNumber = giantNumber(player.jerseyNumber);
  const rankText =
    player.rank != null
      ? `#${player.rank}${player.rosterSize ? ` of ${player.rosterSize}` : ""}`
      : "—";

  // The torso fades out just above the name block (bottomY), so text never
  // fights the cutout; this is a fade, not occlusion (occlusion is ordering).
  const fadeStart = fy(PORTRAIT.fadeStartY) * 100;
  const fadeEnd = PORTRAIT_TARGETS.bottomY * 100;
  const torsoFade: CSSProperties = {
    WebkitMaskImage: `linear-gradient(180deg, #fff 0%, #fff ${fadeStart}%, transparent ${fadeEnd}%)`,
    maskImage: `linear-gradient(180deg, #fff 0%, #fff ${fadeStart}%, transparent ${fadeEnd}%)`,
    clipPath: "inset(0 8% 0 8%)",
  };

  return (
    <CardCompositor
      width={width}
      staticRender={staticRender}
      data-finish={finish.key}
      style={{ filter: `drop-shadow(0 ${u(30)} ${u(40)} rgba(0,0,0,0.55))` }}
    >
      {/* 16 · physical chassis (authored) */}
      <AssetLayer spec={art.plate} />
      {/* 14 · background illumination (live; team hue) */}
      <BackgroundIllumination finish={finish} team={teamAccent} />
      {/* 13 · giant jersey number (dynamic; finish material) */}
      <FoilField finish={finish} src={cutout} meta={meta} />
      <GiantNumber text={bigNumber} finish={finish} />
      <HoloShimmer finish={finish} isStatic={staticRender} />
      {/* 12 · atmosphere (authored texture, team-tinted) + occlusion map */}
      {/* 11 · player environmental backlight (live) */}
      <PlayerBacklight finish={finish} team={teamAccent} />
      {/* 10 · normalized cutout — its opaque pixels ARE the number occlusion */}
      {cutout && cutoutPlacement && meta ? (
        <>
          <span aria-hidden data-layer="depth-shadow" className="pointer-events-none absolute inset-0" style={torsoFade}>
            <DepthShadow src={cutout} meta={meta} finish={finish} style={cutoutPlacement} />
          </span>
          <EnergyEmission finish={finish} src={cutout} meta={meta} />
          <span data-layer="cutout" className="pointer-events-none absolute inset-0" style={torsoFade}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cutout} alt={player.name} className="absolute" style={cutoutPlacement} />
          </span>
          {/* 9 · rim light (live; face-damped, shoulder-weighted) */}
          <span aria-hidden data-layer="rim-light" className="pointer-events-none absolute inset-0" style={torsoFade}>
            <RimLight src={cutout} meta={meta} finish={finish} style={cutoutPlacement} />
            <PortraitElectricity src={cutout} meta={meta} finish={finish} style={cutoutPlacement} />
          </span>
        </>
      ) : cutout ? (
        // Seeded/meta-less cutout: best-effort contain in the portrait target.
        <span data-layer="cutout" className="pointer-events-none absolute inset-0" style={torsoFade}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cutout}
            alt={player.name}
            className="absolute left-1/2 -translate-x-1/2 object-contain object-bottom"
            style={{
              bottom: `${(1 - PORTRAIT_TARGETS.bottomY) * 100}%`,
              maxWidth: `${PORTRAIT_TARGETS.maxW * 100}%`,
              height: `${(PORTRAIT_TARGETS.bottomY - PORTRAIT_TARGETS.zone.y) * 100}%`,
            }}
          />
        </span>
      ) : (
        <PendingPortrait initials={initials} finish={finish} />
      )}
      <span aria-hidden data-layer="name-scrim" className="pointer-events-none absolute" style={{ inset: "55% 8% 17%", background: "linear-gradient(transparent, rgba(0,4,8,.12) 12%, rgba(0,4,8,.66) 38%, rgba(0,3,6,.94) 72%, #000 100%)" }} />
      <FoilField finish={finish} src={cutout} meta={meta} fringe />
      {/* 8 · name block + details (dynamic) */}
      <NameBlock firstName={firstName} surname={surname} finish={finish} />
      <DetailsLine
        parts={[player.jerseyNumber != null ? `#${player.jerseyNumber}` : null, player.position, height]}
        finish={finish}
      />
      {/* 7 · stat-rail / lower-chassis foreground pieces (authored, above the player) */}
      <ForegroundPlate finish={finish} />
      {/* 6 · stat typography + earned stars */}
      <StatRailText points={player.points} rankText={rankText} stars={shownStars} finish={finish} />
      {/* 5 · footer wordmark */}
      <FooterMark />
      {/* 4 · team logo (top-left) + intentionally-empty top-right slot */}
      <TeamLogoBadge logoUrl={team.logoUrl} />
      <TopRightSlot />
      {/* 3 · frame highlights (masked, live) */}
      <FrameFinish finish={finish} isStatic={staticRender} />
    </CardCompositor>
  );
}

/** CLEARLY-PENDING portrait state (Δ5 concern 7): initials, never a "finished" card. */
function PendingPortrait({ initials, finish }: { initials: string; finish: Finish }) {
  return (
    <div
      data-layer="portrait-pending"
      className="pointer-events-none absolute flex flex-col items-center justify-center"
      style={{ ...zoneStyle(PORTRAIT.zone), gap: u(16) }}
    >
      <span
        className="flex items-center justify-center rounded-full border-2 border-dashed"
        style={{
          width: u(260),
          height: u(260),
          borderColor: withAlpha(finish.metalHighlight, 0.35),
          background: "rgba(0,0,0,0.35)",
        }}
      >
        <span
          className="font-black uppercase italic text-white/85"
          style={{ fontFamily: "var(--font-barlow)", fontSize: u(84) }}
        >
          {initials}
        </span>
      </span>
      <span
        className="font-bold uppercase"
        style={{ fontSize: u(24), letterSpacing: "0.22em", color: withAlpha(finish.metalHighlight, 0.5) }}
      >
        Photo pending
      </span>
    </div>
  );
}


// ------------------------------------------------------------ SMALL SIZES --
//
// The compact row (leaderboard, coach roster) and the avatar (Team Circle,
// header chip) wear their level's own art, cut from its plate by
// scripts/card-art.ts (miniArt) — never CSS-drawn metal. General UI keeps
// initials/photo fallbacks (Δ5 applies to full-card creation only).

/** Finish + portrait context the small sizes derive from. */
function useCardContext(player: CardPlayer, finishOverride?: FinishKey) {
  const total = player.total ?? player.points;
  const earned = starsForPoints(total);
  const finish = finishOverride ? FINISHES[finishOverride] : finishForStars(earned);
  const stars = finishOverride ? finish.stars : earned;
  const meta = isPortraitMetaV2(player.photoMeta) ? player.photoMeta : null;
  const cutout = player.cutoutUrl ?? null;
  return { total, stars, finish, meta, cutout };
}

/** The row's face, cut to sit inside the mini frame's chamfered corners. */
const ROW_FACE_CLIP =
  "polygon(7px 0, calc(100% - 7px) 0, 100% 7px, 100% calc(100% - 7px), calc(100% - 7px) 100%, 7px 100%, 0 calc(100% - 7px), 0 7px)";

// COMPACT: a slim card — the level's mini frame around its card face with a
// faint slice of its energy, then avatar, name, number and position, points
// and stars in the full card's colors.
function CompactCard({ player, team, finishOverride }: { player: CardPlayer; team: CardTeam; finishOverride?: FinishKey }) {
  // Tier from career points (total); the row shows the points it's ranked by,
  // like the full card's POINTS panel.
  const { stars, finish } = useCardContext(player, finishOverride);
  const { palette } = finish;
  const art = finishAssets(finish.key);
  return (
    <div className="relative h-[72px] w-full" data-finish={finish.key}>
      <div
        aria-hidden
        className="absolute overflow-hidden"
        style={{ inset: 3, clipPath: ROW_FACE_CLIP, background: `#040507 url(${art.plate.file}) 50% 30% / 140% auto` }}
      >
        <span className="absolute inset-0" style={{ background: `url(${art.field.file}) 50% 38% / 120% auto`, opacity: 0.5 }} />
        {/* text always sits on darkness */}
        <span
          className="absolute inset-0"
          style={{ background: "linear-gradient(90deg, rgba(0,0,0,.35), rgba(0,0,0,.1) 45%, rgba(0,0,0,.6))" }}
        />
      </div>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          borderStyle: "solid",
          borderWidth: 10,
          borderColor: "transparent",
          borderImageSource: `url(${miniArt(finish.key).frame})`,
          borderImageSlice: FRAME_SLICE,
          borderImageWidth: "10px",
          borderImageRepeat: "stretch",
        }}
      />

      <div className="relative flex h-full items-center gap-3 pl-3.5 pr-4">
        <AvatarCard player={player} team={team} finishOverride={finish.key} px={48} />

        <div className="min-w-0 flex-1">
          <p
            className="truncate text-base font-black italic uppercase leading-none text-white"
            style={{ fontFamily: "var(--font-barlow)" }}
          >
            {player.name}
          </p>
          <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-white/75">
            {player.jerseyNumber != null && (
              <>
                <span style={{ color: palette.accent }}>#{player.jerseyNumber}</span>
                <span style={{ color: palette.separator }}> · </span>
              </>
            )}
            {player.position ?? "Player"}
          </p>
        </div>

        <div className="shrink-0 text-right">
          {player.rank != null && (
            <p className="text-lg font-black leading-none tabular-nums" style={{ color: palette.statHeader }}>
              #{player.rank}
            </p>
          )}
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/75 tabular-nums">
            {player.points} pts
          </p>
          <span className="mt-1 flex justify-end">
            <CardStars count={stars} finish={finish} sizePx={8} gapPx={2} />
          </span>
        </div>
      </div>
    </div>
  );
}

/** The avatar's round window onto the card, in card units: head, shoulders
 * and the energy leaving them. */
const AVATAR_VIEW = { x: 170, y: 260, size: 660 };

// AVATAR: a small round window onto the player's own card (owner review,
// 2026-09-26: just the player "doesn't have the player card vibe"). The
// level's energy, backlight and tier glow sit behind the cutout exactly where
// the full card puts them, inside the level's ring — the frame's crystal band
// bent into a circle. No jersey number: collapsed cards have no room to show
// it well (owner, 2026-09-27); rows carry it as text. A photo without card
// placement fills the disc; no photo shows initials on the tier's card.
function AvatarCard({
  player,
  team,
  finishOverride,
  px = 40,
}: {
  player: CardPlayer;
  team: CardTeam;
  finishOverride?: FinishKey;
  px?: number;
}) {
  const { finish, meta, cutout } = useCardContext(player, finishOverride);
  const initials = player.initials || makeInitials(player.name);
  const src = cutout ?? player.photoUrl ?? null;
  const { ok: imageOk, attach, onError: onImageError } = useImageOk(src);
  const placed = imageOk && cutout && meta ? meta : null;
  const photo = imageOk && !placed ? src : null;
  // ring.webp's band spans radii 78–95 of 96 px; the disc tucks just under it.
  const inset = px * 0.09;
  const disc = px - inset * 2;
  const s = disc / AVATAR_VIEW.size; // px per card unit

  return (
    <div
      className="relative inline-flex shrink-0"
      style={{ width: px, height: px, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.45))" }}
    >
      <div className="absolute flex items-center justify-center overflow-hidden rounded-full" style={{ inset, background: "#030406", isolation: "isolate" }}>
        {/* The card itself, scaled so the window fills the disc. */}
        <div
          aria-hidden={!placed}
          className="absolute"
          style={{ left: -AVATAR_VIEW.x * s, top: -AVATAR_VIEW.y * s, width: 1000 * s, height: 1500 * s, "--u": `${s}px` } as CSSProperties}
        >
          {/* A touch brighter than on the full card, so the currents read this small. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={finishAssets(finish.key).field.file} alt="" className="absolute inset-0 h-full w-full" style={{ filter: "brightness(1.25)" }} />
          <HoloShimmer finish={finish} isStatic />
          <PlayerBacklight finish={finish} team={teamAccentFor(team)} />
          {/* The level's glow behind the player: this small, the card's own
              backlight is too faint to carry the tier's color on its own. */}
          <span
            className="absolute"
            style={{
              left: u(120), top: u(380), width: u(760), height: u(640), mixBlendMode: "screen",
              background: `radial-gradient(closest-side, ${withAlpha(finish.palette.energy.glow[2], 0.55)}, transparent)`,
            }}
          />
          {placed && (
            // eslint-disable-next-line @next/next/no-img-element
            <img ref={attach} src={cutout!} alt={player.name} className="absolute" style={cutoutCss(placed)} onError={onImageError} />
          )}
        </div>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img ref={attach} src={photo} alt={player.name} onError={onImageError}
            className={`absolute inset-0 h-full w-full object-cover${cutout ? " object-top" : ""}`} />
        )}
        {!imageOk && (
          <span
            className="relative font-black uppercase italic text-white"
            style={{ fontFamily: "var(--font-barlow)", fontSize: disc * 0.36, textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
          >
            {initials}
          </span>
        )}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={miniArt(finish.key).ring} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}

// ---------------------------------------------------------------- MINI ------

/** The mini card's window onto the full card, in card units (2:3): head,
 * shoulders and the energy around them. */
const MINI_VIEW = { x: 150, y: 250, w: 700 };
/** The face's width in container units (the frame's inset on both sides). */
const MINI_FACE_W = 94.4; // cqw
/** The torso fades out towards the name, as on the full card. */
const MINI_TORSO_MASK = `linear-gradient(180deg, #fff 0%, #fff ${fy(PORTRAIT.fadeStartY) * 100}%, transparent ${PORTRAIT_TARGETS.bottomY * 100}%)`;

// MINI: a small portrait card (leaderboard podium, org tree) — the level's
// frame around a window onto the player's own card (energy, backlight, tier
// glow, cutout), then the name and stars. No jersey number: collapsed cards
// have no room for it (owner, 2026-09-27). Fluid: it fills its container's
// width at 2:3 (card/MiniFrame), so one card works from a 320px phone's
// podium to a desktop tree.
function MiniCard({ player, team, finishOverride }: { player: CardPlayer; team: CardTeam; finishOverride?: FinishKey }) {
  const { stars, finish, meta, cutout } = useCardContext(player, finishOverride);
  const initials = player.initials || makeInitials(player.name);
  const src = cutout ?? player.photoUrl ?? null;
  const { ok: imageOk, attach, onError: onImageError } = useImageOk(src);
  const placed = imageOk && cutout && meta ? meta : null;
  const photo = imageOk && !placed ? src : null;

  return (
    <div className="relative w-full" style={MINI_CARD} data-finish={finish.key}>
      <MiniFace
        style={{
          background: "#030406",
          isolation: "isolate",
          // Card units: the window's 700 units span the face.
          "--u": `calc(${MINI_FACE_W}cqw / ${MINI_VIEW.w})`,
        } as CSSProperties}
      >
        {/* The card itself, scaled so the window fills the face. */}
        <div
          aria-hidden
          className="absolute"
          style={{ left: u(-MINI_VIEW.x), top: u(-MINI_VIEW.y), width: u(1000), height: u(1500) }}
        >
          {/* A touch brighter than on the full card, so the currents read this small. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={finishAssets(finish.key).field.file} alt="" className="absolute inset-0 h-full w-full" style={{ filter: "brightness(1.2)" }} />
          <HoloShimmer finish={finish} isStatic />
          <PlayerBacklight finish={finish} team={teamAccentFor(team)} />
          <span
            className="absolute"
            style={{
              left: u(120), top: u(380), width: u(760), height: u(640), mixBlendMode: "screen",
              background: `radial-gradient(closest-side, ${withAlpha(finish.palette.energy.glow[2], 0.55)}, transparent)`,
            }}
          />
          {placed && (
            <span className="absolute inset-0" style={{ WebkitMaskImage: MINI_TORSO_MASK, maskImage: MINI_TORSO_MASK }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={attach} src={cutout!} alt="" className="absolute" style={cutoutCss(placed)} onError={onImageError} />
            </span>
          )}
        </div>
        {photo && (
          // A photo not yet cut out for the card fills the face.
          // eslint-disable-next-line @next/next/no-img-element
          <img ref={attach} src={photo} alt="" onError={onImageError}
            className={`absolute inset-0 h-full w-full object-cover${cutout ? " object-top" : ""}`} />
        )}
        {!imageOk && (
          <span className="absolute inset-x-0 top-[18%] flex justify-center">
            <span className="font-black uppercase italic text-white/90" style={{ fontFamily: "var(--font-barlow)", fontSize: "30cqw", textShadow: "0 2px 6px rgba(0,0,0,.8)" }}>
              {initials}
            </span>
          </span>
        )}
        <MiniNameBand name={player.name} accent={finish.palette.accent}>
          <span className="flex justify-center" style={{ marginTop: "3.5cqw", "--u": "1cqw" } as CSSProperties}>
            <CardStars count={stars} finish={finish} sizeUnits={7} gapUnits={1} />
          </span>
        </MiniNameBand>
      </MiniFace>
      <MiniBorder frame={miniArt(finish.key).frame} />
    </div>
  );
}
