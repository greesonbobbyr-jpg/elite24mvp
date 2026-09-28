"use client";
import { useId } from "react";
import type { Finish, TeamAccent } from "@/lib/cardTheme";
import { withAlpha } from "@/lib/cardTheme";
import { finishAssets } from "@/lib/cardAssets";
import { FRAME_WINDOW } from "@/lib/cardGeometry";

/** These paths select existing authored pixels; they do not draw metal. */
export function ForegroundPlate({ finish }: { finish: Finish }) {
  const id = useId().replace(/:/g, "");
  return <svg aria-hidden data-layer="frame-foreground" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 1500">
    <defs><clipPath id={`front-${id}`}><path d={`M0 0H1000V1500H0Z ${FRAME_WINDOW}`} clipRule="evenodd" /></clipPath></defs>
    <image href={finishAssets(finish.key).plate.file} width="1000" height="1500" clipPath={`url(#front-${id})`} />
  </svg>;
}
export function BackgroundIllumination({ finish, team }: { finish: Finish; team: TeamAccent }) {
  return <span aria-hidden data-layer="bg-illumination" className="pointer-events-none absolute" style={{
    inset: "6% 10% 20%", mixBlendMode: "screen", opacity: .3,
    background: `radial-gradient(ellipse at 50% 52%, ${team.illumination}, transparent 65%), radial-gradient(ellipse at 40% 20%, ${withAlpha(finish.lightHue, .14)}, transparent 60%)`,
  }} />;
}
export function PlayerBacklight({ finish }: { finish: Finish; team: TeamAccent }) {
  return <span aria-hidden data-layer="player-backlight" className="pointer-events-none absolute" style={{
    inset: "14% 10% 20%", mixBlendMode: "screen",
    background: `radial-gradient(ellipse at 30% 55%, ${withAlpha(finish.lightHue, .22)}, transparent 34%), radial-gradient(ellipse at 74% 51%, ${withAlpha(finish.lightHue, .3)}, transparent 32%)`,
  }} />;
}
/** Luminance of the actual artwork gives each bevel a different response.
 * Black exclusion zones keep moving foil completely off faces and text. */
export function FrameFinish({ finish, isStatic }: { finish: Finish; isStatic: boolean }) {
  const id = useId().replace(/:/g, "");
  const { spot: [spotHot, spotEdge], band: [band1, band2, band3, band4], strength } = finish.palette.frameSheen;
  const motion = strength === 1 ? "calc(.18 + var(--so, 0) * .42)" : `calc((.18 + var(--so, 0) * .42) * ${strength})`;
  return <svg aria-hidden data-layer="frame-finish" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 1500" style={{ mixBlendMode: "screen" }}>
    <defs><mask id={`metal-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1500" style={{ maskType: "luminance" }}>
      <image href={finishAssets(finish.key).plate.file} width="1000" height="1500" />
      <path d={FRAME_WINDOW} fill="black" />
      <rect x="123" y="1230" width="195" height="132" fill="black" />
      <rect x="355" y="1230" width="269" height="132" fill="black" />
      <rect x="650" y="1230" width="232" height="132" fill="black" />
      <rect x="250" y="1375" width="500" height="95" fill="black" />
    </mask></defs>
    <foreignObject width="1000" height="1500" mask={`url(#metal-${id})`}>
      <div style={{ width: "100%", height: "100%", opacity: isStatic ? .25 * strength : motion,
        background: `radial-gradient(ellipse 30% 21% at var(--sx, 38%) var(--sy, 24%), ${spotHot} 0%, ${spotEdge} 30%, transparent 75%), linear-gradient(118deg, transparent 25%, ${band1} 38%, ${band2} 44%, ${band3} 47%, ${band4} 51%, transparent 58%)`,
        backgroundSize: "100% 100%, 220% 220%", backgroundPosition: "center, var(--sx, 38%) var(--sy, 24%)", transition: "opacity 300ms ease",
      }} />
    </foreignObject>
  </svg>;
}

/** Holographic foil over the card face (Diamond): spectral bands that slide
 * with the light as the card moves. Sits under the player, so it plays across
 * the energy and the number but never the face. Soft light: color-dodge
 * blew the currents out and punched pure-black holes in the tinted field. */
export function HoloShimmer({ finish, isStatic }: { finish: Finish; isStatic: boolean }) {
  const id = useId().replace(/:/g, "");
  const holo = finish.palette.holo;
  if (!holo) return null;
  // The spectrum twice across the band: tighter color changes shimmer more.
  const loop = [...holo.colors, ...holo.colors, holo.colors[0]];
  const bands = loop.map((color, i) => `${color} ${((i / (loop.length - 1)) * 100).toFixed(1)}%`).join(", ");
  return <svg aria-hidden data-layer="holo-shimmer" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 1500" style={{ mixBlendMode: "soft-light" }}>
    <defs><clipPath id={`face-${id}`}><path d={FRAME_WINDOW} /></clipPath></defs>
    <foreignObject width="1000" height="1500" clipPath={`url(#face-${id})`}>
      <div style={{ width: "100%", height: "100%",
        opacity: isStatic ? holo.strength : `calc(${holo.strength} * (.8 + var(--so, 0) * .5))`,
        background: `linear-gradient(115deg, ${bands})`,
        backgroundSize: "300% 300%", backgroundPosition: "var(--sx, 38%) var(--sy, 24%)", transition: "opacity 300ms ease",
      }} />
    </foreignObject>
  </svg>;
}

