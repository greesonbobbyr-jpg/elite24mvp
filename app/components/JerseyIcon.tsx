import { useId } from "react";
import { luminance, hexToRgb } from "@/lib/cardTheme";

// A sleeveless basketball jersey rendered at the realism ceiling of SVG — built
// like a studio product shot, not an icon:
//   · four-part lighting (key gradient, ambient-occlusion pools, core shadow,
//     edge rollover — no cartoon outline on normal colors)
//   · the white trim CASTS a soft shadow onto the fabric (reads stitched-on)
//   · folds are shadow+highlight PAIRS (valley + lit ridge), armpit tension
//     wrinkles, and an undulating hem with ripple shading
//   · fabric grain via feTurbulence so the surface reads knit, not plastic
//   · photographic color response: shadows cool + desaturate, highlights warm
//   · ribbed trim (knit ticks) with the classic crossover notch at the V
//   · NO back collar between the straps (invisible-mannequin look — owner call);
//     the interior shows only through the near armhole, which sells the turn
// All shading derives from the hex; very light colors (white/cream/silver) get
// a guard outline + stronger shading so they hold up on the black UI.

// Hue-aware mixing (real shadows aren't "color + black").
function mix(a: string, b: string, t: number): string {
  const pa = hexToRgb(a) ?? { r: 63, g: 63, b: 70 };
  const pb = hexToRgb(b) ?? { r: 0, g: 0, b: 0 };
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${c(pa.r, pb.r)}, ${c(pa.g, pb.g)}, ${c(pa.b, pb.b)})`;
}

const COOL_DARK = "#161a22"; // shadows cool off
const WARM_LIGHT = "#fff6e8"; // highlights warm up

// The body silhouette — deeper scooped armholes (basketball cut), soft shoulder
// S-curves, slight A-flare, undulating hem with the near corner hanging lower.
const BODY =
  "M23 15 C28 13.2 33.5 12.7 39 12.5 " +
  "C44 32 51 43 59 45.8 C67 43 73.5 32 77.5 12.5 " +
  "C84 12.7 91 13.5 97 15.5 " +
  "C94.5 31 96.5 50 105.5 64 " +
  "C108 84 105.5 112 106 137 " +
  "C96 143.5 84 140.5 72 142.5 C60 144.5 48 140.5 36 142 C30 142.8 26.5 140 24 135.5 " +
  "C21 112 19.5 86 15.5 63 " +
  "C20 46 22 30 23 15 Z";

export function JerseyIcon({
  hex,
  className = "h-14 w-12",
}: {
  hex: string;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (s: string) => `j${uid}${s}`;
  const url = (s: string) => `url(#${id(s)})`;

  const base = hexToRgb(hex) ? hex : "#3f3f46";
  const lum = luminance(base);
  const light = lum > 0.62;

  // Key-light gradient stops (cool shadows, warm lights).
  const farStop = mix(base, COOL_DARK, light ? 0.42 : 0.36);
  const litStop = mix(base, WARM_LIGHT, light ? 0.08 : 0.2);
  const edgeStop = mix(base, COOL_DARK, light ? 0.3 : 0.24);
  const interior = mix(base, "#0b0d12", 0.62);
  const hemLine = mix(base, COOL_DARK, 0.45);
  const ridge = "rgba(255,252,245,1)";

  // Shading strength scales up on light fabrics (they need contrast on black).
  const k = light ? 1.5 : 1;

  return (
    <svg viewBox="0 0 120 150" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id("body")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={farStop} />
          <stop offset="0.36" stopColor={base} />
          <stop offset="0.6" stopColor={litStop} />
          <stop offset="0.84" stopColor={base} />
          <stop offset="1" stopColor={edgeStop} />
        </linearGradient>
        <radialGradient id={id("sheen")} cx="0.6" cy="0.26" r="0.6">
          <stop offset="0" stopColor="rgba(255,250,240,0.16)" />
          <stop offset="1" stopColor="rgba(255,250,240,0)" />
        </radialGradient>
        <linearGradient id={id("trim")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dcdee6" />
        </linearGradient>
        <linearGradient id={id("trimc")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2f3f6" />
          <stop offset="1" stopColor="#c9ccd6" />
        </linearGradient>
        <filter id={id("f1")} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.7" />
        </filter>
        <filter id={id("f2")} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
        <filter id={id("fs")} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.6" />
        </filter>
        {/* knit grain */}
        <filter id={id("gr")} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            stitchTiles="stitch"
            result="n"
          />
          <feColorMatrix
            in="n"
            type="matrix"
            values="0 0 0 0 0.62  0 0 0 0 0.62  0 0 0 0 0.66  0 0 0 0.9 0"
          />
        </filter>
        <clipPath id={id("clip")}>
          <path d={BODY} />
        </clipPath>
      </defs>

      {/* contact shadow */}
      <ellipse
        cx="63"
        cy="142"
        rx="40"
        ry="4.6"
        fill="rgba(0,0,0,0.42)"
        filter={url("fs")}
      />

      {/* fabric */}
      <path
        d={BODY}
        fill={url("body")}
        stroke={light ? "rgba(140,142,152,0.6)" : "none"}
        strokeWidth={light ? 1.1 : 0}
      />

      {/* everything painterly stays inside the silhouette */}
      <g clipPath={url("clip")}>
        {/* sheen */}
        <path d={BODY} fill={url("sheen")} />

        {/* core shadow — the form turning away on the near side */}
        <path
          d="M101 18 L101 142"
          stroke="#10131a"
          strokeWidth="22"
          opacity={0.11 * k}
          filter={url("f1")}
        />

        {/* ambient occlusion pools */}
        <g fill="#10131a" filter={url("f1")}>
          <ellipse cx="100" cy="70" rx="10" ry="7" opacity={0.17 * k} />
          <ellipse cx="20" cy="68" rx="8" ry="6" opacity={0.15 * k} />
        </g>
        <g stroke="#10131a" fill="none" filter={url("f1")} strokeLinecap="round">
          {/* side seams */}
          <path d="M17 66 C21 90 22.5 112 25 134" strokeWidth="6" opacity={0.13 * k} />
          <path d="M104 66 C106.5 90 105 114 105 136" strokeWidth="6" opacity={0.13 * k} />
          {/* under the shoulder straps */}
          <path d="M29 17.5 L37 15.5" strokeWidth="5" opacity={0.1 * k} />
          <path d="M80 15 L92 17" strokeWidth="5" opacity={0.1 * k} />
          {/* hem shade */}
          <path
            d="M26 136 C40 142.5 60 143 72 141.5 C84 140 96 141.5 104 136.5"
            strokeWidth="3.4"
            opacity={0.18 * k}
          />
        </g>

        {/* trim CAST shadows — the win that makes ribbing sit ON the fabric */}
        <g stroke="#0b0e14" fill="none" filter={url("f2")} strokeLinecap="round">
          <path
            d="M45.8 16 C49.2 31 53.6 39.2 59 41 C64.4 39.2 68.8 31 72.2 16"
            strokeWidth="2.7"
            opacity={0.3 * k}
          />
          <path
            d="M91.9 19 C91.1 32.8 93.4 49.2 99.2 64.2"
            strokeWidth="2.4"
            opacity={0.28 * k}
          />
          <path
            d="M28 17.5 C26.6 31.8 24.7 47 20.9 62.6"
            strokeWidth="2"
            opacity={0.24 * k}
          />
        </g>

        {/* folds — dark valley + lit ridge pairs */}
        <g fill="none" strokeLinecap="round">
          {/* major drape 1 */}
          <path
            d="M50 70 C47.5 96 48.5 118 51 138"
            stroke="#0b0e14"
            strokeWidth="6"
            opacity={0.1 * k}
            filter={url("f1")}
          />
          <path
            d="M54.5 70 C52.5 96 53.5 118 55.5 137"
            stroke={ridge}
            strokeWidth="3"
            opacity={light ? 0.1 : 0.07}
            filter={url("f1")}
          />
          {/* major drape 2 */}
          <path
            d="M83 76 C85.5 100 84.5 120 83 139"
            stroke="#0b0e14"
            strokeWidth="5.5"
            opacity={0.09 * k}
            filter={url("f1")}
          />
          <path
            d="M79 76 C81 100 80.5 120 80 138"
            stroke={ridge}
            strokeWidth="2.8"
            opacity={light ? 0.09 : 0.06}
            filter={url("f1")}
          />
          {/* armpit tension wrinkles — near */}
          <path
            d="M97 68 C90 74 84.5 78 79.5 84"
            stroke="#0b0e14"
            strokeWidth="3.4"
            opacity={0.11 * k}
            filter={url("f2")}
          />
          <path
            d="M99 75 C93 81 88.5 86 84.5 92"
            stroke="#0b0e14"
            strokeWidth="2.7"
            opacity={0.08 * k}
            filter={url("f2")}
          />
          <path
            d="M95 71.5 C89 76.5 84.5 81 80.5 87"
            stroke={ridge}
            strokeWidth="2"
            opacity={light ? 0.08 : 0.05}
            filter={url("f2")}
          />
          {/* armpit tension wrinkles — far */}
          <path
            d="M19 66 C25 72 29.5 77.5 33.5 84"
            stroke="#0b0e14"
            strokeWidth="3"
            opacity={0.1 * k}
            filter={url("f2")}
          />
          <path
            d="M17.5 73 C23 79 27 84.5 30.5 90"
            stroke="#0b0e14"
            strokeWidth="2.5"
            opacity={0.07 * k}
            filter={url("f2")}
          />
          {/* hem ripple ticks (alternating valley/ridge above the wavy hem) */}
          <path d="M40 127 C39.4 132 39.7 136 40.4 139.5" stroke="#0b0e14" strokeWidth="3" opacity={0.09 * k} filter={url("f2")} />
          <path d="M64 128 C63.5 133 63.8 137 64.4 140.5" stroke="#0b0e14" strokeWidth="3" opacity={0.09 * k} filter={url("f2")} />
          <path d="M88 127 C87.6 132 87.8 136 88.3 139" stroke="#0b0e14" strokeWidth="2.7" opacity={0.08 * k} filter={url("f2")} />
          <path d="M52 128 C51.6 133 51.8 137 52.3 140.5" stroke={ridge} strokeWidth="2.4" opacity={light ? 0.08 : 0.05} filter={url("f2")} />
          <path d="M76 128.5 C75.7 133 75.9 137 76.3 140.5" stroke={ridge} strokeWidth="2.4" opacity={light ? 0.08 : 0.05} filter={url("f2")} />
        </g>

        {/* edge rollover — shading defines the silhouette, not an outline */}
        <g stroke="#0d1017" fill="none" filter={url("f1")} strokeLinecap="round">
          <path d="M22.5 16 C20 46 19.5 86 24 135" strokeWidth="4.2" opacity={0.2 * k} />
          <path d="M97.5 16 C96 48 107 86 106 136" strokeWidth="4.2" opacity={0.16 * k} />
        </g>

        {/* knit grain */}
        <rect
          x="0"
          y="0"
          width="120"
          height="150"
          filter={url("gr")}
          opacity={light ? 0.075 : 0.05}
          style={{ mixBlendMode: "overlay" }}
        />
      </g>

      {/* interior of the back, visible ONLY through the near armhole */}
      <path
        d="M92.6 17 C91.4 32 93.6 49 100 63.8 L96.4 62.9 C90.6 48.6 88.9 32.6 89.6 18 Z"
        fill={interior}
      />

      {/* hem stitch line */}
      <path
        d="M26.5 132.5 C40 139 60 139.5 72 138 C84 136.5 96 138 103.5 133"
        fill="none"
        stroke={hemLine}
        strokeWidth="0.9"
        strokeDasharray="2.4 2.4"
        opacity="0.55"
      />

      {/* ===== ribbed white trim ===== */}
      {/* V-neck band */}
      <path
        d="M39 12.5 C44 32 51 43 59 45.8 C67 43 73.5 32 77.5 12.5
           L72.6 13.6 C69.3 30 64.8 38.6 59 40.4 C53.2 38.6 48.7 30 45.4 13.6 Z"
        fill={url("trim")}
      />
      {/* rib ticks along the V */}
      <path
        d="M42.2 13 C46.6 30.5 53 40.6 59 43 M75.1 13 C70.4 30.5 65 40.6 59 43"
        fill="none"
        stroke="#b4b6c0"
        strokeWidth="1.1"
        strokeDasharray="0.9 1.7"
        opacity="0.5"
      />
      {/* crossover notch at the V point (left band overlaps right) */}
      <path d="M56 39 L59 45.8 L61.4 44.5 L58.3 38.2 Z" fill={url("trim")} />
      <path d="M58.3 38.4 L61.2 44.4" stroke="#a9abb5" strokeWidth="0.7" opacity="0.8" fill="none" />
      <path d="M59.2 38 L62 43.8" stroke="#0c0f15" strokeWidth="0.8" opacity="0.2" fill="none" />
      {/* inner seam hairline */}
      <path
        d="M45.4 13.6 C48.7 30 53.2 38.6 59 40.4 C64.8 38.6 69.3 30 72.6 13.6"
        fill="none"
        stroke="#b0b2bc"
        strokeWidth="0.7"
        opacity="0.65"
      />

      {/* far armhole band (foreshortened, cooler) */}
      <path
        d="M23 15 C22 30 20 46 15.5 63 L20.2 63.8 C24.3 47.5 26.1 31.5 27.5 15.9 Z"
        fill={url("trimc")}
      />
      <path
        d="M25.3 15.5 C23.9 31 22.1 47 18 63.4"
        fill="none"
        stroke="#b4b6c0"
        strokeWidth="0.9"
        strokeDasharray="0.9 1.7"
        opacity="0.45"
      />

      {/* near armhole band (wider, catches the key light) */}
      <path
        d="M97 15.5 C94.5 31 96.5 50 105.5 64 L100 63.8 C93.6 49 91.4 32 92.6 17 Z"
        fill={url("trim")}
      />
      <path
        d="M94.9 16.2 C93 32 95.2 49.5 102.6 63.9"
        fill="none"
        stroke="#b4b6c0"
        strokeWidth="1"
        strokeDasharray="0.9 1.7"
        opacity="0.5"
      />
      <path
        d="M92.6 17 C91.4 32 93.6 49 100 63.8"
        fill="none"
        stroke="#b0b2bc"
        strokeWidth="0.7"
        opacity="0.6"
      />

      {/* shoulder-top binding connecting collar and armhole trim */}
      <path
        d="M23 15 C28 13.2 33.5 12.7 39 12.5"
        stroke={url("trimc")}
        strokeWidth="4.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M77.5 12.5 C84 12.7 91 13.5 97 15.5"
        stroke={url("trim")}
        strokeWidth="4.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
