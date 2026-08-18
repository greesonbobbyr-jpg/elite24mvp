"use client";

import type { CSSProperties } from "react";
import {
  accentColor,
  withAlpha,
  FINISHES,
  finishForStars,
  starsForPoints,
  teamAccentFor,
  type Finish,
  type FinishKey,
} from "@/lib/cardTheme";
import { PORTRAIT, u, zoneStyle, giantNumber } from "@/lib/cardGeometry";
import { finishAssets } from "@/lib/cardAssets";
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
  Atmosphere,
  OcclusionMap,
  FrameHighlights,
  FoilLayer,
  SpecularLayer,
} from "@/app/components/card/LiveEffects";
import { CardStars } from "@/app/components/card/CardStars";
import { DepthShadow, RimLight } from "@/app/components/card/CutoutLighting";
import { TeamLogoBadge, TopRightSlot } from "@/app/components/card/TeamLogoBadge";
import { chamferClip, headCropStyle } from "@/app/components/card/chrome";

// THE PLAYER IDENTITY CARD FAMILY (card redesign). One design language, four
// sizes — full (the locked master), wide, compact, avatar — each RECOMPOSED
// for its context, never scaled down (§44). Geometry lives in
// lib/cardGeometry (one card, locked after the milestone); material finishes
// in lib/cardTheme FINISHES (level changes swap tokens only — Δ4). The team
// is an environmental accent (§51); readability is a hard rule: text always
// sits on darkness. Keyframes live in a component <style> so globals.css
// stays untouched and the component is drop-in reusable.

export type CardSize = "full" | "wide" | "compact" | "avatar";

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

