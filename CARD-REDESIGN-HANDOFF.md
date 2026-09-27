# Platinum card: current visual checkpoint

## Owner-selected reference: B3 — Outward sweep

The owner supplied the exact B3 image, superseding the earlier B4 selection. Use **B3 for the large number and foiling effects**. The saved reference is `design/reference/platinum-b3-outward-approved.png`. The supplied filename is `exec-00296ae7-27e0-43d2-9293-be064bf13b85.png`; this file identity takes precedence over earlier variant labels.

- Match B3's larger, higher, more widely spread number, its font appearance and luminous blue-violet material.
- Match the outward-sweeping plasma: bright blue/cyan energy rooted at the shoulders, curling outward toward the side rails and upward around the number, with violet accents, white-hot catches and fine particles. Do not substitute the B4 clockwise spiral.
- The generated top frame is off-center and is explicitly NOT approved. Preserve the existing coded frame and its alignment.
- Preserve the existing portrait, name/detail typography, team logo placement, stat rail and footer. Do not inherit incidental layout or face changes from the generated mockup.
- This selects the visual target; it does not mean the current code already matches it. Previous number measurements and foil experiments below are historical implementation notes, superseded by B3 for those two areas. Whole-card geometry remains unlocked.


The active visual target is `design/reference/platinum-visual-target.png`. The owner's tighter typography target is `design/reference/name-detail-target.png`. The older annotated approved-card-reference image is an intermediate attempt, not the visual target.

## Current implementation

- `PlayerCard` is the shared app component, not a flattened demo. Full card data and player photos remain editable.
- `lib/cardGeometry.ts` holds the placement. Logo is x125/y110. Name and detail positions are calibrated against the supplied target. Geometry remains provisional until owner approval.
- `DynamicLayers.tsx` uses local Rajdhani Bold for the slanted player name/detail line. Text uses explicit SVG baselines and widths; stats and footer use centered anchors in the authored openings.
- `PortraitElectricity.tsx` samples the supplied cutout's alpha locally at 512px width and derives deterministic edge traces and branching blue arcs. It works from each player's silhouette rather than a Cason-specific path. No face replacement or network photo processing is introduced. Cross-origin images without readable alpha fall back to the existing SVG rim; use the app's processed cutout pipeline.
- `CutoutLighting.tsx` supplies the tight cyan rim and restrained blue spill. `PlayerCard` fades the lower portrait and darkens the name area for readability.
- The authored Platinum art is `public/card/finishes/platinum/plate.png`, copied from the owner's source artwork. The same plate supplies the foreground frame and reflection mask. The previous split-WebP asset contract is superseded by `lib/cardAssets.ts`.
- Intentional changes remain: jersey photo, upper-left team logo, empty upper-right, earned stars, brighter frame.

## Review

Run `npm run dev` against your local seeded database, sign in with a seeded account, and open `/card-preview?master=1&static=1`. Click **Process Cason original**, then **Compare reference**. Test 340 and 520 sizes. The saved legacy cutout shown before processing is not the processed-photo checkpoint. The studio never saves photos to a profile.

TypeScript checks and the card/portrait suite (26 tests) pass. Targeted lint for card components passes. Desktop and 340px card compositions were visually checked. This does not establish pixel equality to generated artwork, approval of the final design, or physical-device performance. Other finish artwork is still pending; do not present the whole card family as production-complete.



## B3 implementation checkpoint — September 19

The shared card now uses a larger/higher live number (zone 122,172,756,500) with detailed blue plasma material, white/cyan edge light and blue bloom. Two reusable image materials are composited in code, not a flattened card. Outward energy is positioned from the cutout silhouette, masked off opaque portrait pixels, and combined with alpha-following rim light and small arcs. Names, logos, stat layout and existing frame were preserved during this pass.

Assets: `public/card/finishes/platinum/number-foil.png` and `plasma-flow.png`. See `public/card/README.md`. The preview compares against the exact approved B3 image. The implementation is ready for visual review; the generated reference is not a pixel-exact rendering specification.

Validation: TypeScript and targeted component lint pass; 32 card-theme, portrait and cutout-validation tests pass. Visual checks performed at 520px and 340px, including an edited jersey number. To review, run `npm run dev` with the local development database, open `/card-preview?master=1&static=1`, click Process Cason original, and Compare reference.

## Superseding B3 foil pass — September 19

The owner rejected the earlier two-flame approach. It is replaced by `b3-foil-field.png`, derived from the exact B3 reference with all card content removed. This retains broad S-shaped blue/violet currents and fine star/filament detail. The live number clips this material with stronger cyan bloom and a white core.

`PlatinumFoilField.tsx` attaches the two sides independently using each processed portrait's alpha. `lib/portrait/foil.ts` samples the neck-to-shoulder transition and maps roots through the portrait transform; the authored field is warped around fixed outer rails. The existing portrait alpha rim remains, with reduced extra sparks. Fixed Cason-specific flame sprites are no longer used. Extreme transforms are limited to avoid destroying the artwork, and unreadable alpha has a normalized fallback.

35 targeted tests pass, including narrower, wider, asymmetric and translated silhouette-root fixtures. TypeScript and targeted lint pass. This verifies attachment math, not every possible real uploaded photo. The B3 visual review loop remains the design authority; do not mark the card owner-approved without their review.
A softly masked screen-blended fringe pass carries the same adaptive currents down the outer sides beside the name, preserving the center text area. This light spill is separate from the silhouette rim.

