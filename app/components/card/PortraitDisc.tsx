"use client";

import { useEffect, useRef, useState } from "react";
import type { PortraitMetaV2 } from "@/lib/portrait/normalize";
import { headCropStyle } from "./chrome";

/** What fills a circular portrait (player avatar, staff portrait): the
 * cutout's head (face-box crop when meta exists), else the photo, else
 * initials. Initials again if the image fails to load: a missing photo must
 * never show a broken image. */
export function PortraitDisc({
  name,
  initials,
  cutout,
  photo,
  meta,
  disc,
}: {
  name: string;
  initials: string;
  cutout: string | null;
  photo: string | null;
  meta: PortraitMetaV2 | null;
  /** Disc diameter in CSS px. */
  disc: number;
}) {
  const src = cutout ?? photo;
  const ref = useRef<HTMLImageElement>(null);
  const [broken, setBroken] = useState<string | null>(null);

  // A 404 can fire before hydration (SSR'd <img>), so onError alone is not
  // enough — re-check the decoded state once mounted.
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setBroken(el.getAttribute("src"));
  }, [src]);

  if (!src || broken === src) {
    return (
      <span className="font-black uppercase italic text-white/90" style={{ fontFamily: "var(--font-barlow)", fontSize: disc * 0.34 }}>
        {initials}
      </span>
    );
  }
  const onError = () => setBroken(src);
  return cutout && meta ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} src={cutout} alt={name} style={headCropStyle(meta, disc)} onError={onError} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} src={src} alt={name} className={`h-full w-full object-cover${cutout ? " object-top" : ""}`} onError={onError} />
  );
}
