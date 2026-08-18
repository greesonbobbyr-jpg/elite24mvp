// THE PRODUCTION ASSET CONTRACT (Plan v4 §4.6) — the typed manifest of every
// AUTHORED static art asset the Full Player Card compositor consumes, and the
// only place that knows their paths. Engineering builds the compositing,
// positioning, mask plumbing, typography and lighting; the physical
// collectible-card artwork itself is SUPPLIED as these assets.
//
// MISSING-ASSET RULE: if an asset in this contract does not exist, the layer
// that needs it renders the explicit ASSET MISSING development state and
// STOPS. Never a CSS/SVG/gradient/clip-path/generated substitute — missing
// artwork is an asset-production problem, not permission to redesign the card.
//
// Every asset is FULL-CANVAS on the 1000×1500 master (delivered at 2000×3000
// px = 2× so 2×-DPR renders stay crisp) and positioned with `inset: 0` — the
// only per-layer geometry lives inside the pixel data, so layers can never
// drift apart or seam.
//
// Layer numbers reference the compositor's front→back stack (16 = back).

import type { FinishKey } from "@/lib/cardTheme";

export const ASSET_ROOT = "/card";
/** Delivery pixel size (2× the 1000×1500 master). */
export const ASSET_PX = { w: 2000, h: 3000 } as const;

export type AssetKind = "art" | "mask";

export type AssetSpec = {
  /** Path under public/ (and the URL). */
  file: string;
  kind: AssetKind;
  /** Front→back layer number in the compositor stack. */
  layer: number;
  /** Alpha channel required. */
  alpha: boolean;
  /** What must be transparent (art) / how the mask reads (mask). */
  transparency: string;
  /** Sits above the player cutout? */
  abovePlayer: boolean;
  /** Receives the tilt-driven spectral foil (through masks/foil). */
  receivesFoil: boolean;
  /** Receives the tilt-driven specular reflection (through masks/reflection). */
  receivesReflection: boolean;
  /** Changes per prospect finish? */
  perFinish: boolean;
  /** Changes per team? (never, for authored art) */
  perTeam: false;
  /** What visually appears in the asset. */
  contents: string;
  /** What must NOT appear. */
  excludes: string;
  /** Rendering notes / browser requirements. */
  technical: string;
  /** Required for the Platinum checkpoint (vs optional polish). */
  required: boolean;
};

export type FinishAssetKey = "chassis" | "background" | "chassisFg";
export type MaskKey = "occlusion" | "highlight" | "foil" | "reflection";
export type SharedArtKey = "atmosphere";

const COMMON_TECH =
  "Delivered 2000×3000 px (exact), sRGB, no embedded ICC other than sRGB, no " +
  "premultiplied-alpha halos (straight alpha), authored on the 1000×1500 master " +
  "grid at 2×. WebP (lossy q≈85 for opaque/photographic content, lossless for " +
  "hard-edged alpha) or PNG-24. Rendered as an <img> at inset:0 — never cropped.";

/** Per-finish authored art. `<finish>` is filled from FinishKey. */
export const FINISH_ART: Record<FinishAssetKey, Omit<AssetSpec, "file"> & { name: string }> = {
  chassis: {
    name: "chassis.webp",
    kind: "art",
    layer: 16,
    alpha: true,
    transparency:
      "Transparent OUTSIDE the sculpted outer silhouette AND inside the face window " +
      "(the region where background + player + text live). Opaque only where the " +
      "physical frame metal exists.",
    abovePlayer: false,
    receivesFoil: true,
    receivesReflection: true,
    perFinish: true,
    perTeam: false,
    contents:
      "The complete physical chassis in the finish's material: sculpted irregular " +
      "outer silhouette, faceted top crown/cap, ≥3 visible bevel planes across the " +
      "outer lip, bright holographic edge channel, recessed inner bevel/gutter, " +
      "stepped top-corner transitions, tall illuminated side rails, three diagonal " +
      "inset blade segments per upper side, separate upper (7A) and lower (7B) " +
      "perimeter armor pieces with deliberate breaks, lower corner lock/gem plates, " +
      "the broad winged lower chassis that physically integrates the STAT-RAIL " +
      "chassis (three panel openings) and the FOOTER chassis. Baked base lighting, " +
      "occlusion and material response for every piece.",
    excludes:
      "No player, no jersey number, no names, no stat text or stars, no PROSPECT/" +
      "TIER text, no ELITE24MVP wordmark, no team logo, no Player ID, no background " +
      "environment inside the window, no annotation marks. Nothing rendered in the " +
      "top-right slot.",
    technical: COMMON_TECH,
    required: true,
  },
  background: {
    name: "background.webp",
    kind: "art",
    layer: 15,
    alpha: true,
    transparency:
      "Opaque inside the face window (edge to edge under the chassis lip so no seam " +
      "shows); transparent outside the outer silhouette. May extend a few px under " +
      "the frame lip.",
    abovePlayer: false,
    receivesFoil: false,
    receivesReflection: false,
    perFinish: true,
    perTeam: false,
    contents:
      "The premium background/environment material of the card face for this " +
      "finish: dark foundation, authored texture, depth, subtle material energy. " +
      "Neutral enough that the live team illumination layer tints it.",
    excludes:
      "No player, no number, no text, no logo, no frame parts, no baked team color, " +
      "no baked directional glow that would fight the live backlight.",
    technical: COMMON_TECH,
    required: true,
  },
  chassisFg: {
    name: "chassis-fg.webp",
    kind: "art",
    layer: 10,
    alpha: true,
    transparency:
      "Transparent everywhere EXCEPT the frame pieces that physically sit in front " +
      "of the portrait/text: the stat-rail foreground lip and any lower-chassis " +
      "wing/plate edges that overlap the lower torso, plus foreground frame " +
      "highlights.",
    abovePlayer: true,
    receivesFoil: true,
    receivesReflection: true,
    perFinish: true,
    perTeam: false,
    contents:
      "Only the parts of the chassis that must occlude the player: stat-rail " +
      "foreground chassis edges, lower winged chassis lips over the torso area, " +
      "and the foreground frame highlights (bright bevel catches) that read in " +
      "front of everything.",
    excludes:
      "Nothing that belongs behind the player; no text; no full frame duplicate " +
      "(only the foreground pieces).",
    technical: COMMON_TECH + " Mostly transparent — keep it small.",
    required: true,
  },
};

