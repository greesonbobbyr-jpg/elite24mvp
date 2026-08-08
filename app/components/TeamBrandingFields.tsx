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
            <span>Your uniforms:</span>
            {primary && <JerseyIcon hex={primary} className="h-8 w-7" />}
            {secondary && <JerseyIcon hex={secondary} className="h-8 w-7" />}
          </div>
        )}
      </div>
    </div>
  );
}

// A miniature sleeveless basketball jersey in the given color — plain body,
// WHITE neck + armhole trim (like classic team tanks), no logo. Tilted a few
// degrees with a darker sliver visible inside the near armhole so it reads as a
// jersey turned slightly toward you, not a flat cutout. A faint neutral hairline
// keeps the White/Cream jerseys visible on the black UI.
export function JerseyIcon({
  hex,
  className = "h-10 w-9",
}: {
  hex: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 40 46"
      className={className}
      style={{ transform: "rotate(-8deg)" }}
      aria-hidden="true"
    >
      {/* body */}
      <path
        d="M10 3 L14 3 C15.5 9 17.5 12.5 20 13.5 C22.5 12.5 24.5 9 26 3 L30 3 C29.5 9.5 31.5 13.5 35 17 L34.5 41 C34.5 42.5 33.5 43.5 32 43.5 L8 43.5 C6.5 43.5 5.5 42.5 5.5 41 L5 17 C8.5 13.5 10.5 9.5 10 3 Z"
        fill={hex}
        stroke="rgba(148,148,158,0.55)"
        strokeWidth="1"
      />
      {/* interior shadow through the near armhole (the "turned" depth cue) */}
      <path
        d="M30 3 C29.5 9.5 31.5 13.5 35 17 L32.5 18.5 C29.8 14.8 28.4 10.2 28.8 4.5 Z"
        fill="rgba(0,0,0,0.30)"
      />
      {/* white ribbing: V-neck + both armholes */}
      <path
        d="M14 3 C15.5 9 17.5 12.5 20 13.5 C22.5 12.5 24.5 9 26 3"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M10 3 C10.5 9.5 8.5 13.5 5 17"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M30 3 C29.5 9.5 31.5 13.5 35 17"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
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
      <div className="flex flex-wrap gap-1.5">
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
              className={`rounded-lg p-0.5 transition ${
                isSel
                  ? "scale-105 ring-2 ring-white ring-offset-2 ring-offset-black"
                  : "hover:scale-110"
              }`}
            >
              <JerseyIcon hex={c.hex} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
