"use client";
import { useEffect, useId, useState } from "react";
import type { Finish } from "@/lib/cardTheme";
import { finishAssets } from "@/lib/cardAssets";
import type { PortraitMetaV2 } from "@/lib/portrait/normalize";
import { shoulderRoots, type CardPoint } from "@/lib/portrait/foil";
import { FRAME_WINDOW, PORTRAIT } from "@/lib/cardGeometry";

/** The field's two hot nodes, where its currents converge (card units,
 * measured from the artwork). In B3 they sat on the player's shoulders; every
 * level's field is recolored from Platinum's, so all share them. */
const NODES = { left: { x: 223, y: 796 }, right: { x: 762, y: 805 } };

type Roots = { left: CardPoint; right: CardPoint };

/** Shoulder roots, measured once per cutout and placement for the session
 * (in flight too): a card's three field passes, and every card showing the
 * same photo — a row of small cards, a branch reopened — share one read of
 * its pixels. */
const rootsByCutout = new Map<string, Promise<Roots | null>>();

function measureRoots(src: string, meta: PortraitMetaV2): Promise<Roots | null> {
  const key = `${src}\n${JSON.stringify(meta)}`;
  let roots = rootsByCutout.get(key);
  if (!roots) {
    roots = new Promise((resolve) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 512;
          canvas.height = Math.round((image.naturalHeight * 512) / image.naturalWidth);
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return resolve(null);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          resolve(shoulderRoots(pixels, canvas.width, canvas.height, meta));
        } catch {
          resolve(null); // Unreadable external alpha keeps the authored layout.
        }
      };
      image.onerror = () => {
        rootsByCutout.delete(key); // a photo that failed to load may load next time
        resolve(null);
      };
      image.src = src;
    });
    rootsByCutout.set(key, roots);
  }
  return roots;
}

/** This player's shoulder roots, from the cutout's alpha. */
function useShoulderRoots(src: string | null, meta: PortraitMetaV2 | null) {
  const [measured, setMeasured] = useState<{ src: string; roots: Roots } | null>(null);
  useEffect(() => {
    if (!src || !meta) return;
    let active = true;
    measureRoots(src, meta).then((roots) => {
      if (active && roots) setMeasured({ src, roots });
    });
    return () => { active = false; };
  }, [src, meta]);
  return measured?.src === src ? measured.roots : null;
}

/** Both halves of the field. Each is scaled about its outer rail and the top
 * of the window so its hot node lands on the matching shoulder root, then the
 * halves cross-fade at the center (a hard cut showed as a thin vertical line
 * above the head). Without roots: the authored B3 layout. */
