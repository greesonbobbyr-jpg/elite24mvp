# Elite24MVP Player Card — Claude Code Implementation Handoff

## Governing instruction

Implement the approved Elite24MVP player card. Do not redesign it, simplify it, modernize it, or reinterpret it as ordinary responsive web UI.

Use the supplied close-up screenshot as the visual authority for composition, hierarchy, overlap, frame-detail density, material depth, lighting, and proportions. Ignore all white/gray callout lines, circular endpoints, and blue hand-drawn markup; those are annotations, not card artwork.

Newer product rules override the screenshot:

- Top-left: dynamic team logo.
- Top-right: intentionally empty.
- Remove Player ID completely.
- Do not invent a replacement element for the empty top-right.
- Show earned prospect stars only.
- The five prospect levels change finish/material, never geometry.

## Implementation posture

The card is a fixed artwork composition that scales proportionally from a `1000 × 1500` internal coordinate system. It must not independently reflow.

- No layout engine may independently move the portrait, number, name, stat panels, footer, logo, or frame parts.
- Centralize all geometry in one authoritative source such as `cardGeometry.ts`.
- Keep geometry tokens separate from finish/material tokens.
- Treat all measurements below as calibration targets inferred from the screenshot until human visual approval. They are not immutable final pixel values yet.

## Initial calibration targets

- Card master bounds: `x 0–1000`, `y 0–1500`.
- Inner safe area: approximately `x 72–828`, `y 82–1418`.
- Team-logo safe zone: approximately `x 100–280`, `y 150–330`; contain fit, preserve aspect ratio, account for transparent padding.
- Top-right reserved empty zone: mirror the visual weight of the logo region but render nothing.
- Giant jersey number: approximately `x 80–765`, `y 265–1100`; extremely large, behind the portrait, partly obscured.
- Portrait target: approximately `x 155–845`, `y 235–1240`; large, centered, chest-up, with consistent eye line and shoulder relationship.
- Name block: approximately `x 110–790`, `y 935–1115`; first name above a dominant metallic surname; overlays lower torso.
- Details line: approximately `x 110–790`, `y 1120–1185`.
- Three-panel stat rail: approximately `x 90–910`, `y 1200–1380`.
- Footer chassis: approximately `x 90–910`, `y 1395–1470`.

Calibrate these using an exact-dimension reference overlay. The screenshot wins when a target conflicts with the visible approved composition.

## Frame/chassis fidelity requirement

The outer frame is a designed physical chassis, not a border. A render fails review if the frame reads as a flat outline even when the outer silhouette is approximately correct.

Preserve the reference-level construction density:

1. Irregular sculpted outer silhouette.
2. Faceted top crown/cap.
3. Multiple visible bevel planes across the outer lip.
4. Bright holographic/foil edge channel.
5. Recessed inner bevel/gutter.
6. Stepped top-corner transitions.
7. Tall illuminated edge rails.
8. Three diagonal inset blade segments on each upper side.
9. Independent upper and lower perimeter armor pieces separated by deliberate breaks.
10. Lower corner lock/gem plates.
11. Broad winged lower chassis that physically integrates the stat rail and footer.
12. Separate highlights, shadows, occlusion, material response, and foil masks for the major frame pieces.

Do not replace this system with a rounded rectangle, a uniform polygon, a single SVG stroke, generic CSS borders, or a few broad gradients.

The static frame asset package should expose, at minimum:

- chassis base/albedo;
- inner bevel and gutter;
- top crown and corner structures;
- upper/lower perimeter armor pieces;
- diagonal side-blade inserts;
- illuminated side rails;
- lower corner lock plates;
- stat/footer chassis;
- ambient-occlusion/shadow map;
- highlight/specular map;
- selective foil mask;
- reflection mask.

The exact asset split may vary if the renderer requires it, but the visible structure and independent material control may not be reduced.

## Ownership separation

### Static authored art assets

- outer physical chassis and all frame components;
- inner bevel structures;
- premium background texture/environment;
- stat-rail chassis;
- footer chassis;
- occlusion, highlight, reflection, and foil masks.

These should be supplied as authored assets rather than artistically recreated with generic CSS.

### Dynamic player/data

- normalized photographic portrait;
- team logo;
- giant jersey number;
- first name and surname;
- number/position/height details;
- points;
- leaderboard rank;
- earned prospect stars and prospect label;
- ELITE24MVP footer typography.

### Live material effects

- tilt-responsive reflection;
- selective spectral foil;
- controlled metallic response on the surname;
- player rim/backlight;
- background illumination;
- subtle atmosphere/particles.

Never apply foil to the face. Do not apply aggressive spectral motion to essential typography. Restrained metallic response on the surname is allowed and desirable.

## Required front-to-back layer order

Front:

1. Foreground specular/reflection response.
2. Selective foil/prismatic response.
3. Foreground frame highlights.
4. Team logo.
5. ELITE24MVP footer typography.
6. Stat typography and earned prospect stars.
7. Stat-rail foreground chassis.
8. Player name and details.
9. Player foreground rim highlights.
10. Normalized player cutout.
11. Player environmental rim/backlight.
12. Foreground atmosphere/particles.
13. Giant jersey number.
14. Background illumination.
15. Background texture/environment.
16. Physical frame/chassis base.

Back.

## Build sequence

1. Inspect the existing implementation and identify the smallest safe integration path. Preserve unrelated behavior.
2. Create the centralized `1000 × 1500` geometry source and separate finish tokens.
3. Implement the static Platinum chassis and background first, including full frame-detail density.
4. Add the giant number and verify its scale/occlusion.
5. Add the normalized portrait and lighting integration.
6. Add name, details, stat rail, stars, footer, and team logo.
7. Add controlled live material effects using selective masks.
8. Render the Platinum master at a fixed high resolution.
9. Compare with the reference using exact-dimension overlay, side-by-side review, geometry inspection, typography inspection, portrait inspection, and material/lighting inspection.
10. Stop for human visual approval. Do not declare `GEOMETRY LOCKED` yourself.
11. Only after approval, freeze geometry and derive Bronze, Silver, Gold, and Diamond using finish-token changes only.

## Acceptance gates before geometry lock

- Frame reads as a deep, premium collectible-card chassis—not a browser border.
- All major bevel planes and perimeter pieces remain visually distinct.
- Giant number is enormous and partly obscured by the portrait.
- Portrait occupies most of the card’s middle and integrates with lighting/atmosphere.
- Name overlays the lower torso with the surname visually dominant.
- Stat rail and footer feel built into the physical chassis.
- Team logo is top-left; top-right is empty; Player ID is absent.
- Essential typography remains readable.
- Human visual approval is the final authority.

Pixel differences are diagnostic before geometry lock, not the approval authority. After human approval and `GEOMETRY LOCKED`, visual regression protects the approved geometry from accidental drift.

## Required response from Claude Code before implementation

Before editing, return only:

1. the existing files/components that will be affected;
2. the proposed static-asset split for the detailed frame;
3. where the centralized geometry and finish tokens will live;
4. any missing clean source assets that prevent faithful implementation;
5. the first Platinum render checkpoint Claude will produce for human review.

Do not begin implementing a simplified substitute if clean frame assets are missing. Identify the missing assets and continue with all non-blocked engineering work that preserves the approved architecture.
