import { useId } from "react";
import { shade, withAlpha, luminance, hexToRgb } from "@/lib/cardTheme";

// A high-fidelity sleeveless basketball jersey rendered in SVG — built to read
// as a product mockup, not a flat icon. Modeled on classic team tanks: plain
// body in the given color, WHITE ribbed trim on the V-neck and armholes, no
// logo. The jersey is turned slightly toward the viewer BY GEOMETRY (far side
// foreshortened, interior back visible through the neck and near armhole), with
// gradient-shaded fabric, soft blurred fold shadows, a chest sheen, a hem
// stitch line, and a contact shadow. All shading derives from the hex via the
// pure cardTheme helpers, so every palette color — black through white — keeps
// its depth. Very light colors get a guard outline + stronger shading so they
// don't wash out on the black UI.
export function JerseyIcon({
  hex,
  className = "h-12 w-11",
}: {
  hex: string;
  className?: string;
}) {
  // Unique, url()-safe ids so 29 instances of gradients/filters can coexist.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (s: string) => `j${uid}${s}`;

  const base = hexToRgb(hex) ? hex : "#3f3f46";
  const lum = luminance(base);
  const light = lum > 0.62; // White / Cream / Silver / Yellow need guarding

  // Fabric shading stops (far side dark → lit near-chest → edge rollback).
  const far = shade(base, light ? -0.34 : -0.3);
  const lit = shade(base, light ? 0.06 : 0.16);
  const edge = shade(base, light ? -0.24 : -0.2);
  const interior = shade(base, -0.58);
  const hemLine = shade(base, -0.4);
  const foldOpacity = light ? 0.16 : 0.1;

  return (
    <svg viewBox="0 0 120 150" className={className} aria-hidden="true">
      <defs>
        {/* fabric */}
        <linearGradient id={id("body")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={far} />
          <stop offset="0.38" stopColor={base} />
          <stop offset="0.62" stopColor={lit} />
          <stop offset="0.85" stopColor={base} />
          <stop offset="1" stopColor={edge} />
        </linearGradient>
        {/* chest sheen */}
        <radialGradient id={id("sheen")} cx="0.62" cy="0.3" r="0.55">
          <stop offset="0" stopColor="rgba(255,255,255,0.14)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        {/* ribbed white trim with a hint of dimension */}
        <linearGradient id={id("trim")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dcdde2" />
        </linearGradient>
        {/* soft-fold blur */}
        <filter id={id("soft")} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
        <filter id={id("shadow")} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.4" />
        </filter>
      </defs>

      {/* contact shadow */}
      <ellipse
        cx="62"
        cy="142"
        rx="38"
        ry="4.5"
        fill="rgba(0,0,0,0.4)"
        filter={`url(#${id("shadow")})`}
      />

      {/* interior back, seen between the straps (back neckline sits higher
          than the front V) */}
      <path
        d="M40 15 C46 25 52 29 59 30 C66 29 72 25 78 15 L78 22 C72 31 66 35 59 35.5 C52 35 46 31 40 22 Z"
        fill={interior}
      />
      {/* white binding along the top of the back neckline */}
      <path
        d="M40 15 C46 25 52 29 59 30 C66 29 72 25 78 15"
        fill="none"
        stroke="#e9eaee"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity="0.9"
      />

      {/* interior visible through the near (right) armhole — the "turned" cue */}
      <path
        d="M97 17 C96.5 31 99.5 48 105.5 63 L100 64 C94.5 49 92 32 92.8 18.5 Z"
        fill={interior}
      />

      {/* body */}
      <path
        d="M22 16
           L40 13.5
           C44.5 33 51.5 43.5 59 45.5
           C66.5 43.5 73.5 33 77.5 13.5
           L98 16
           C97 30 100 48 106 64
           C109.5 85 106.5 113 103 136
           C88 143.5 38 143.5 25 136
           C19.5 113 16.5 85 14 62
           C18.5 46 20.5 30 22 16
           Z"
        fill={`url(#${id("body")})`}
        stroke={light ? "rgba(125,127,136,0.65)" : "rgba(0,0,0,0.28)"}
        strokeWidth="1"
      />
      {/* sheen overlay clipped by the same silhouette */}
      <path
        d="M22 16 L40 13.5 C44.5 33 51.5 43.5 59 45.5 C66.5 43.5 73.5 33 77.5 13.5 L98 16 C97 30 100 48 106 64 C109.5 85 106.5 113 103 136 C88 143.5 38 143.5 25 136 C19.5 113 16.5 85 14 62 C18.5 46 20.5 30 22 16 Z"
        fill={`url(#${id("sheen")})`}
      />

      {/* soft fabric folds */}
      <g filter={`url(#${id("soft")})`} stroke="#000" fill="none" strokeLinecap="round">
        <path d="M99 68 C90 76 82 82 76 92" strokeWidth="5.5" opacity={foldOpacity} />
        <path d="M51 72 C48.5 96 49.5 116 52 132" strokeWidth="5" opacity={foldOpacity * 0.8} />
        <path d="M84 80 C86.5 101 85.5 119 84 134" strokeWidth="4.5" opacity={foldOpacity * 0.7} />
        <path d="M30 130 C50 137 78 137 98 131" strokeWidth="4" opacity={foldOpacity} />
        <path d="M17 70 C21 90 22 110 26 128" strokeWidth="5" opacity={foldOpacity * 0.9} />
      </g>

      {/* hem: darker roll + stitch line */}
      <path
        d="M25 136 C38 143.5 88 143.5 103 136"
        fill="none"
        stroke={hemLine}
        strokeWidth="2.2"
        opacity="0.8"
      />
      <path
        d="M26.5 132.5 C40 139 86 139 101.5 132.5"
        fill="none"
        stroke={hemLine}
        strokeWidth="0.9"
        strokeDasharray="2.4 2.4"
        opacity="0.55"
      />

      {/* ===== white ribbed trim (filled bands, not strokes) ===== */}
      {/* V-neck band */}
      <path
        d="M40 13.5
           C44.5 33 51.5 43.5 59 45.5
           C66.5 43.5 73.5 33 77.5 13.5
           L72.5 14.5
           C69 30.5 64.5 38.5 59 40.2
           C53.5 38.5 49 30.5 45.5 14.5
           Z"
        fill={`url(#${id("trim")})`}
      />
      <path
        d="M45.5 14.5 C49 30.5 53.5 38.5 59 40.2 C64.5 38.5 69 30.5 72.5 14.5"
        fill="none"
        stroke="#b9bbc4"
        strokeWidth="0.8"
        opacity="0.7"
      />

      {/* far (left) armhole band — foreshortened, narrower */}
      <path
        d="M22 16
           C20.5 30 18.5 46 14 62
           L18.6 63
           C22.6 47.5 24.4 31.5 25.8 16.6
           Z"
        fill={`url(#${id("trim")})`}
      />
      <path
        d="M25.8 16.6 C24.4 31.5 22.6 47.5 18.6 63"
        fill="none"
        stroke="#b9bbc4"
        strokeWidth="0.7"
        opacity="0.6"
      />

      {/* near (right) armhole band — wider, catches the light */}
      <path
        d="M98 16
           C97 30 100 48 106 64
           L100 64.8
           C94.6 49.3 92.1 31.8 92.9 17.4
           Z"
        fill={`url(#${id("trim")})`}
      />
      <path
        d="M92.9 17.4 C92.1 31.8 94.6 49.3 100 64.8"
        fill="none"
        stroke="#b9bbc4"
        strokeWidth="0.8"
        opacity="0.7"
      />

      {/* shoulder-top binding connecting collar to armhole trims */}
      <path d="M22 16 L40 13.5" stroke={`url(#${id("trim")})`} strokeWidth="4.6" strokeLinecap="round" />
      <path d="M77.5 13.5 L98 16" stroke={`url(#${id("trim")})`} strokeWidth="4.6" strokeLinecap="round" />
    </svg>
  );
}