function formatHeight(inches?: number | null): string | null {
  if (inches == null) return null;
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

export function PlayerCard({
  size,
  player,
  team,
  finishOverride,
  staticRender = false,
  width,
}: {
  size: CardSize;
  player: CardPlayer;
  team: CardTeam;
  /** Full card only: rendered width in CSS px (or a CSS length like "100%"). */
  width?: number | string;
  /**
   * DEV PREVIEW ONLY (card-preview gallery): force a material finish
   * regardless of points, so the five finish environments can share identical
   * sample data.
   */
  finishOverride?: FinishKey;
  /** Freeze all dynamic finish motion + tilt (regression baselines, Δ11). */
  staticRender?: boolean;
}) {
  if (size === "avatar") return <AvatarCard player={player} team={team} />;
  if (size === "compact") return <CompactCard player={player} team={team} />;
  if (size === "wide") return <WideCard player={player} team={team} />;
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
  const fadeStart = (PORTRAIT_TARGETS.bottomY - 0.045) * 100;
  const fadeEnd = PORTRAIT_TARGETS.bottomY * 100;
  const torsoFade: CSSProperties = {
    WebkitMaskImage: `linear-gradient(180deg, #fff 0%, #fff ${fadeStart}%, transparent ${fadeEnd}%)`,
    maskImage: `linear-gradient(180deg, #fff 0%, #fff ${fadeStart}%, transparent ${fadeEnd}%)`,
  };

  return (
    <CardCompositor
      width={width}
      staticRender={staticRender}
      data-finish={finish.key}
      style={{ filter: `drop-shadow(0 ${u(30)} ${u(40)} rgba(0,0,0,0.55))` }}
    >
      {/* 16 · physical chassis (authored) */}
      <AssetLayer spec={art.chassis} />
      {/* 15 · background / environment (authored) */}
      <AssetLayer spec={art.background} />
      {/* 14 · background illumination (live; team hue) */}
      <BackgroundIllumination finish={finish} team={teamAccent} />
      {/* 13 · giant jersey number (dynamic; finish material) */}
      <GiantNumber text={bigNumber} finish={finish} />
      {/* 12 · atmosphere (authored texture, team-tinted) + occlusion map */}
      <Atmosphere team={teamAccent} isStatic={staticRender} />
      <OcclusionMap />
      {/* 11 · player environmental backlight (live) */}
      <PlayerBacklight finish={finish} team={teamAccent} />
      {/* 10 · normalized cutout — its opaque pixels ARE the number occlusion */}
      {cutout && cutoutPlacement && meta ? (
        <>
          <span aria-hidden data-layer="depth-shadow" className="pointer-events-none absolute inset-0" style={torsoFade}>
            <DepthShadow src={cutout} meta={meta} style={cutoutPlacement} />
          </span>
          <span data-layer="cutout" className="pointer-events-none absolute inset-0" style={torsoFade}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cutout} alt={player.name} className="absolute" style={cutoutPlacement} />
          </span>
          {/* 9 · rim light (live; face-damped, shoulder-weighted) */}
          <span aria-hidden data-layer="rim-light" className="pointer-events-none absolute inset-0" style={torsoFade}>
            <RimLight src={cutout} meta={meta} finish={finish} style={cutoutPlacement} />
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
      {/* 8 · name block + details (dynamic) */}
      <NameBlock firstName={firstName} surname={surname} team={teamAccent} />
      <DetailsLine
        parts={[player.jerseyNumber != null ? `#${player.jerseyNumber}` : null, player.position, height]}
      />
      {/* 7 · stat-rail / lower-chassis foreground pieces (authored, above the player) */}
      <AssetLayer spec={art.chassisFg} />
      {/* 6 · stat typography + earned stars */}
      <StatRailText points={total} rankText={rankText} stars={shownStars} finish={finish} />
      {/* 5 · footer wordmark */}
      <FooterMark />
      {/* 4 · team logo (top-left) + intentionally-empty top-right slot */}
      <TeamLogoBadge logoUrl={team.logoUrl} />
      <TopRightSlot />
      {/* 3 · frame highlights (masked, live) */}
      <FrameHighlights finish={finish} />
      {/* 2 · selective foil (masked, live) */}
      <FoilLayer finish={finish} isStatic={staticRender} />
      {/* 1 · specular reflection (masked, live) */}
      <SpecularLayer finish={finish} isStatic={staticRender} />
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


// ------------------------------------------------------- SHARED (redesign) --

/** Finish + portrait context every recomposed size derives from. */
function useCardContext(player: CardPlayer) {
  const total = player.total ?? player.points;
  const stars = starsForPoints(total);
  const finish = finishForStars(stars);
  const meta = isPortraitMetaV2(player.photoMeta) ? player.photoMeta : null;
  const cutout = player.cutoutUrl ?? null;
  return { total, stars, finish, meta, cutout };
}

const WIDE_ASPECT = 16 / 10;

// ---------------------------------------------------------------- WIDE ------

// Horizontal recomposition of the master's TOP HALF (§44): same finish
// language — chamfered metal, dark environment, ghosted number behind the
// right side, cutout bust left, name block dominant, micro star group. No
// tilt; the finish carries the material feel.
function WideCard({ player, team }: { player: CardPlayer; team: CardTeam }) {
  const { total, stars, finish, cutout } = useCardContext(player);
  const accent = accentColor(team.primaryColor, team.secondaryColor);
  const initials = player.initials || makeInitials(player.name);
  const height = formatHeight(player.heightInches);
  const words = player.name.trim().split(/\s+/);
  const surname = words.length > 1 ? words[words.length - 1] : words[0];
  const firstName = words.length > 1 ? words.slice(0, -1).join(" ") : null;
  const bigNumber = giantNumber(player.jerseyNumber);
  const clipOuter = chamferClip(0, 0.055, WIDE_ASPECT);
  const clipFace = chamferClip(0.012, 0.045, WIDE_ASPECT);

  return (
    <div
      className="relative"
      style={{
        width: 360,
        maxWidth: "100%",
        aspectRatio: `${WIDE_ASPECT}`,
        filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.5))",
      }}
    >
      {/* thin finish frame */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          clipPath: clipOuter,
          background: `conic-gradient(from 130deg at 50% 46%, ${finish.metal.join(", ")}, ${finish.metal[0]})`,
        }}
      />
      {/* face */}
      <div className="absolute inset-0" style={{ clipPath: clipFace }}>
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              `radial-gradient(90% 90% at 22% 50%, ${withAlpha(finish.lightHue, 0.14)} 0%, transparent 60%),` +
              `radial-gradient(110% 90% at 85% 110%, ${withAlpha(accent, 0.1)} 0%, transparent 55%),` +
              `linear-gradient(120deg, ${finish.background.top} 0%, ${finish.background.mid} 55%, ${finish.background.bottom} 100%)`,
          }}
        />
        {/* ghosted number behind the right half */}
        {bigNumber && (
          <span
            aria-hidden
            className="absolute -top-2 right-2 select-none font-black italic leading-none"
            style={{
              fontFamily: "var(--font-barlow)",
              fontSize: 132,
              letterSpacing: "-0.04em",
              color: "transparent",
              WebkitTextStrokeWidth: 1.5,
              WebkitTextStrokeColor: withAlpha(finish.metalHighlight, 0.32),
            }}
          >
            {bigNumber}
          </span>
        )}
        {/* cutout bust, bottom-anchored left */}
        {cutout ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cutout}
            alt=""
            className="absolute bottom-0 left-0 h-[96%] w-[42%] object-contain object-bottom"
            style={{
              filter: `drop-shadow(0 0 14px ${withAlpha(finish.lightHue, 0.3 * finish.lightIntensity)})`,
            }}
          />
        ) : (
          <span
            className="absolute bottom-0 left-0 flex h-full w-[42%] items-center justify-center font-black uppercase italic text-white/80"
            style={{ fontFamily: "var(--font-barlow)", fontSize: 44 }}
          >
            {initials}
          </span>
        )}
        {/* readability scrim under the text side */}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.3) 55%, rgba(0,0,0,0.45) 100%)",
          }}
        />
        {/* name block */}
        <div className="absolute inset-y-0 left-[44%] right-3 flex flex-col justify-center">
          {firstName && (
            <p
              className="truncate text-[11px] font-bold uppercase leading-none"
              style={{ letterSpacing: "0.14em", color: accent }}
            >
              {firstName}
            </p>
          )}
          <p
            className="truncate font-black uppercase italic leading-[0.95]"
            style={{
              fontFamily: "var(--font-barlow)",
              fontSize: surname.length > 9 ? 26 : 32,
              color: "transparent",
              backgroundImage:
                "linear-gradient(180deg, #ffffff 0%, #eef2f6 42%, #a7b2bf 55%, #e3e9f0 74%, #cfd7df 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.55))",
            }}
          >
            {surname}
          </p>
          <p className="mt-1.5 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-white/80">
            {[
              player.jerseyNumber != null ? `#${player.jerseyNumber}` : null,
              player.position,
              height,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <CardStars count={stars} finish={finish} sizePx={11} gapPx={3} />
            <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/70">
              Prospect
            </span>
            <span className="ml-auto text-[10px] font-bold tabular-nums text-white/80">
              {total} pts
            </span>
          </div>
        </div>
        {/* logo — top-left, same as the master */}
        <div className="absolute left-2 top-2 h-10 w-10">
          {team.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={team.logoUrl}
              alt=""
              className="h-full w-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)]"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- COMPACT -----

// COMPACT (§44): a mini identity row in the same finish language — thin metal
// frame, cutout bust breaking the top edge over a small ghost number,
// condensed name, rank/points, micro star group. General-UI resilience keeps
// initials/photo fallbacks here (Δ5 applies to full-card CREATION only).
function CompactCard({
  player,
  team,
}: {
  player: CardPlayer;
  team: CardTeam;
}) {
  const { total, stars, finish, cutout } = useCardContext(player);
  const accent = accentColor(team.primaryColor, team.secondaryColor);
  const bigNumber = giantNumber(player.jerseyNumber);

  return (
    <div className="relative h-[72px] w-full" style={{ overflow: "visible" }}>
      {/* thin finish frame + dark environment */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-xl"
        style={{
          background: `linear-gradient(120deg, ${finish.background.top} 0%, ${finish.background.mid} 55%, ${finish.background.bottom} 100%)`,
          boxShadow: `inset 0 0 0 1px ${withAlpha(finish.metalHighlight, 0.25)}, inset 0 1px 0 ${withAlpha(
            finish.metalHighlight,
            0.12,
          )}, 0 4px 12px -6px rgba(0,0,0,0.6)`,
        }}
      />
      {/* faint team tint on the right edge */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-xl"
        style={{
          background: `radial-gradient(60% 120% at 100% 50%, ${withAlpha(accent, 0.12)} 0%, transparent 60%)`,
        }}
      />

      <div className="relative flex h-full items-center gap-3 pl-2 pr-4">
        {/* bust: cutout breaks the row's top edge over a small ghost number */}
        <div className="relative h-full w-16 shrink-0">
          {bigNumber && (
            <span
              aria-hidden
              className="absolute bottom-0 left-1/2 -translate-x-1/2 select-none font-black italic leading-none"
              style={{
                fontFamily: "var(--font-barlow)",
                fontSize: 52,
                color: "transparent",
                WebkitTextStrokeWidth: 1,
                WebkitTextStrokeColor: withAlpha(finish.metalHighlight, 0.25),
              }}
            >
              {bigNumber}
            </span>
          )}
          {cutout ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cutout}
              alt=""
              className="absolute bottom-0 left-1/2 h-[86px] w-auto max-w-none -translate-x-1/2 object-contain object-bottom"
              style={{
                filter: `drop-shadow(0 0 8px ${withAlpha(finish.lightHue, 0.35 * finish.lightIntensity)})`,
              }}
            />
          ) : (
            <span className="absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center">
              <AvatarCard player={player} team={team} />
            </span>
          )}
        </div>

        <div className="relative min-w-0 flex-1">
          <p
            className="truncate text-base font-black italic uppercase leading-none text-white"
            style={{ fontFamily: "var(--font-barlow)" }}
          >
            {player.name}
          </p>
          <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-white/65">
            {player.jerseyNumber != null ? `#${player.jerseyNumber} · ` : ""}
            {player.position ?? "Player"}
          </p>
        </div>

        <div className="relative shrink-0 text-right">
          {player.rank != null && (
            <p
              className="text-lg font-black leading-none tabular-nums"
              style={{ color: finish.metalHighlight }}
            >
              #{player.rank}
            </p>
          )}
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/65 tabular-nums">
            {total} pts
          </p>
          <span className="mt-1 flex justify-end">
            <CardStars count={stars} finish={finish} sizePx={8} gapPx={2} />
          </span>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- AVATAR -----

// AVATAR (§44): circular finish ring + cutout HEAD CROP (face-box anchored
// when meta exists). Players only — staff circles are the STAFF treatment.
function AvatarCard({ player, team }: { player: CardPlayer; team: CardTeam }) {
  const { finish, meta, cutout } = useCardContext(player);
  const initials = player.initials || makeInitials(player.name);
  const DISC = 36; // inner disc px (ring adds 2px per side)
  void team;

  return (
    <div
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(from 130deg, ${finish.metal.join(", ")}, ${finish.metal[0]})`,
        padding: 2,
        boxShadow: "0 2px 6px rgba(0,0,0,0.45)",
      }}
    >
      <div
        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full"
        style={{
          background: `radial-gradient(120% 120% at 50% 20%, ${finish.background.mid} 0%, ${finish.background.bottom} 100%)`,
        }}
      >
        {cutout && meta ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cutout} alt={player.name} style={headCropStyle(meta, DISC)} />
        ) : cutout ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cutout}
            alt={player.name}
            className="h-full w-full object-cover object-top"
          />
        ) : player.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.photoUrl}
            alt={player.name}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <span
            className="text-xs font-black uppercase text-white"
            style={{ fontFamily: "var(--font-barlow)" }}
          >
            {initials}
          </span>
        )}
      </div>
    </div>
  );
}

