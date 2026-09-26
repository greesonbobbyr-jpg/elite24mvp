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
  return <svg aria-hidden data-layer="frame-finish" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 1500" style={{ mixBlendMode: "screen" }}>
    <defs><mask id={`metal-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1500" style={{ maskType: "luminance" }}>
      <image href={finishAssets(finish.key).plate.file} width="1000" height="1500" />
      <path d={FRAME_WINDOW} fill="black" />
      <rect x="115" y="1230" width="195" height="132" fill="black" />
      <rect x="347" y="1230" width="269" height="132" fill="black" />
      <rect x="642" y="1230" width="232" height="132" fill="black" />
      <rect x="250" y="1375" width="500" height="95" fill="black" />
    </mask></defs>
    <foreignObject width="1000" height="1500" mask={`url(#metal-${id})`}>
      <div style={{ width: "100%", height: "100%", opacity: isStatic ? .25 : "calc(.18 + var(--so, 0) * .42)",
        background: "radial-gradient(ellipse 30% 21% at var(--sx, 38%) var(--sy, 24%), #fff 0%, #b8efff60 30%, transparent 75%), linear-gradient(118deg, transparent 25%, #88e8ff25 38%, #f7caff80 44%, #ffffffa0 47%, #85e9ff40 51%, transparent 58%)",
        backgroundSize: "100% 100%, 220% 220%", backgroundPosition: "center, var(--sx, 38%) var(--sy, 24%)", transition: "opacity 300ms ease",
      }} />
    </foreignObject>
  </svg>;
}