const MASK_TECH =
  "Delivered 2000×3000 px, single-channel intent: white = full effect, black = " +
  "none, gray = partial (soft edges allowed). Save as an OPAQUE grayscale image " +
  "(RGB gray, alpha fully opaque) — the compositor uses `mask-mode: luminance` " +
  "so luminance, not alpha, drives the mask. PNG-8 grayscale or lossless WebP. " +
  "Aligned pixel-for-pixel to the chassis art.";

/** Shared masks (finish-independent unless a finish demands otherwise). */
export const MASKS: Record<MaskKey, AssetSpec> = {
  occlusion: {
    file: `${ASSET_ROOT}/masks/occlusion.webp`,
    kind: "mask",
    layer: 12,
    alpha: false,
    transparency: "Grayscale luminance: white = full contact-shadow darkening, black = none.",
    abovePlayer: false,
    receivesFoil: false,
    receivesReflection: false,
    perFinish: false,
    perTeam: false,
    contents:
      "Ambient occlusion / contact shadow inside the inner gutter, under the crown, " +
      "around the stat-rail openings and beneath the frame lip onto the background — " +
      "the darkening that seats the environment inside the chassis.",
    excludes: "Nothing over the portrait head/face region; no hard shapes.",
    technical: MASK_TECH + " Applied as a multiply layer above background+number, below the player.",
    required: false,
  },
  highlight: {
    file: `${ASSET_ROOT}/masks/highlight.webp`,
    kind: "mask",
    layer: 3,
    alpha: false,
    transparency: "Grayscale luminance: white = bevel plane catches full light.",
    abovePlayer: true,
    receivesFoil: false,
    receivesReflection: false,
    perFinish: false,
    perTeam: false,
    contents:
      "The specular map of the frame's bevel planes and edge highlights — where " +
      "the foreground frame highlight (screen) lands.",
    excludes: "Nothing inside the face window; nothing over the player.",
    technical: MASK_TECH,
    required: false,
  },
  foil: {
    file: `${ASSET_ROOT}/masks/foil.webp`,
    kind: "mask",
    layer: 2,
    alpha: false,
    transparency:
      "Grayscale luminance: white = spectral foil allowed. The PORTRAIT/FACE region " +
      "MUST be black. Essential text zones (surname, details, stat values) black or " +
      "≤10% gray.",
    abovePlayer: true,
    receivesFoil: false,
    receivesReflection: false,
    perFinish: false,
    perTeam: false,
    contents:
      "Where the tilt-driven prismatic foil may appear: holographic edge channel, " +
      "crown facets, side blades, rails, lock plates, stat-rail chassis metal, " +
      "prospect-star zone, controlled background material at low gray.",
    excludes: "Face/skin/hair — hard black. Never the surname or details text.",
    technical: MASK_TECH + " Drives `mask-image` of the color-dodge spectral layer.",
    required: true,
  },
  reflection: {
    file: `${ASSET_ROOT}/masks/reflection.webp`,
    kind: "mask",
    layer: 1,
    alpha: false,
    transparency: "Grayscale luminance: white = the tilt sheen may land here.",
    abovePlayer: true,
    receivesFoil: false,
    receivesReflection: false,
    perFinish: false,
    perTeam: false,
    contents:
      "Where the moving specular reflection reads as glass/metal: frame planes, " +
      "edge rails, stat-rail chassis, a faint pass across the background material.",
    excludes: "Face region black; essential text ≤10% gray.",
    technical: MASK_TECH + " Drives `mask-image` of the screen-blend specular layer.",
    required: true,
  },
};

/** Optional shared art. */
export const SHARED_ART: Record<SharedArtKey, AssetSpec> = {
  atmosphere: {
    file: `${ASSET_ROOT}/atmosphere.webp`,
    kind: "art",
    layer: 12,
    alpha: true,
    transparency: "Transparent except the particles/energy; soft alpha.",
    abovePlayer: false,
    receivesFoil: false,
    receivesReflection: false,
    perFinish: false,
    perTeam: false,
    contents:
      "Subtle white/neutral particle + energy texture used for atmospheric spill " +
      "around (never over) the head; the compositor tints it with the TEAM accent " +
      "and drifts it slowly.",
    excludes: "No color baked in (tinted live), no dense clutter, nothing over the face zone.",
    technical: COMMON_TECH + " Neutral/white so team tinting works.",
    required: false,
  },
};

/** Concrete file paths for one finish. */
export function finishAssets(finish: FinishKey): Record<FinishAssetKey, AssetSpec> {
  const out = {} as Record<FinishAssetKey, AssetSpec>;
  (Object.keys(FINISH_ART) as FinishAssetKey[]).forEach((k) => {
    const { name, ...spec } = FINISH_ART[k];
    out[k] = { ...spec, file: `${ASSET_ROOT}/finishes/${finish}/${name}` };
  });
  return out;
}

/** Every asset the compositor may reference for a finish (contract order). */
export function allAssetsFor(finish: FinishKey): AssetSpec[] {
  return [
    ...Object.values(finishAssets(finish)),
    ...Object.values(MASKS),
    ...Object.values(SHARED_ART),
  ];
}
