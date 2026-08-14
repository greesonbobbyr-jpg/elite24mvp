"use client";

import type { Finish } from "@/lib/cardTheme";
import { CLIP_OUTER, CLIP_FACE, CLIP_BEVEL } from "./chrome";

// LAYER 1 + LAYER 13a — the chamfered metal FRAME and its foil response.
// The full outer silhouette is painted in the finish's conic metal; the card
// face stacks above it (clipped to CLIP_FACE), so the visible metal is the
// ring between the two clip paths. Bevels come from edge-hugging gradients;
// the spectral foil highlight FOLLOWS the tilt vars --sx/--sy so light moves
// physically across the metal. The face area is covered by the card body, so
// frame foil can never touch the athlete (Δ13).

function conic(colors: string[]): string {
  return `conic-gradient(from 128deg at 50% 46%, ${colors.join(", ")}, ${colors[0]})`;
}

export function CardFrame({ finish }: { finish: Finish }) {
  return (
    <>
      {/* the metal itself (full silhouette; face body covers the center) */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ clipPath: CLIP_OUTER, background: conic(finish.metal) }}
      />
      {/* frame foil — spectral sweep on the metal, pointer-tracked (Δ13) */}
      {finish.foilIntensity > 0.01 && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            clipPath: CLIP_OUTER,
            mixBlendMode: "color-dodge",
            opacity: 0.45 * finish.foilIntensity,
            background: `radial-gradient(130% 95% at var(--sx,50%) var(--sy,32%), ${spectralStops(
              finish.spectral,
            )} 80%, transparent 100%)`,
          }}
        />
      )}
      {/* metal shading: broad top light / bottom shadow across the ring */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          clipPath: CLIP_OUTER,
          background:
            "linear-gradient(178deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 18%, rgba(0,0,0,0) 78%, rgba(0,0,0,0.4) 100%)",
        }}
      />
    </>
  );
}

/** Bevel edge treatment rendered ABOVE the card face, hugging its edge. */
export function FaceBevel({ finish }: { finish: Finish }) {
  return (
    <>
      {/* top-light + bottom-shadow just inside the face edge */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          clipPath: CLIP_FACE,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 2.6%), linear-gradient(0deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 3%)",
        }}
      />
      {/* crisp highlight line at the bevel */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          clipPath: CLIP_BEVEL,
          outline: `1px solid ${withA(finish.metalHighlight, 0.22)}`,
          outlineOffset: "-1px",
        }}
      />
    </>
  );
}

function spectralStops(colors: string[]): string {
  const n = colors.length;
  return colors
    .map((c, i) => `${withA(c, 0.9)} ${((i / n) * 72).toFixed(0)}%`)
    .join(", ");
}

function withA(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${a})`;
}
