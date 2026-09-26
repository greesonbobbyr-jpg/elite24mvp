"use client";
import { useId } from "react";
import type { Finish } from "@/lib/cardTheme";
import type { PortraitMetaV2 } from "@/lib/portrait/normalize";

export function DepthShadow({ src, meta, style }: { src: string; meta: Pick<PortraitMetaV2, "srcW" | "srcH">; style: React.CSSProperties }) {
  const id = useId().replace(/:/g, "");
  return <svg aria-hidden className="pointer-events-none absolute" style={{ ...style, aspectRatio: `${meta.srcW}/${meta.srcH}`, height: "auto" }} viewBox={`0 0 ${meta.srcW} ${meta.srcH}`} overflow="visible">
    <defs><filter id={`shadow-${id}`} x="-15%" y="-15%" width="130%" height="130%">
      <feGaussianBlur in="SourceAlpha" stdDeviation={meta.srcW * .012} result="soft" />
      <feFlood floodColor="#000815" floodOpacity=".75" /><feComposite in2="soft" operator="in" />
    </filter></defs>
    <image href={src} width={meta.srcW} height={meta.srcH} filter={`url(#shadow-${id})`} />
  </svg>;
}

/** Alpha-derived lighting: a fine edge, broken foil and a broad blue spill.
 * Both are outside SourceAlpha. Direction and face damping keep this from
 * becoming a uniform sticker outline, and adapt to any normalized cutout. */
export function RimLight({ src, meta, finish, style }: { src: string; meta: PortraitMetaV2; finish: Finish; style: React.CSSProperties }) {
  const id = useId().replace(/:/g, "");
  const { srcW: w, srcH: h, faceBox: face } = meta;
  return <svg aria-hidden className="pointer-events-none absolute" style={{ ...style, aspectRatio: `${w}/${h}`, height: "auto", mixBlendMode: "screen", opacity: .9 }} viewBox={`0 0 ${w} ${h}`} overflow="visible">
    <defs>
      <filter id={`rim-${id}`} x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
        {/* Build every light band from this player's alpha, never a fixed halo. */}
        <feMorphology in="SourceAlpha" operator="dilate" radius={w * .002} result="expanded" />
        <feGaussianBlur in="expanded" stdDeviation={w * .007} result="aura" />
        <feComposite in="aura" in2="SourceAlpha" operator="out" result="outerAura" />
        <feComponentTransfer in="outerAura" result="radiance"><feFuncA type="linear" slope="1.2" /></feComponentTransfer>
        <feFlood floodColor={finish.lightHue} floodOpacity=".85" result="blue" />
        <feComposite in="blue" in2="radiance" operator="in" result="glow" />

        <feMorphology in="SourceAlpha" operator="dilate" radius={w * .005} result="foilWidth" />
        <feTurbulence type="fractalNoise" baseFrequency=".07 .12" numOctaves="2" seed="8" result="noise" />
        <feDisplacementMap in="foilWidth" in2="noise" scale={w * .05} xChannelSelector="R" yChannelSelector="G" result="brokenFoil" />
        <feComposite in="brokenFoil" in2="SourceAlpha" operator="out" result="outsideFoil" />
        <feGaussianBlur in="outsideFoil" stdDeviation={w * .0012} result="softFoil" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1 0 0 0 0" result="grainAlpha" />
        <feComponentTransfer in="grainAlpha" result="flecks"><feFuncA type="discrete" tableValues="0 .05 .35 .75 1" /></feComponentTransfer>
        <feComposite in="softFoil" in2="flecks" operator="in" result="foilMask" />
        <feFlood floodColor="#bcefff" floodOpacity="1" result="cyan" />
        <feComposite in="cyan" in2="foilMask" operator="in" result="foil" />

        <feMorphology in="SourceAlpha" operator="dilate" radius={w * .0012} result="wide" />
        <feComposite in="wide" in2="SourceAlpha" operator="out" result="edge" />
        <feGaussianBlur in="edge" stdDeviation={w * .0008} result="tight" />
        <feFlood floodColor="#d7f7ff" floodOpacity=".7" result="white" />
        <feComposite in="white" in2="tight" operator="in" result="core" />
        <feMerge><feMergeNode in="glow" /><feMergeNode in="foil" /><feMergeNode in="core" /></feMerge>
      </filter>
      <linearGradient id={`vertical-${id}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="white" stopOpacity=".35" /><stop offset={meta.eyeY/h} stopColor="white" stopOpacity=".38" /><stop offset={Math.min(.9,meta.shoulderY/h)} stopColor="white" /><stop offset="1" stopColor="white" stopOpacity=".5" /></linearGradient>
      <radialGradient id={`face-${id}`}><stop stopColor="black" /><stop offset=".65" stopColor="black" stopOpacity=".85" /><stop offset="1" stopColor="black" stopOpacity="0" /></radialGradient>
      <mask id={`light-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width={w} height={h}>
        <rect width={w} height={h} fill={`url(#vertical-${id})`} />
        <ellipse cx={face.x+face.w/2} cy={face.y+face.h*.45} rx={face.w*.85} ry={face.h*.85} fill={`url(#face-${id})`} />
      </mask>
    </defs>
    <image href={src} width={w} height={h} filter={`url(#rim-${id})`} mask={`url(#light-${id})`} />
  </svg>;
}





