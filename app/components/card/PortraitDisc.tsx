"use client";

import { useCallback, useState } from "react";
import type { PortraitMetaV2 } from "@/lib/portrait/normalize";
import { headCropStyle } from "./chrome";

/** Whether an image loaded: false once it errors — including a 404 that fired
 * before hydration (SSR'd <img>), which onError alone misses, so the element
 * is checked when it attaches. A missing photo must never show a broken image. */
export function useImageOk(src: string | null) {
  const [broken, setBroken] = useState<string | null>(null);
  const attach = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth === 0) setBroken(el.getAttribute("src"));
  }, []);
  return { ok: src != null && broken !== src, attach, onError: () => setBroken(src) };
}

/** What fills a circular staff portrait: the cutout's head (face-box crop
 * when meta exists), else the photo, else initials — and initials again if
 * the image fails to load. Sized by the portrait around it: the crop is in
 * percentages of the disc, the initials in its container units. */
export function PortraitDisc({
  name,
  initials,
  cutout,
  photo,
  meta,
}: {
  name: string;
  initials: string;
  cutout: string | null;
  photo: string | null;
  meta: PortraitMetaV2 | null;
}) {
  const src = cutout ?? photo;
  const { ok, attach, onError } = useImageOk(src);
  if (!ok) {
    // 0.34 of the disc, which spans 82% of the portrait.
    return (
      <span className="font-black uppercase italic text-white/90" style={{ fontFamily: "var(--font-barlow)", fontSize: "27.9cqw" }}>
        {initials}
      </span>
    );
  }
  return cutout && meta ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={attach} src={cutout} alt={name} style={headCropStyle(meta)} onError={onError} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={attach} src={src ?? undefined} alt={name} className={`h-full w-full object-cover${cutout ? " object-top" : ""}`}
      onError={onError} />
  );
}
