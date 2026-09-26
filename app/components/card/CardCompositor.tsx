"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CARD_ASPECT, DEFAULT_WIDTH_PX, MASTER_W } from "@/lib/cardGeometry";

// THE COMPOSITOR ROOT (Plan v4 §4.5). One fixed-aspect stage on the 1000×1500
// master: every child positions itself in design units via `--u`
// (1 unit = width/1000), so art, typography and effects scale in lockstep and
// nothing ever reflows. `isolation: isolate` keeps blend layers inside the
// card. Tilt/light vars (--rx/--ry/--sx/--sy/--so) live here and are consumed by
// the live-effect layers; `staticRender` freezes them for regression shots.
//
// The stack must stay FLAT: every layer is a direct child of the stage — no
// wrapper with filter/clip-path/opacity between a blended layer and what it
// blends onto (each of those creates a stacking context and breaks blending).

export function CardCompositor({
  width = DEFAULT_WIDTH_PX,
  staticRender = false,
  children,
  className,
  style,
  ...rest
}: {
  /** Rendered width in CSS px (height follows CARD_ASPECT). */
  width?: number | string;
  /** Freeze tilt + light position (regression baselines / master render). */
  staticRender?: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "style" | "className" | "children">) {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef<number | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => {
      mq.removeEventListener?.("change", sync);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  const setVars = (rx: number, ry: number, sc: number, sx: number, sy: number, on: boolean) => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", `${rx}deg`);
    el.style.setProperty("--ry", `${ry}deg`);
    el.style.setProperty("--sc", `${sc}`);
    el.style.setProperty("--sx", `${sx}%`);
    el.style.setProperty("--sy", `${sy}%`);
    el.style.setProperty("--so", on ? "1" : "0");
  };

  const track = (clientX: number, clientY: number, zoom: number) => {
    if (reduced || staticRender) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (clientX - r.left) / r.width;
    const py = (clientY - r.top) / r.height;
    const MAX = 9;
    const ry = (px - 0.5) * 2 * MAX;
    const rx = -(py - 0.5) * 2 * MAX;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => setVars(rx, ry, zoom, px * 100, py * 100, true));
  };

  const rest_ = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    setVars(0, 0, 1, 50, 32, false);
  };

  // `--u`: master unit in CSS px. A numeric width gives an exact px unit (SSR
  // safe, no measurement); a string width (e.g. "100%") falls back to
  // container-query units so the card scales with its container.
  const unit =
    typeof width === "number" ? `${width / MASTER_W}px` : `calc(100cqw / ${MASTER_W})`;

  return (
    <div
      ref={ref}
      {...rest}
      onPointerMove={
        staticRender
          ? undefined
          : (e) => track(e.clientX, e.clientY, e.pointerType === "touch" ? 1.03 : 1)
      }
      onPointerLeave={staticRender ? undefined : rest_}
      onPointerUp={staticRender ? undefined : rest_}
      onPointerCancel={staticRender ? undefined : rest_}
      className={`pc-stage relative${staticRender ? " pc-static" : ""}${className ? ` ${className}` : ""}`}
      style={{
        width,
        aspectRatio: `${CARD_ASPECT}`,
        containerType: typeof width === "number" ? undefined : "inline-size",
        isolation: "isolate",
        touchAction: "pan-y",
        transformStyle: "preserve-3d",
        willChange: staticRender ? undefined : "transform",
        transition: staticRender ? undefined : "transform 220ms cubic-bezier(.2,.7,.2,1)",
        transform: staticRender
          ? undefined
          : "perspective(1200px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)) scale(var(--sc,1))",
        ...({
          "--u": unit,
          ...(staticRender ? { "--so": "0" } : {}),
        } as CSSProperties),
        ...style,
      }}
    >
      <style>{STAGE_STYLE}</style>
      {children}
    </div>
  );
}

// Namespaced keyframes + reduced-motion / static freezes; injected once per
// stage so globals.css stays untouched.
const STAGE_STYLE = `
@keyframes pc-drift { 0% { transform: translate3d(0,0,0); } 100% { transform: translate3d(calc(var(--u) * -20), calc(var(--u) * -30), 0); } }
@media (prefers-reduced-motion: reduce) { .pc-stage * { animation: none !important; } }
.pc-static, .pc-static * { animation-play-state: paused !important; }
`;

