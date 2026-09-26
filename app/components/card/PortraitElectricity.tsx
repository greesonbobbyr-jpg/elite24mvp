"use client";

import { useEffect, useId, useState } from "react";
import type { PortraitMetaV2 } from "@/lib/portrait/normalize";

/** Trace the uploaded alpha rather than assuming a shoulder shape. The paths
 * are deterministic, so a frozen card and every render size share one effect. */
export function PortraitElectricity({ src, meta, style }: {
  src: string;
  meta: PortraitMetaV2;
  style: React.CSSProperties;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [traces, setTraces] = useState<{ src: string; rim: string; arcs: string; shards: string } | null>(null);
  useEffect(() => {
    let active = true;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (!active) return;
      try {
        const canvas = document.createElement("canvas");
        const scale = 512 / image.naturalWidth;
        canvas.width = 512;
        canvas.height = Math.round(image.naturalHeight * scale);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const start = Math.max(0, Math.floor(meta.headTopY * scale));
        const end = Math.min(canvas.height - 1, Math.ceil((meta.shoulderY + meta.faceBox.h * 1.7) * scale));
        let rim = "", arcs = "", shards = "";
        const point = (x: number, y: number) => `${(x / scale).toFixed(2)},${(y / scale).toFixed(2)}`;
        for (const side of [-1, 1]) {
          let started = false;
          let row = 0;
          for (let y = start; y < end; y += 2, row++) {
            let x = side < 0 ? 0 : canvas.width - 1;
            while (x >= 0 && x < canvas.width && data[(y * canvas.width + x) * 4 + 3] < 110) x -= side;
            if (x < 0 || x >= canvas.width) { started = false; continue; }
            const edge = x + side * (.65 + .9 * Math.sin(row * 1.8));
            rim += `${started ? "L" : "M"}${point(edge, y)} `;
            started = true;
            // Small asymmetric branches rise away from the actual silhouette.
            // Hair has fewer sparks; shoulders carry the strongest energy.
            if (row % 5 !== (side < 0 ? 1 : 3) || y < meta.eyeY * scale) continue;
            const strength = .5 + .5 * Math.sin(row * 2.37 + side);
            const length = 3 + strength * 10;
            const tipX = edge + side * length;
            const tipY = y - length * (1.1 + strength);
            shards += `M${point(edge, y + 3)} L${point(edge + side * length * .25, y - 2)} L${point(tipX, tipY)} L${point(edge + side * length * .35, y - length * .6)} Z `;
            if (strength > .4) shards += `M${point(tipX + side * 3, tipY - 5)} l${side * 1.4 / scale},${-3 / scale} l${side * .8 / scale},${3 / scale} l${-side * 1.4 / scale},${3 / scale} Z `;
            arcs += `M${point(edge, y)} C${point(edge + side * length * .15, y - length * .8)} ${point(edge + side * length * 1.4, y - length * .6)} ${point(tipX, tipY)} `;
          }
        }
        if (active) setTraces({ src, rim, arcs, shards });
      } catch { /* Cross-origin images still receive the SVG alpha rim. */ }
    };
    image.src = src;
    return () => { active = false; };
  }, [src, meta.srcH, meta.headTopY, meta.eyeY, meta.shoulderY, meta.faceBox.h, meta.faceBox.w, meta.faceBox.y]);

  if (!traces || traces.src !== src) return null;
  const w = meta.srcW, h = meta.srcH;
  return <svg aria-hidden data-electric-arcs className="pointer-events-none absolute" style={{ ...style, aspectRatio: `${w}/${h}`, height: "auto", mixBlendMode: "screen", opacity: .45 }} viewBox={`0 0 ${w} ${h}`} overflow="visible">
    <defs>
      <filter id={`catches-${id}`} x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".055 .12" numOctaves="1" seed="31" /><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  8 0 0 0 -3.4" result="fleck" /><feComposite in="SourceGraphic" in2="fleck" operator="in" /></filter>
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
      <g stroke="#009cff" strokeWidth={w * .008} filter={`url(#energy-${id})`}><path d={traces.rim} /><path d={traces.arcs} /></g>
      <path d={traces.shards} fill="#d1f6ff" opacity=".8" />
      <path d={traces.shards} fill="#149dff" opacity=".85" filter={`url(#energy-${id})`} />
      <path d={traces.rim} stroke="#e1fbff" strokeWidth={w * .0012} />
      <path d={traces.rim} stroke="#ffffff" strokeWidth={w * .004} filter={`url(#catches-${id})`} />
      <path d={traces.arcs} stroke="#b6f1ff" strokeWidth={w * .0008} />
    </g>
  </svg>;
}
