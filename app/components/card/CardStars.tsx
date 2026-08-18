"use client";

import { useId } from "react";
import type { Finish } from "@/lib/cardTheme";
import { u } from "@/lib/cardGeometry";

// PROSPECT STARS (§26–28): EARNED STARS ONLY — exactly `count` stars render;
// never hollow, dim, or locked placeholders. One shared SVG path, filled with
// the finish's metal gradient (FINISH material — never team color), centered
// group growing outward. Sized in master units (Full Card compositor) or px
// (compact/wide recompositions).

/** Classic 5-point star, unit viewBox 0..24. */
const STAR_PATH =
  "M12 1.8l3.09 6.26 6.91 1-5 4.88 1.18 6.88L12 17.57l-6.18 3.25L7 13.94l-5-4.88 6.91-1z";

export function CardStars({
  count,
  finish,
  sizePx,
  gapPx,
  sizeUnits,
  gapUnits,
}: {
  count: number;
  finish: Finish;
  /** px sizing (compact/wide recompositions). */
  sizePx?: number;
  gapPx?: number;
  /** master-unit sizing (the Full Card compositor). */
  sizeUnits?: number;
  gapUnits?: number;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const n = Math.max(1, Math.min(5, Math.round(count)));
  const size = sizeUnits != null ? u(sizeUnits) : `${sizePx ?? 12}px`;
  const gap = gapUnits != null ? u(gapUnits) : `${gapPx ?? 3}px`;
  const glow =
    sizeUnits != null ? u(sizeUnits * 0.35) : `${Math.round((sizePx ?? 12) * 0.35)}px`;
  const shadow = `drop-shadow(0 1px 2px rgba(0,0,0,0.6))${
    finish.foilIntensity > 0.4
      ? ` drop-shadow(0 0 ${glow} ${withA(finish.metalHighlight, 0.35 * finish.foilIntensity)})`
      : ""
  }`;
  return (
    <span
      aria-label={`${n} star prospect`}
      role="img"
      className="flex items-center justify-center"
      style={{ gap }}
    >
      {Array.from({ length: n }, (_, i) => (
        <svg
          key={i}
          width="1em"
          height="1em"
          viewBox="0 0 24 24"
          aria-hidden
          style={{ fontSize: size, display: "block", filter: shadow }}
        >
          {i === 0 && (
            <defs>
              <linearGradient id={`star-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={finish.starMaterial.from} />
                <stop offset="55%" stopColor={finish.starMaterial.from} />
                <stop offset="100%" stopColor={finish.starMaterial.to} />
              </linearGradient>
            </defs>
          )}
          <path
            d={STAR_PATH}
            fill={`url(#star-${id})`}
            stroke={withA(finish.metalShadow, 0.65)}
            strokeWidth="0.75"
          />
        </svg>
      ))}
    </span>
  );
}

function withA(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${a})`;
}
