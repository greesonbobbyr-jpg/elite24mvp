"use client";

import { useState } from "react";
import {
  processPortrait,
  type PortraitDebug as DebugCapture,
  type PortraitPhase,
} from "@/lib/portrait/process";
import { cutoutCss } from "@/lib/portrait/normalize";
import { CARD_ASPECT, PORTRAIT } from "@/lib/cardGeometry";

// PORTRAIT DEBUG VIEW (Δ6, dev-only): runs the full pipeline on a locally
// chosen file (nothing is saved) and shows every stage — ORIGINAL →
// BACKGROUND REMOVED → LANDMARK ANALYSIS → NORMALIZED CUTOUT — with
// toggleable overlays for face bounds, eye line, shoulder estimate, and the
// portrait safe zone, plus the computed scale/tx/ty. Purpose: instantly
// attribute a bad result to segmentation vs landmarks vs normalization vs
// geometry. (FINAL CARD joins the row when the Stage-5 card lands.)

const CHECKER =
  "repeating-conic-gradient(#26262b 0% 25%, #1a1a1f 0% 50%) 0 0 / 16px 16px";

export function PortraitDebug() {
  const [debug, setDebug] = useState<DebugCapture | null>(null);
  const [status, setStatus] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [overlays, setOverlays] = useState(true);
  const [busy, setBusy] = useState(false);

  async function run(file: File | undefined | null) {
    if (!file) return;
    const capture: DebugCapture = {};
    setDebug(null);
    setErrorMsg(null);
    setWarnings([]);
    setBusy(true);
    try {
      const res = await processPortrait(
        file,
        (phase: PortraitPhase, f) =>
          setStatus(`${phase}${phase === "removing" ? ` ${Math.round(f * 100)}%` : ""}`),
        capture,
      );
      setDebug(capture);
      if ("error" in res) {
        setErrorMsg(
          `REJECTED${capture.rejectReason ? ` (${capture.rejectReason})` : ""}: ${res.error}`,
        );
      } else {
        setWarnings(res.warnings);
      }
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  const a = debug?.analysis;
  const meta = debug?.meta;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="e24-eyebrow">Portrait debug (Δ6) — nothing is saved</h2>
      <div className="flex items-center gap-4">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(e) => void run(e.target.files?.[0])}
          className="text-xs text-zinc-400 file:mr-3 file:rounded-full file:border-0 file:bg-red-600 file:px-4 file:py-1.5 file:text-xs file:font-semibold file:text-white"
        />
        {busy && <span className="text-xs text-zinc-400">{status}…</span>}
        <label className="flex items-center gap-1.5 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={overlays}
            onChange={(e) => setOverlays(e.target.checked)}
            className="accent-red-500"
          />
          overlays
        </label>
      </div>

      {errorMsg && <p className="text-sm font-semibold text-red-400">{errorMsg}</p>}
      {warnings.map((w) => (
        <p key={w} className="text-xs text-amber-400">
          soft signal: {w}
        </p>
      ))}

      {debug && (
        <div className="flex flex-wrap items-start gap-6">
          <Stage label="1 · Original">
            {debug.originalUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={debug.originalUrl} alt="original" className="max-h-64 w-auto" />
            ) : (
              <Missing />
            )}
          </Stage>

          <Stage label="2 · Background removed">
            {debug.cutoutUrl ? (
              <div style={{ background: CHECKER }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={debug.cutoutUrl} alt="cutout" className="max-h-64 w-auto" />
              </div>
            ) : (
              <Missing />
            )}
          </Stage>

          <Stage label="3 · Landmark analysis">
            {debug.cutoutUrl && a ? (
              <div className="relative" style={{ background: CHECKER }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={debug.cutoutUrl} alt="landmarks" className="max-h-64 w-auto" />
                {overlays && (
                  <>
                    {a.faceBox && (
                      <Box
                        color="#22d3ee"
                        l={a.faceBox.x / a.srcW}
                        t={a.faceBox.y / a.srcH}
                        w={a.faceBox.w / a.srcW}
                        h={a.faceBox.h / a.srcH}
                        label="face"
                      />
                    )}
                    {a.eyeY != null && (
                      <Line color="#f59e0b" y={a.eyeY / a.srcH} label="eyes" />
                    )}
                    {a.headTopY != null && (
                      <Line color="#a3e635" y={a.headTopY / a.srcH} label="head top" />
                    )}
                    {a.shoulderY != null && (
                      <Line color="#f472b6" y={a.shoulderY / a.srcH} label="shoulders" />
                    )}
                  </>
                )}
              </div>
            ) : (
              <Missing />
            )}
          </Stage>

          <Stage label="4 · Normalized in safe zone">
            {debug.cutoutUrl && meta ? (
              <div
                className="relative overflow-hidden rounded-lg border border-white/15 bg-zinc-950"
                style={{ width: 240, aspectRatio: `${CARD_ASPECT}` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={debug.cutoutUrl}
                  alt="normalized"
                  className="absolute"
                  style={cutoutCss(meta)}
                />
                {overlays && (
                  <>
                    <Box
                      color="#818cf8"
                      l={PORTRAIT.zone.x}
                      t={PORTRAIT.zone.y}
                      w={PORTRAIT.zone.w}
                      h={PORTRAIT.zone.h}
                      label="safe zone"
                    />
                    <Line color="#f59e0b" y={PORTRAIT.eyeY} label="eye target" />
                    <Line color="#a3e635" y={PORTRAIT.headTopY} label="head target" />
                    <Line color="#f472b6" y={PORTRAIT.shoulderY} label="shoulder target" />
                  </>
                )}
              </div>
            ) : (
              <Missing />
            )}
          </Stage>

          {(a || meta) && (
            <div className="min-w-[200px] rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
              {a && (
                <>
                  <p>faces: {a.faces} · coverage: {(a.coverage * 100).toFixed(1)}%</p>
                  <p>
                    brightness: {a.brightness?.toFixed(0) ?? "—"} · sharpness:{" "}
                    {a.sharpness?.toFixed(1) ?? "—"}
                  </p>
                </>
              )}
              {meta && (
                <>
                  <p>scale: {meta.scale.toExponential(3)}</p>
                  <p>
                    tx: {meta.tx.toFixed(4)} · ty: {meta.ty.toFixed(4)}
                  </p>
                  <p>
                    src: {meta.srcW}×{meta.srcH}
                  </p>
                </>
              )}
              {debug.rejectReason && (
                <p className="text-red-400">reject: {debug.rejectReason}</p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Stage({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <div className="overflow-hidden rounded-lg border border-white/10">{children}</div>
    </div>
  );
}

function Missing() {
  return (
    <div className="flex h-40 w-32 items-center justify-center text-[11px] text-zinc-600">
      not reached
    </div>
  );
}

function Line({ color, y, label }: { color: string; y: number; label: string }) {
  return (
    <div
      className="pointer-events-none absolute left-0 right-0"
      style={{ top: `${y * 100}%`, borderTop: `1px dashed ${color}` }}
    >
      <span
        className="absolute right-0 -translate-y-full px-0.5 text-[9px] font-semibold"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  );
}

function Box({
  color,
  l,
  t,
  w,
  h,
  label,
}: {
  color: string;
  l: number;
  t: number;
  w: number;
  h: number;
  label: string;
}) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: `${l * 100}%`,
        top: `${t * 100}%`,
        width: `${w * 100}%`,
        height: `${h * 100}%`,
        border: `1px solid ${color}`,
      }}
    >
      <span
        className="absolute left-0 -translate-y-full px-0.5 text-[9px] font-semibold"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  );
}
