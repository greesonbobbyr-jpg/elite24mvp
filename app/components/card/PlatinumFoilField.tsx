"use client";
import { useEffect, useId, useState } from "react";
import type { PortraitMetaV2 } from "@/lib/portrait/normalize";
import { foilRoots } from "@/lib/portrait/foil";
import { FRAME_WINDOW } from "@/lib/cardGeometry";

type Roots = { src: string; left: number; right: number; y: number };
/** Warp each authored current to the uploaded silhouette, keeping the outer rails fixed. */
export function PlatinumFoilField({ src, meta, fringe = false }: { src: string | null; meta: PortraitMetaV2 | null; fringe?: boolean }) {
  const id = useId().replace(/:/g, "");
  const [roots, setRoots] = useState<Roots | null>(null);
  useEffect(() => {
    if (!src || !meta) return;
    let active = true;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const scale = 512 / image.naturalWidth;
        canvas.width = 512;
        canvas.height = Math.round(image.naturalHeight * scale);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const measured = foilRoots(pixels, canvas.width, canvas.height, meta);
        if (active && measured) setRoots({ src, ...measured });
      } catch { /* Unreadable external alpha retains the normalized background. */ }
    };
    image.src = src;
    return () => { active = false; };
  }, [src, meta]);
  const current = roots?.src === src ? roots : null;
  const rootY = current?.y ?? 830;
  const sy = Math.max(.75, Math.min(1.25, (rootY - 70) / (800 - 70)));
  return <svg aria-hidden data-layer="platinum-foil-field" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 1500" style={fringe ? { mixBlendMode: "screen" } : undefined}>
    <defs>
      <linearGradient id={`fringe-fade-${id}`}><stop stopColor="white"/><stop offset=".09" stopColor="white"/><stop offset=".18" stopColor="black"/><stop offset=".82" stopColor="black"/><stop offset=".91" stopColor="white"/><stop offset="1" stopColor="white"/></linearGradient>
      <mask id={`fringe-${id}`}><rect y="850" width="1000" height="330" fill={`url(#fringe-fade-${id})`} /></mask>
      <clipPath id={`field-${id}`}><path d={FRAME_WINDOW} /></clipPath>
      <clipPath id={`left-${id}`}><rect width="500" height="1500" /></clipPath>
      <clipPath id={`right-${id}`}><rect x="500" width="500" height="1500" /></clipPath>
    </defs>
    <g clipPath={`url(#field-${id})`} mask={fringe ? `url(#fringe-${id})` : undefined} style={fringe ? { mixBlendMode: "screen", opacity: .8 } : undefined}>
      {([-1, 1] as const).map(side => {
        const rail = side < 0 ? 70 : 930;
        const sourceRoot = side < 0 ? 280 : 720;
        const targetRoot = side < 0 ? current?.left ?? 280 : current?.right ?? 720;
        const sx = Math.max(.65, Math.min(1.6, (targetRoot - rail) / (sourceRoot - rail)));
        return <g key={side} clipPath={`url(#${side < 0 ? "left" : "right"}-${id})`}>
          <image href="/card/finishes/platinum/b3-foil-field.png" width="1000" height="1500" preserveAspectRatio="none" transform={`matrix(${sx} 0 0 ${sy} ${rail * (1-sx)} ${70 * (1-sy)})`} />
        </g>;
      })}
    </g>
  </svg>;
}


