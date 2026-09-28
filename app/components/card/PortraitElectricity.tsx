"use client";

import { useEffect, useId, useState } from "react";
import type { Finish } from "@/lib/cardTheme";
import type { PortraitMetaV2 } from "@/lib/portrait/normalize";

type Traces = { arcs: string; shards: string };

/** The spark paths traced from a cutout's alpha, once per cutout for the
 * session (in flight too), so a row of small cards or a reopened branch
 * reuses them. */
const tracesByCutout = new Map<string, Promise<Traces | null>>();

function traceSparks(src: string, meta: PortraitMetaV2): Promise<Traces | null> {
  const key = `${src}\n${meta.shoulderY}\n${meta.faceBox.h}`;
  let traces = tracesByCutout.get(key);
  if (!traces) {
    traces = new Promise((resolve) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const scale = 512 / image.naturalWidth;
          canvas.width = 512;
          canvas.height = Math.round(image.naturalHeight * scale);
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return resolve(null);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const start = Math.max(0, Math.floor((meta.shoulderY - meta.faceBox.h * .2) * scale));
          const end = Math.min(canvas.height - 1, Math.ceil((meta.shoulderY + meta.faceBox.h * 1.7) * scale));
          let arcs = "", shards = "";
          const point = (x: number, y: number) => `${(x / scale).toFixed(2)},${(y / scale).toFixed(2)}`;
          for (const side of [-1, 1]) {
            let row = 0;
            for (let y = start; y < end; y += 2, row++) {
              let x = side < 0 ? 0 : canvas.width - 1;
              while (x >= 0 && x < canvas.width && data[(y * canvas.width + x) * 4 + 3] < 110) x -= side;
              if (x < 0 || x >= canvas.width) continue;
              const edge = x + side * (.65 + .9 * Math.sin(row * 1.8));
              // Small asymmetric branches rise away from the actual silhouette.
              if (row % 5 !== (side < 0 ? 1 : 3)) continue;
              const strength = .5 + .5 * Math.sin(row * 2.37 + side);
              const length = 3 + strength * 10;
              const tipX = edge + side * length;
              const tipY = y - length * (1.1 + strength);
              shards += `M${point(edge, y + 3)} L${point(edge + side * length * .25, y - 2)} L${point(tipX, tipY)} L${point(edge + side * length * .35, y - length * .6)} Z `;
              if (strength > .4) shards += `M${point(tipX + side * 3, tipY - 5)} l${side * 1.4 / scale},${-3 / scale} l${side * .8 / scale},${3 / scale} l${-side * 1.4 / scale},${3 / scale} Z `;
              arcs += `M${point(edge, y)} C${point(edge + side * length * .15, y - length * .8)} ${point(edge + side * length * 1.4, y - length * .6)} ${point(tipX, tipY)} `;
            }
          }
          resolve({ arcs, shards });
        } catch {
          resolve(null); // Cross-origin images still receive the SVG alpha rim.
        }
      };
      image.onerror = () => {
        tracesByCutout.delete(key); // a photo that failed to load may load next time
        resolve(null);
      };
      image.src = src;
    });
    tracesByCutout.set(key, traces);
  }
  return traces;
}

/** Sparks leaving the shoulders, traced from the uploaded alpha rather than an
 * assumed shoulder shape. Shoulders only: a traced line around the whole
 * silhouette read as an outline, not energy coming from the player (owner
 * review, 2026-09-26). The paths are deterministic, so a frozen card and every
 * render size share one effect. */
export function PortraitElectricity({ src, meta, finish, style }: {
  src: string;
  meta: PortraitMetaV2;
  finish: Finish;
  style: React.CSSProperties;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [traces, setTraces] = useState<({ src: string } & Traces) | null>(null);
  useEffect(() => {
    let active = true;
    traceSparks(src, meta).then((traced) => {
      if (active && traced) setTraces({ src, ...traced });
    });
    return () => { active = false; };
  }, [src, meta]);

  const { strength, sparks } = finish.palette.energy;
  if (!traces || traces.src !== src || strength <= 0) return null;
  const w = meta.srcW, h = meta.srcH;
  const [glow, shard, shardGlow, arc] = sparks;
  return <svg aria-hidden data-electric-arcs className="pointer-events-none absolute" style={{ ...style, aspectRatio: `${w}/${h}`, height: "auto", mixBlendMode: "screen", opacity: .45 * strength }} viewBox={`0 0 ${w} ${h}`} overflow="visible">
    <defs>
      <filter id={`energy-${id}`} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation={w * .004} result="wide" />
        <feGaussianBlur in="SourceGraphic" stdDeviation={w * .0012} result="tight" />
        <feMerge><feMergeNode in="wide" /><feMergeNode in="tight" /></feMerge>
      </filter>
      <linearGradient id={`power-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="white" stopOpacity=".2" /><stop offset=".3" stopColor="white" stopOpacity=".5" /><stop offset=".45" stopColor="white" /><stop offset="1" stopColor="white" stopOpacity=".15" />
      </linearGradient>
      <mask id={`energy-mask-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width={w} height={h}>
        <rect width={w} height={h} fill={`url(#power-${id})`} />
      </mask>
    </defs>
    <g mask={`url(#energy-mask-${id})`} fill="none" strokeLinejoin="round" strokeLinecap="round">
      <path d={traces.arcs} stroke={glow} strokeWidth={w * .008} filter={`url(#energy-${id})`} />
      <path d={traces.shards} fill={shard} opacity=".8" />
      <path d={traces.shards} fill={shardGlow} opacity=".85" filter={`url(#energy-${id})`} />
      <path d={traces.arcs} stroke={arc} strokeWidth={w * .0008} />
    </g>
  </svg>;
}
