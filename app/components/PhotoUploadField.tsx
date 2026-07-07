"use client";

import { useRef, useState } from "react";
import { resizeToDataUrl } from "@/lib/clientImage";

// Owner-only player-photo uploader (Brand page). Drag-drop / click-to-browse →
// the image is resized in-browser to a size-capped `data:` URL (lib/clientImage,
// same machinery as the team logo) and written to a hidden `photoUrl` input the
// server re-validates. Round preview; "Remove" clears it → initials fallback.
export function PhotoUploadField({
  defaultPhotoUrl = null,
}: {
  defaultPhotoUrl?: string | null;
}) {
  const [photo, setPhoto] = useState<string | null>(defaultPhotoUrl);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined | null) {
    setError(null);
    if (!file) return;
    const res = await resizeToDataUrl(file);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setPhoto(res.url);
  }

  return (
    <div>
      <input type="hidden" name="photoUrl" value={photo ?? ""} />
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
          onClick={() => inputRef.current?.click()}
          className={`flex flex-1 cursor-pointer items-center gap-3 rounded-full border border-dashed py-2 pl-2 pr-4 text-sm transition ${
            dragging
              ? "border-red-500 bg-red-600/10"
              : "border-red-600/30 bg-black/40 hover:border-red-500"
          }`}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt="Photo preview"
              className="h-14 w-14 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/5 text-2xl text-zinc-600">
              +
            </div>
          )}
          <span className="text-zinc-300">
            {photo ? "Change photo" : "Drag & drop, or click to choose a file"}
          </span>
        </div>
        {photo && (
          <button
            type="button"
            onClick={() => {
              setPhoto(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="shrink-0 text-xs text-zinc-400 hover:text-red-400 hover:underline"
          >
            Remove
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