## Owner review — September 26

Round 1 (commit 3072a9c): centered frame notches and a sharper 2x plate (`scripts/card-art.ts`), brighter number glow, player ~11% smaller (shoulder target 790), and the two energy seams fixed.

Round 2, owner: the energy "is starting too far away from the player like it is outlining him instead of coming from him."

- Cause: the roots were sampled at the chin row, which on long hair is the hair, and anchored the field's inner filaments instead of its two hot nodes (where the currents converge: 223,796 and 762,805). Both nodes floated ~50 units above the shoulders, beside the hair. Separately, the traced electricity rim ran around the whole silhouette: a literal outline.
- `lib/portrait/foil.ts` `shoulderRoots` now finds the top of each shoulder: scanning down from the chin, the edge holds at the neck (or the hair over it), then turns outward; the root is 0.3 face widths past that. Each field half is scaled so its hot node lands on the root.
- `EnergyEmission` (in `FoilField.tsx`, under the cutout): the field's currents nearest the body run hotter, the shoulder edge runs white-hot around each root (fading away from it, never on the head), and a glow marks each root.
- The electricity is shoulder sparks only (no traced rim); the rim light is faint above the shoulders. The fringe pass no longer draws over the player's arms.
- Checked on Cason plus four reshaped builds (broad, narrow, long neck, sloped) and in WebKit.

**Locked.** The owner approved Platinum after round 2: `GEOMETRY_LOCKED = true`, baseline `design/baselines/master-platinum.png`.

**Level-aware (plan C2).** Every color the live layers had hardcoded as Platinum blue is now in the level's palette (`FinishPalette`, `lib/cardTheme.ts`); each level's art is `finishes/<level>/{plate.webp, field.png}`; `PlatinumFoilField` became the generic `FoilField`. Platinum renders pixel-identical to the baseline (0 px differ).

**The other four levels (plan C3, draft for owner review).** `scripts/card-art.ts` recolors the finished Platinum plate and field into Bronze, Silver, Gold and Diamond by gradient map (`LEVEL_LOOKS` in `lib/finishArt.ts`: one ramp each for frame, window, field and live colors, plus energy strength); `derivePalette` runs Platinum's palette through the same live ramp, so text, number and energy match the art. Fields ship as WebP (Platinum's 2.1 MB PNG is now the source in `design/reference/`; the card drifts 0.01%, inside the check's tolerance). The studio (`/card-preview?master=1`) has a level picker, and `shoot-cards.ts --master` shoots every level. Per-level baselines get committed once the owner approves each look.

**Level review, round 1 (owner, 2026-09-26).** Bronze and Silver approved as drafted. "Gold is good but it almost looks like a higher tier than platinum and diamond need to be even cooler!!! More wild special and holographic. The change needs to be more gradual." Gold keeps its colors with a darker frame, dimmer energy (field gain 0.7, emission 0.65) and a dimmer number glow. Diamond became holographic: `Holo` foil in `lib/finishArt.ts` (spectral bands across the card, overlay-blended so darks stay dark and highlights white) on its frame, face and energy; an authored iridescent `DIAMOND_PALETTE`; frame sheen ×1.6; and `HoloShimmer`, a soft-light spectral band over the card face that slides with the light (color-dodge was tried: it blew out the currents and punched black holes).

**Level review, round 2 (owner, 2026-09-26).** Gold: "more changes" (no notes): the amber read too close to Bronze's copper, so Gold is now a true yellow gold at the same toned-down strength. "More shimmer on diamond. And are we able to do slightly different spiral effects on each? Basically same effect but not all the exact same?" Diamond: more holo bands (frame 3, face 2, energy 1.8 cycles), frame sheen ×2.4, face shimmer at full strength with the spectrum twice across the band. Every level's field now gets its own swirls (`swirls` in `LEVEL_LOOKS`, `swirlSource`), clear of the hot nodes; Platinum keeps its approved field.

**All five levels approved (owner, 2026-09-26): "This looks really good. Lets go with this for now."** Baselines for every level are in `design/baselines/` (`shoot-cards.ts --master --check` passes at 0.00%). Next in the plan: C4 (the small sizes and `StaffCard` in the new look), then C5 (rebase on `main`, card migration runbook).

**Small sizes and staff (plan C4, owner: "Do it", 2026-09-26).** The compact row (leaderboard, coach roster) and the avatar (Team Circle, header chip) now wear their level's own art: `scripts/card-art.ts` cuts `ring.webp` (the frame's crystal band bent into a circle) and `frame.webp` (a nine-slice of the frame's corner and rails, mirrored so it's symmetric and notch-free) from every level's plate. Rows: the mini frame around the level's card face and a faint slice of its energy; avatar, name, number and position, points and stars in the full card's palette. Staff cards: the same frame in graphite (`STAFF_LOOK`, `STAFF_FINISH`), a ring portrait, the full card's name block, and role / team / org in the three stat panels; no energy, number or stars. `PortraitDisc` falls back to initials when a photo fails to load (some seeded players' photo URLs 404). The unused `wide` size and `chamferClip` are gone. The studio shows the compact row and avatar at every level; `shoot-cards.ts --master` shoots them (`compact-<level>`, `avatar-<level>`).
