"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Finish, TeamAccent } from "@/lib/cardTheme";
import { withAlpha } from "@/lib/cardTheme";
import { MASKS, SHARED_ART, type AssetSpec } from "@/lib/cardAssets";
import { PORTRAIT_TARGETS } from "@/lib/portrait/normalize";
import { MissingAsset } from "./AssetLayer";

// LIVE MATERIAL / LIGHTING LAYERS (Plan v4 §4.5). Two kinds:
//   • pure LIGHT SOURCES (background illumination, player backlight) — CSS
//     gradients are the light itself, allowed;
//   • MASKED responses (foil, specular, occlusion, highlight, atmosphere) —
//     the light is CSS but WHERE it lands is authored art (a mask). Missing
//     mask → that layer STOPS (ASSET MISSING), never an unmasked approximation.
// Finish owns intensity/spectral character; team owns environmental hue.

/** Shared mask-image styling (Safari needs the -webkit- pair + explicit size). */
function maskStyle(file: string, mode: "luminance" | "alpha" = "luminance"): CSSProperties {
  return {
    WebkitMaskImage: `url(${file})`,
    maskImage: `url(${file})`,
    WebkitMaskSize: "100% 100%",
    maskSize: "100% 100%",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    maskMode: mode,
  } as CSSProperties;
}

/**
 * A live layer that depends on an authored mask: probes the mask file; while
 * present it renders the masked effect, otherwise the ASSET MISSING state.
 */
function MaskedLayer({
  mask,
  style,
  blend,
  opacity,
  dataLayer,
  mode = "luminance",
  className,
}: {
  mask: AssetSpec;
  style: CSSProperties;
  blend: CSSProperties["mixBlendMode"];
  opacity: number | string;
  dataLayer: string;
  mode?: "luminance" | "alpha";
  className?: string;
}) {
  const [missing, setMissing] = useState(false);
  const probe = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = probe.current;
    if (el && el.complete && el.naturalWidth === 0) setMissing(true);
  }, [mask.file]);
  if (missing) return <MissingAsset spec={mask} />;
  return (
    <>
      {/* invisible probe so a 404 mask surfaces as ASSET MISSING instead of an
          unmasked (= everywhere) effect */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={probe}
        src={mask.file}
        alt=""
        aria-hidden
        className="pointer-events-none absolute h-px w-px opacity-0"
        onError={() => setMissing(true)}
      />
      <span
        aria-hidden
        data-layer={dataLayer}
        className={`pointer-events-none absolute inset-0${className ? ` ${className}` : ""}`}
        style={{ mixBlendMode: blend, opacity, ...maskStyle(mask.file, mode), ...style }}
      />
    </>
  );
}

/** Layer 14 — background illumination: TEAM environmental hue, finish-scaled. */
export function BackgroundIllumination({ finish, team }: { finish: Finish; team: TeamAccent }) {
  const eye = PORTRAIT_TARGETS.eyeY * 100;
  return (
    <span
      aria-hidden
      data-layer="bg-illumination"
      className="pointer-events-none absolute inset-0"
      style={{
        mixBlendMode: "screen",
        background:
          `radial-gradient(60% 40% at 50% ${eye + 8}%, ${team.illumination} 0%, transparent 100%),` +
          `radial-gradient(90% 55% at 50% -5%, ${withAlpha(finish.lightHue, 0.1 + 0.1 * finish.lightIntensity)} 0%, transparent 60%)`,
      }}
    />
  );
}

/** Layer 11 — player environmental backlight (behind the cutout). */
export function PlayerBacklight({ finish, team }: { finish: Finish; team: TeamAccent }) {
  const eye = PORTRAIT_TARGETS.eyeY * 100;
  return (
    <span
      aria-hidden
      data-layer="player-backlight"
      className="pointer-events-none absolute inset-0"
      style={{
        mixBlendMode: "screen",
        background:
          `radial-gradient(38% 30% at 50% ${eye + 4}%, ${withAlpha(finish.lightHue, 0.22 * finish.lightIntensity + 0.06)} 0%, transparent 100%),` +
          `radial-gradient(52% 36% at 50% ${eye + 10}%, ${team.backlight} 0%, transparent 100%)`,
      }}
    />
  );
}

/** Layer 12 — atmosphere: authored neutral particle texture, team-tinted, drifting. */
export function Atmosphere({ team, isStatic }: { team: TeamAccent; isStatic: boolean }) {
  return (
    <MaskedLayer
      mask={SHARED_ART.atmosphere}
      mode="alpha"
      dataLayer="atmosphere"
      blend="screen"
      opacity={0.9}
      style={{
        // The team tint shows through the authored texture's alpha.
        backgroundColor: team.atmosphere,
        animation: isStatic ? undefined : "pc-drift 14s ease-in-out infinite alternate",
      }}
    />
  );
}

/** Layer 12b — occlusion map (multiply) — optional authored mask. */
export function OcclusionMap() {
  return (
    <MaskedLayer
      mask={MASKS.occlusion}
      dataLayer="occlusion"
      blend="multiply"
      opacity={0.85}
      style={{ background: "#000" }}
    />
  );
}

/** Layer 3 — foreground frame highlights (screen) — optional authored mask. */
export function FrameHighlights({ finish }: { finish: Finish }) {
  return (
    <MaskedLayer
      mask={MASKS.highlight}
      dataLayer="frame-highlights"
      blend="screen"
      opacity={0.35 + 0.35 * finish.lightIntensity}
      style={{
        background: `radial-gradient(90% 70% at var(--sx,50%) var(--sy,32%), ${withAlpha(
          finish.metalHighlight,
          0.9,
        )} 0%, transparent 70%)`,
      }}
    />
  );
}

/** Layer 2 — selective spectral foil, tilt-driven, through the foil mask. */
export function FoilLayer({ finish, isStatic }: { finish: Finish; isStatic: boolean }) {
  const stops = finish.spectral.map((c, i, a) => `${c} ${((i / (a.length - 1)) * 100).toFixed(0)}%`).join(", ");
  return (
    <MaskedLayer
      mask={MASKS.foil}
      dataLayer="foil"
      blend="color-dodge"
      opacity={finish.foilIntensity}
      style={{
        backgroundImage: `linear-gradient(115deg, ${stops})`,
        backgroundSize: "300% 300%",
        backgroundPosition: isStatic ? "50% 32%" : "var(--sx,50%) var(--sy,32%)",
      }}
    />
  );
}

/** Layer 1 — specular reflection sheen, tilt-driven, through the reflection mask. */
export function SpecularLayer({ finish, isStatic }: { finish: Finish; isStatic: boolean }) {
  return (
    <MaskedLayer
      mask={MASKS.reflection}
      dataLayer="specular"
      blend="screen"
      opacity={isStatic ? 0.25 : "calc(0.15 + var(--so,0) * 0.45)"}
      style={{
        background: `radial-gradient(28% 22% at var(--sx,50%) var(--sy,32%), rgba(255,255,255,${(
          0.5 + 0.4 * finish.foilIntensity
        ).toFixed(2)}) 0%, rgba(255,255,255,0) 100%)`,
        transition: "opacity 200ms ease",
      }}
    />
  );
}
