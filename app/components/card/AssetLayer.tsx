"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { AssetSpec } from "@/lib/cardAssets";

// ONE static-art layer of the compositor: a full-canvas authored image at
// inset:0. If the file is missing (404 / decode failure) the layer renders the
// explicit ASSET MISSING development state — a labeled, obviously-unfinished
// slot — and NOTHING else. No CSS/SVG/gradient stand-in is ever drawn here;
// missing artwork is an asset-production problem (Plan v4 §4.6).

export function AssetLayer({
  spec,
  style,
  blend,
  opacity,
  onMissing,
}: {
  spec: AssetSpec;
  style?: CSSProperties;
  blend?: CSSProperties["mixBlendMode"];
  opacity?: number | string;
  onMissing?: (spec: AssetSpec) => void;
}) {
  const [missing, setMissing] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // A 404 can fire before hydration (SSR'd <img>), so onError alone is not
  // enough — re-check the decoded state once mounted.
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) {
      setMissing(true);
      onMissing?.(spec);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.file]);

  if (missing) return <MissingAsset spec={spec} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={spec.file}
      alt=""
      aria-hidden
      draggable={false}
      data-layer={spec.file}
      className="pointer-events-none absolute inset-0 h-full w-full select-none"
      style={{ mixBlendMode: blend, opacity, ...style }}
      onError={() => {
        setMissing(true);
        onMissing?.(spec);
      }}
    />
  );
}

/**
 * The ASSET MISSING development state. Deliberately reads as an unfinished
 * engineering slot (dashed outline + label) so nobody mistakes it for the card.
 */
export function MissingAsset({ spec }: { spec: AssetSpec }) {
  return (
    <div
      aria-hidden
      data-layer={spec.file}
      data-missing="1"
      className="pointer-events-none absolute inset-0 flex items-start justify-center"
      style={{ padding: "calc(var(--u) * 24)" }}
    >
      <div
        className="rounded-sm border border-dashed border-amber-400/70 bg-amber-400/5 text-center font-mono text-amber-300"
        style={{
          fontSize: "calc(var(--u) * 20)",
          lineHeight: 1.35,
          padding: "calc(var(--u) * 10) calc(var(--u) * 16)",
          // Stack labels down the card so several missing layers stay readable.
          marginTop: `calc(var(--u) * ${(16 - spec.layer) * 62 + (spec.kind === "mask" ? 0 : 31)})`,
        }}
      >
        <span className="font-bold">ASSET MISSING</span>
        <br />
        {spec.file.replace(/^\/card\//, "")}
        <br />
        <span className="opacity-70">layer {spec.layer} · 2000×3000</span>
      </div>
    </div>
  );
}