function FieldHalves({ id, file, roots, filter }: { id: string; file: string; roots: Roots | null; filter?: string }) {
  return <>
    <defs>
      <linearGradient id={`half-l-${id}`} gradientUnits="userSpaceOnUse" x1="440" y1="0" x2="560" y2="0"><stop stopColor="white" /><stop offset="1" stopColor="black" /></linearGradient>
      <linearGradient id={`half-r-${id}`} gradientUnits="userSpaceOnUse" x1="440" y1="0" x2="560" y2="0"><stop stopColor="black" /><stop offset="1" stopColor="white" /></linearGradient>
      <mask id={`left-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1500"><rect width="1000" height="1500" fill={`url(#half-l-${id})`} /></mask>
      <mask id={`right-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1500"><rect width="1000" height="1500" fill={`url(#half-r-${id})`} /></mask>
    </defs>
    {([-1, 1] as const).map((side) => {
      const node = side < 0 ? NODES.left : NODES.right;
      const root = side < 0 ? roots?.left : roots?.right;
      const rail = side < 0 ? 70 : 930;
      const sx = root ? Math.max(0.7, Math.min(1.45, (root.x - rail) / (node.x - rail))) : 1;
      const sy = root ? Math.max(0.8, Math.min(1.25, (root.y - 70) / (node.y - 70))) : 1;
      return (
        <g key={side} mask={`url(#${side < 0 ? "left" : "right"}-${id})`}>
          <image href={file} width="1000" height="1500" preserveAspectRatio="none" filter={filter}
            transform={`matrix(${sx} 0 0 ${sy} ${rail * (1 - sx)} ${70 * (1 - sy)})`} />
        </g>
      );
    })}
  </>;
}

/** The cutout's box in card units (the same placement as cutoutCss). */
function cutoutBox(meta: PortraitMetaV2) {
  return { x: meta.tx * 1000, y: meta.ty * 1500, width: meta.srcW * meta.scale * 1500, height: meta.srcH * meta.scale * 1500 };
}

/** The level's authored energy field, attached to the player's shoulders:
 * behind the jersey number, and again (fringe) for the outer currents above
 * the name scrim. */
export function FoilField({ finish, src, meta, fringe = false }: {
  finish: Finish;
  src: string | null;
  meta: PortraitMetaV2 | null;
  fringe?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const roots = useShoulderRoots(src, meta);
  // The fringe sits above the cutout; keep it off the visible body (a broad
  // player's arms reach the card edge), so energy never crosses the player.
  const body = fringe && src && meta ? { src, box: cutoutBox(meta) } : null;
  return <svg aria-hidden data-layer="foil-field" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 1500" style={fringe ? { mixBlendMode: "screen" } : undefined}>
    <defs>
      <clipPath id={`field-${id}`}><path d={FRAME_WINDOW} /></clipPath>
      <linearGradient id={`fringe-fade-${id}`}><stop stopColor="white" /><stop offset=".09" stopColor="white" /><stop offset=".18" stopColor="black" /><stop offset=".82" stopColor="black" /><stop offset=".91" stopColor="white" /><stop offset="1" stopColor="white" /></linearGradient>
      {/* The fringe fades in and out vertically too — a hard-edged band left
          a visible seam across the card at shoulder height. */}
      <linearGradient id={`fringe-vfade-${id}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="black" /><stop offset=".3" stopColor="white" /><stop offset=".8" stopColor="white" /><stop offset="1" stopColor="black" /></linearGradient>
      <mask id={`fringe-${id}`}><rect y="760" width="1000" height="440" fill={`url(#fringe-fade-${id})`} /></mask>
      <mask id={`fringe-v-${id}`}><rect y="760" width="1000" height="440" fill={`url(#fringe-vfade-${id})`} /></mask>
      {body && <>
        <filter id={`body-${id}`} filterUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1500"><feFlood floodColor="black" /><feComposite in2="SourceAlpha" operator="in" /></filter>
        {/* The body as the card shows it: faded out towards the name, clipped to the portrait zone. */}
        <linearGradient id={`torso-${id}`} gradientUnits="userSpaceOnUse" x1="0" y1={PORTRAIT.fadeStartY} x2="0" y2={PORTRAIT.bottomY}><stop stopColor="white" /><stop offset="1" stopColor="white" stopOpacity="0" /></linearGradient>
        <mask id={`torso-${id}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1500"><rect x={PORTRAIT.zone.x} width={PORTRAIT.zone.w} height="1500" fill={`url(#torso-${id})`} /></mask>
        <mask id={`off-body-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1500">
          <rect width="1000" height="1500" fill="white" />
          <g mask={`url(#torso-${id}-mask)`}><image href={body.src} {...body.box} preserveAspectRatio="none" filter={`url(#body-${id})`} /></g>
        </mask>
      </>}
    </defs>
    <g clipPath={`url(#field-${id})`} mask={fringe ? `url(#fringe-${id})` : undefined} style={fringe ? { mixBlendMode: "screen", opacity: .8 } : undefined}>
      <g mask={fringe ? `url(#fringe-v-${id})` : undefined}>
        <g mask={body ? `url(#off-body-${id})` : undefined}>
          <FieldHalves id={id} file={finishAssets(finish.key).field.file} roots={roots} />
        </g>
      </g>
    </g>
  </svg>;
}

/**
 * The energy coming out of the player (owner review, 2026-09-26: it had read
 * as outlining him). Drawn under the cutout, so the body hides everything on
 * or inside the silhouette:
 * - the field's currents nearest the body run hotter;
 * - where the energy meets each shoulder, the edge runs white-hot, fading away
 *   from the root, so the head is never outlined;
 * - a white-hot glow at each root.
 * Scaled by the level's energy strength (quieter on the lower levels).
 */
export function EnergyEmission({ finish, src, meta }: { finish: Finish; src: string; meta: PortraitMetaV2 }) {
  const id = useId().replace(/:/g, "");
  const roots = useShoulderRoots(src, meta);
  const energy = finish.palette.energy;
  if (!roots || energy.strength <= 0) return null;
  const box = cutoutBox(meta);
  const rootY = (roots.left.y + roots.right.y) / 2;
  const [hot, glowMid, glowEdge] = energy.glow;
  return <svg aria-hidden data-layer="energy-emission" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 1500"
    style={{ mixBlendMode: "screen", ...(energy.strength < 1 ? { opacity: energy.strength } : {}) }}>
    <defs>
      <clipPath id={`field-${id}`}><path d={FRAME_WINDOW} /></clipPath>
      {/* Nearness to the body, from the cutout's own alpha: bright at the
          silhouette edge, gone ~90 units out. */}
      <filter id={`near-${id}`} filterUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1500" colorInterpolationFilters="sRGB">
        <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="grown" />
        <feGaussianBlur in="grown" stdDeviation="12" result="tight" />
        <feGaussianBlur in="grown" stdDeviation="36" result="wide" />
        <feMerge result="both"><feMergeNode in="wide" /><feMergeNode in="tight" /></feMerge>
        <feComposite in="both" in2="SourceAlpha" operator="out" result="outside" />
        <feComponentTransfer in="outside" result="near"><feFuncA type="linear" slope="1.5" /></feComponentTransfer>
        <feFlood floodColor="white" />
        <feComposite in2="near" operator="in" />
      </filter>
      <mask id={`near-mask-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1500">
        <image href={src} {...box} preserveAspectRatio="none" filter={`url(#near-${id})`} />
      </mask>
      {/* Strongest on the shoulders, faint around the head, gone by the name. */}
      <linearGradient id={`band-${id}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="1500">
        <stop offset={(rootY - 330) / 1500} stopColor="white" stopOpacity=".15" />
        <stop offset={(rootY - 70) / 1500} stopColor="white" />
        <stop offset={(rootY + 120) / 1500} stopColor="white" />
        <stop offset={(rootY + 280) / 1500} stopColor="white" stopOpacity="0" />
      </linearGradient>
      <mask id={`band-mask-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1500"><rect width="1000" height="1500" fill={`url(#band-${id})`} /></mask>
      {/* Only the currents run hotter; the dark field between them stays dark,
          so this never becomes a uniform halo. */}
      <filter id={`hot-${id}`} colorInterpolationFilters="sRGB">
        <feComponentTransfer>
          <feFuncR type="linear" slope="2.2" intercept="-.3" />
          <feFuncG type="linear" slope="2.2" intercept="-.3" />
          <feFuncB type="linear" slope="2.2" intercept="-.3" />
        </feComponentTransfer>
      </filter>
      <filter id={`contact-${id}`} filterUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1500" colorInterpolationFilters="sRGB">
        <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="grown" />
        <feComposite in="grown" in2="SourceAlpha" operator="out" result="ring" />
        <feGaussianBlur in="ring" stdDeviation="1.2" result="core" />
        <feGaussianBlur in="ring" stdDeviation="8" result="bloom" />
        <feFlood floodColor={energy.contact} /><feComposite in2="bloom" operator="in" result="cyan" />
        <feFlood floodColor={hot} /><feComposite in2="core" operator="in" result="white" />
        <feMerge><feMergeNode in="cyan" /><feMergeNode in="cyan" /><feMergeNode in="white" /></feMerge>
      </filter>
      <radialGradient id={`reach-${id}`}><stop stopColor="white" /><stop offset=".35" stopColor="white" stopOpacity=".7" /><stop offset="1" stopColor="white" stopOpacity="0" /></radialGradient>
      <mask id={`contact-mask-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1500">
        {[roots.left, roots.right].map((root, i) => <circle key={i} cx={root.x} cy={root.y} r="190" fill={`url(#reach-${id})`} />)}
      </mask>
      <radialGradient id={`root-glow-${id}`}><stop stopColor={hot} stopOpacity=".95" /><stop offset=".3" stopColor={glowMid} stopOpacity=".6" /><stop offset="1" stopColor={glowEdge} stopOpacity="0" /></radialGradient>
    </defs>
    <g clipPath={`url(#field-${id})`}>
      <g mask={`url(#band-mask-${id})`}>
        <g mask={`url(#near-mask-${id})`}><FieldHalves id={id} file={finishAssets(finish.key).field.file} roots={roots} filter={`url(#hot-${id})`} /></g>
      </g>
      <image href={src} {...box} preserveAspectRatio="none" filter={`url(#contact-${id})`} mask={`url(#contact-mask-${id})`} />
      {[roots.left, roots.right].map((root, i) => <circle key={i} cx={root.x} cy={root.y} r="44" fill={`url(#root-glow-${id})`} />)}
    </g>
  </svg>;
}
