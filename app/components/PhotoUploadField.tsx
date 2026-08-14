"use client";

import { useRef, useState } from "react";
import {
  processPortrait,
  PORTRAIT_REJECT_MESSAGE,
  type PortraitPhase,
} from "@/lib/portrait/process";

// Card-portrait uploader (photo pipeline A) — Brand page (players) and Team
// Settings (coaches). A chosen photo runs the ON-DEVICE pipeline: capped
// original + background-removed cutout + metadata, written to three hidden
// fields the server re-validates. FAILURE REJECTS (Δ5): on any pipeline
// failure nothing changes — the previous photo (or none) stays, with the §16
// re-upload message. "Re-cut" re-processes the stored original.
export function PhotoUploadField({
  defaultPhotoUrl = null,
  defaultCutoutUrl = null,
  defaultMeta = null,
}: {
  defaultPhotoUrl?: string | null;
  defaultCutoutUrl?: string | null;
  /** JSON-serialized stored photoMeta, passed back through unchanged. */
  defaultMeta?: string | null;
}) {
  const [photo, setPhoto] = useState<string | null>(defaultPhotoUrl);
  const [cutout, setCutout] = useState<string | null>(defaultCutoutUrl);
  const [meta, setMeta] = useState<string | null>(defaultMeta);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState<null | { phase: PortraitPhase; pct: number }>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function runPipeline(source: Blob) {
    setError(null);
    setWarnings([]);
    setBusy({ phase: "reading", pct: 0 });
    try {
      const res = await processPortrait(source, (phase, fraction) =>
        setBusy({ phase, pct: Math.round(fraction * 100) }),
      );
      if ("error" in res) {
        setError(res.error); // previous photo/cutout stay untouched (Δ5)
        return;
      }
      setPhoto(res.originalUrl);
      setCutout(res.cutoutUrl);
      setMeta(JSON.stringify(res.meta));
      setWarnings(res.warnings); // soft signals only (Δ12) — notes, not gates
    } finally {
      setBusy(null);
    }
  }

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    await runPipeline(file);
  }

  // Re-process the STORED original (data:, /api/photo path, or https URL).
  async function recut() {
    if (!photo) return;
    setError(null);
    try {
      const blob = await (await fetch(photo)).blob();
      await runPipeline(blob);
    } catch {
      setError(PORTRAIT_REJECT_MESSAGE);
    }
  }

  const phaseLabel =
    busy?.phase === "removing"
      ? `Removing background… ${busy.pct}%`
      : busy?.phase === "analyzing"
        ? "Placing your portrait…"
        : busy?.phase === "finishing"
          ? "Finishing…"
          : "Reading photo…";

  const preview = cutout ?? photo;

  return (
    <div>
      <input type="hidden" name="photoUrl" value={photo ?? ""} />
      <input type="hidden" name="photoCutoutUrl" value={cutout ?? ""} />
      <input type="hidden" name="photoMeta" value={meta ?? ""} />
      <p className="mb-1 block text-xs font-medium text-zinc-400">
        Your photo <span className="text-zinc-600">(optional)</span>
      </p>
      <div className="flex items-center gap-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          onClick={() => !busy && inputRef.current?.click()}
          className={`flex flex-1 cursor-pointer items-center gap-3 rounded-full border border-dashed py-2 pl-2 pr-4 text-sm transition ${
            dragging
              ? "border-red-500 bg-red-600/10"
              : "border-red-600/30 bg-black/40 hover:border-red-500"
          } ${busy ? "pointer-events-none opacity-70" : ""}`}
        >
          {preview ? (
            // Cutouts sit on a dark disc so the removed background reads.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Photo preview"
              className="h-14 w-14 shrink-0 rounded-full bg-zinc-800 object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/5 text-2xl text-zinc-600">
              +
            </div>
          )}
          <span className="text-zinc-300">
            {busy
              ? phaseLabel
              : preview
                ? "Change photo"
                : "Upload a clear chest-up photo facing the camera. Make sure your head and shoulders are fully visible."}
          </span>
        </div>
        {photo && !busy && (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => void recut()}
              className="text-xs text-zinc-400 hover:text-red-400 hover:underline"
            >
              Re-cut photo
            </button>
            <button
              type="button"
              onClick={() => {
                setPhoto(null);
                setCutout(null);
                setMeta(null);
                setError(null);
                setWarnings([]);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="text-xs text-zinc-400 hover:text-red-400 hover:underline"
            >
              Remove
            </button>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      {busy && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-red-500 transition-[width] duration-200"
            style={{ width: `${busy.phase === "removing" ? busy.pct : 5}%` }}
          />
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {warnings.map((warning) => (
        <p key={warning} className="mt-1 text-xs text-amber-400">
          {warning}
        </p>
      ))}
    </div>
  );
}
