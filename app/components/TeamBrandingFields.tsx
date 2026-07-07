"use client";

import { useRef, useState } from "react";
import { TEAM_COLORS } from "@/lib/teamColors";
import { resizeToDataUrl } from "@/lib/clientImage";

// Coach team-branding inputs, shared by the signup form and team settings:
//  - Logo: drag-drop OR click-to-browse. The image is resized in-browser to a
//    small `data:` URL (no upload endpoint / file hosting — it rides along in the
//    existing `logoUrl` field and renders via a plain <img>). Server re-validates
//    it's a data:image under a size cap. Resize logic lives in lib/clientImage.
//  - Colors: PRIMARY + SECONDARY picked from the fixed TEAM_COLORS palette. The
//    chosen hexes go into hidden inputs; server re-validates each is a known
//    palette color.
// All three are optional (branding is optional). `default*` props pre-fill the
// current values on the settings page.

export function TeamBrandingFields({
  defaultLogoUrl = null,
  defaultPrimary = null,
  defaultSecondary = null,
}: {
  defaultLogoUrl?: string | null;
  defaultPrimary?: string | null;
  defaultSecondary?: string | null;
}) {
  const [logo, setLogo] = useState<string | null>(defaultLogoUrl);
  const [primary, setPrimary] = useState<string | null>(defaultPrimary);
  const [secondary, setSecondary] = useState<string | null>(defaultSecondary);
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
    setLogo(res.url);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Hidden fields the server action reads. */}
      <input type="hidden" name="logoUrl" value={logo ?? ""} />
      <input type="hidden" name="primaryColor" value={primary ?? ""} />
      <input type="hidden" name="secondaryColor" value={secondary ?? ""} />

      {/* Logo */}
      <div>
        <p className="mb-1 block text-xs font-medium text-zinc-400">
          Team logo <span className="text-zinc-600">(optional)</span>
        </p>
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
          className={`flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3 py-4 text-sm transition ${
            dragging
              ? "border-red-500 bg-red-600/10"
              : "border-red-600/30 bg-black/40 hover:border-red-500"
          }`}
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt="Team logo preview"
              className="h-14 w-14 shrink-0 rounded object-contain"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-white/5 text-2xl text-zinc-600">
              +
            </div>
          )}
          <div className="min-w-0">
            <p className="text-zinc-300">
              {logo ? "Logo added" : "Drag & drop, or click to choose a file"}
            </p>
            <p className="text-[11px] text-zinc-500">PNG, JPG, or WEBP</p>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        {logo && (
          <button
            type="button"
            onClick={() => {
              setLogo(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="mt-1.5 text-xs text-zinc-400 hover:text-red-400 hover:underline"
          >
            Remove logo
          </button>
        )}
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>

      {/* Colors */}
      <div className="flex flex-col gap-3">
        <Swatches
          label="Primary color"
          selected={primary}
          onPick={setPrimary}
        />
        <Swatches
          label="Secondary color"
          selected={secondary}
          onPick={setSecondary}
        />
        {(primary || secondary) && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>Preview:</span>
            <span
              className="inline-block h-5 w-8 rounded border border-white/20"
              style={{ backgroundColor: primary ?? "transparent" }}
            />
            <span
              className="inline-block h-5 w-8 rounded border border-white/20"
              style={{ backgroundColor: secondary ?? "transparent" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Swatches({
  label,
  selected,
  onPick,
}: {
  label: string;
  selected: string | null;
  onPick: (hex: string | null) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 block text-xs font-medium text-zinc-400">
        {label} <span className="text-zinc-600">(optional)</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {TEAM_COLORS.map((c) => {
          const isSel = selected?.toLowerCase() === c.hex.toLowerCase();
          return (
            <button
              key={c.hex}
              type="button"
              title={c.name}
              aria-label={c.name}
              aria-pressed={isSel}
              onClick={() => onPick(isSel ? null : c.hex)}
              style={{ backgroundColor: c.hex }}
              className={`h-8 w-8 rounded-full transition ${
                isSel
                  ? "ring-2 ring-white ring-offset-2 ring-offset-black"
                  : "border border-white/20 hover:scale-110"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
