"use client";

import { useEffect, useState } from "react";
import { zoneStyle, LOGO_ZONE, TOP_RIGHT_SLOT, type Zone } from "@/lib/cardGeometry";

// LAYER 12 — TEAM LOGO, top-left safe zone (owner ruling) with LOGO
// NORMALIZATION (Δ9): contain-fit inside the locked zone, aspect always
// preserved (circular/square/wide/tall all work). For data:/same-origin
// sources an alpha-trim pass measures excessive transparent canvas so padded
// logos don't render tiny; cross-origin URLs can't be pixel-read (CORS) and
// get plain contain — documented limitation. Subtle luminosity backing, no
// white boxes, never focal (§7).

/** Measured content scale factors, cached per logo URL for the session. */
const trimCache = new Map<string, number>();

function canInspect(src: string): boolean {
  return src.startsWith("data:") || (src.startsWith("/") && !src.startsWith("//"));
}

/** How much of the image box the actual (non-transparent) art occupies (0–1). */
function measureContent(src: string): Promise<number> {
  const cached = trimCache.get(src);
  if (cached != null) return Promise.resolve(cached);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const dim = 64; // coarse is plenty for a trim factor
        const canvas = document.createElement("canvas");
        canvas.width = dim;
        canvas.height = dim;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, dim, dim);
        const { data } = ctx.getImageData(0, 0, dim, dim);
        let top = dim,
          left = dim,
          right = -1,
          bottom = -1;
        for (let y = 0; y < dim; y++) {
          for (let x = 0; x < dim; x++) {
            if (data[(y * dim + x) * 4 + 3] > 16) {
              if (y < top) top = y;
              if (y > bottom) bottom = y;
              if (x < left) left = x;
              if (x > right) right = x;
            }
          }
        }
        const frac =
          right < 0 ? 1 : Math.max((right - left + 1) / dim, (bottom - top + 1) / dim);
        const factor = frac > 0.1 ? 1 / frac : 1;
        trimCache.set(src, factor);
        resolve(factor);
      } catch {
        resolve(1); // tainted canvas or decode issue → plain contain
      }
    };
    img.onerror = () => resolve(1);
    img.src = src;
  });
}

export function TeamLogoBadge({ logoUrl }: { logoUrl: string | null | undefined }) {
  // Keyed by URL so a logo change resets to 1 without a synchronous set.
  const [measured, setMeasured] = useState<{ url: string; scale: number } | null>(null);
  const scale = measured && measured.url === logoUrl ? measured.scale : 1;

  useEffect(() => {
    let live = true;
    if (logoUrl && canInspect(logoUrl)) {
      void measureContent(logoUrl).then((f) => {
        // Cap the boost — a tiny mark in a huge canvas still shouldn't bloat.
        if (live) setMeasured({ url: logoUrl, scale: Math.min(f, 1.6) });
      });
    }
    return () => {
      live = false;
    };
  }, [logoUrl]);

  if (!logoUrl) return null;
  return (
    <div
      className="pointer-events-none absolute flex items-center justify-center"
      style={zoneStyle(LOGO_ZONE)}
    >
      {/* subtle luminosity backing so dark logos read on the dark card */}
      <span
        aria-hidden
        className="absolute inset-[-18%] rounded-full"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 50%, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0) 70%)",
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt=""
        className="relative h-full w-full object-contain"
        style={{
          transform: `scale(${scale})`,
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.55))",
        }}
      />
    </div>
  );
}

/**
 * LAYER 12b — TOP-RIGHT SLOT (Δ10): intentionally EMPTY. Architecturally a
 * configurable slot; renders nothing until a future feature earns the space.
 * No Player ID, no invented filler (§8).
 */
export function TopRightSlot({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  const style = zoneStyle(TOP_RIGHT_SLOT satisfies Zone);
  return (
    <div className="pointer-events-none absolute" style={style}>
      {children}
    </div>
  );
}
