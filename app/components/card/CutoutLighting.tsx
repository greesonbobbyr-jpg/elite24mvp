"use client";

import { useId } from "react";
import type { Finish } from "@/lib/cardTheme";
import type { PortraitMetaV2 } from "@/lib/portrait/normalize";

// LAYERS 6 + §23 DEPTH SEPARATION — the masked duplicate-cutout technique.
// Both effects re-render the cutout through SVG filters driven by its ALPHA:
//   • DepthShadow (behind the athlete, above the giant number): a soft dark
//     dilation of the silhouette so the face/edges never melt into the number.
//   • RimLight (above the athlete): a tight finish-colored edge glow OUTSIDE
//     the silhouette, weighted by a vertical gradient AND the stored face box
//     so shoulders/hair catch light while the face stays natural — never a
//     uniform neon outline, never tinted skin (the composite-out keeps every
//     lit pixel off the body itself).

export function DepthShadow({
  src,
  meta,
  style,
}: {
  src: string;
  meta: Pick<PortraitMetaV2, "srcW" | "srcH">;
  style: React.CSSProperties;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { srcW, srcH } = meta;
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute"
      style={style}
      viewBox={`0 0 ${srcW} ${srcH}`}
      overflow="visible"
    >
      <defs>
        <filter id={`ds-${id}`} x="-15%" y="-15%" width="130%" height="130%">
          <feMorphology in="SourceAlpha" operator="dilate" radius={srcW * 0.012} result="dil" />
          <feGaussianBlur in="dil" stdDeviation={srcW * 0.02} result="soft" />
          <feFlood floodColor="rgba(0,0,0,0.62)" result="ink" />
          <feComposite in="ink" in2="soft" operator="in" />
        </filter>
      </defs>
      <image href={src} width={srcW} height={srcH} filter={`url(#ds-${id})`} />
    </svg>
  );
}

export function RimLight({
  src,
  meta,
  finish,
  style,
}: {
  src: string;
  meta: PortraitMetaV2;
  finish: Finish;
  style: React.CSSProperties;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { srcW, srcH, faceBox } = meta;
  const faceCx = faceBox.x + faceBox.w / 2;
  const faceCy = faceBox.y + faceBox.h * 0.45;
  const faceR = Math.max(faceBox.w, faceBox.h) * 0.85;
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute"
      style={{ ...style, mixBlendMode: "screen", opacity: 0.55 + 0.45 * finish.lightIntensity }}
      viewBox={`0 0 ${srcW} ${srcH}`}
      overflow="visible"
    >
      <defs>
        <filter id={`rim-${id}`} x="-15%" y="-15%" width="130%" height="130%">
          <feMorphology in="SourceAlpha" operator="dilate" radius={srcW * 0.006} result="dil" />
          <feGaussianBlur in="dil" stdDeviation={srcW * 0.008} result="soft" />
          {/* keep only the halo OUTSIDE the body — light never tints skin */}
          <feComposite in="soft" in2="SourceAlpha" operator="out" result="ring" />
          <feFlood floodColor={finish.lightHue} result="hue" />
          <feComposite in="hue" in2="ring" operator="in" />
        </filter>
        {/* vertical weight: faint at the crown, strongest at the shoulders */}
        <linearGradient id={`rimv-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
          <stop
            offset={`${((meta.eyeY / srcH) * 100).toFixed(1)}%`}
            stopColor="#fff"
            stopOpacity="0.3"
          />
          <stop
            offset={`${((meta.shoulderY / srcH) * 100).toFixed(1)}%`}
            stopColor="#fff"
            stopOpacity="1"
          />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.85" />
        </linearGradient>
        <mask id={`rimm-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width={srcW} height={srcH}>
          <rect x="0" y="0" width={srcW} height={srcH} fill={`url(#rimv-${id})`} />
          {/* face-box aware damping: the stored face region catches less */}
          <circle cx={faceCx} cy={faceCy} r={faceR} fill="#000" opacity="0.55" />
        </mask>
      </defs>
      <image
        href={src}
        width={srcW}
        height={srcH}
        filter={`url(#rim-${id})`}
        mask={`url(#rimm-${id})`}
      />
    </svg>
  );
}
