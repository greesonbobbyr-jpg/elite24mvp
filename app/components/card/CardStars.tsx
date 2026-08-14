"use client";

import { useId } from "react";
import type { Finish } from "@/lib/cardTheme";

// PROSPECT STARS (§26–28): EARNED STARS ONLY — exactly `count` stars render;
// never hollow, dim, or locked placeholders. One shared SVG path, filled with
// the finish's metal gradient, centered group growing outward.

/** Classic 5-point star, unit viewBox 0..24. */
const STAR_PATH =
  "M12 1.8l3.09 6.26 6.91 1-5 4.88 1.18 6.88L12 17.57l-6.18 3.25L7 13.94l-5-4.88 6.91-1z";

export function CardStars({
  count,
  finish,
  sizePx,
  gapPx,
}: {
  count: number;
  finish: Finish;
  sizePx: number;
  gapPx: number;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const n = Math.max(1, Math.min(5, Math.round(count)));
  return (
    <span
      aria-label={`${n} star prospect`}
      role="img"
      className="flex items-center justify-center"
      style={{ gap: gapPx }}
    >
      {Array.from({ length: n }, (_, i) => (
        <svg
          key={i}
          width={sizePx}
          height={sizePx}
          viewBox="0 0 24 24"
          aria-hidden
          style={{
            filter: `drop-shadow(0 1px 2px rgba(0,0,0,0.6))${
              finish.foilIntensity > 0.4
                ? ` drop-shadow(0 0 ${Math.round(sizePx * 0.35)}px ${withA(
                    finish.metalHighlight,
                    0.35 * finish.foilIntensity,
                  )})`
                : ""
            }`,
          }}
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
