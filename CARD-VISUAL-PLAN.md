# Platinum correction plan — active visual review

## Owner-selected reference: B3 — Outward sweep

The owner supplied the exact B3 image, superseding the earlier B4 selection. Use **B3 for the large number and foiling effects**. The saved reference is `design/reference/platinum-b3-outward-approved.png`. The supplied filename is `exec-00296ae7-27e0-43d2-9293-be064bf13b85.png`; this file identity takes precedence over earlier variant labels.

- Match B3's larger, higher, more widely spread number, its font appearance and luminous blue-violet material.
- Match the outward-sweeping plasma: bright blue/cyan energy rooted at the shoulders, curling outward toward the side rails and upward around the number, with violet accents, white-hot catches and fine particles. Do not substitute the B4 clockwise spiral.
- The generated top frame is off-center and is explicitly NOT approved. Preserve the existing coded frame and its alignment.
- Preserve the existing portrait, name/detail typography, team logo placement, stat rail and footer. Do not inherit incidental layout or face changes from the generated mockup.
- This selects the visual target; it does not mean the current code already matches it. Previous number measurements and foil experiments below are historical implementation notes, superseded by B3 for those two areas. Whole-card geometry remains unlocked.


## Target measurements

Measured approximately from the 1024 x 1536 supplied target, normalized to the 1000 x 1500 stage:

- Large 22: left ~171, right ~798, top ~222, bottom ~681. Compare visible glyphs, not the SVG container.
- First name: visible left must be at or right of the surname W's bottom-left edge. No baseline rotation. Reference letter slant is within each glyph.
- Surname: visible left ~195, right ~775, top ~986, bottom ~1090. Preserve black/silver shading with a fine bright bevel and dark lower extrusion.
- Details: centered below surname, visible top ~1125, bottom ~1155; keep air above and below. Match thin condensed lettering and spaced separators.

## Sequence and acceptance

1. Correct visible number silhouette and bounds before lighting. Broad Roboto 900 numerals replace Barlow, fitted at size 755. Close-up comparison rejected the Anton candidate because its inner openings were too narrow. Final box x157/y216/w666/h470 compensates for visible glyph side bearings.
2. Align C with W's lowest left extent; first-name zone x192 and surname zone x177 compensate for the slanted glyph side bearings, aligning their visible left edges. Surname fitted width is 592. Add controlled surname tracking. Compare the name crop to `name-detail-target.png`.
3. Replace flat haze with locally sampled alpha rim, asymmetric branches, filled foil fragments, white-blue catches and narrow blue bloom. Keep face pixels clear. Number material must expose grain and irregular bright facets rather than a uniform purple fill.
4. Compare whole cards and matching areas at 520px; check 340px after geometry/material correction. Code tests cannot establish visual similarity.

## Preserve

Brighter frame, upper-left logo placement, jersey photograph, empty upper-right, centered lower panels and earned stars. Geometry is not approved or locked. Do not move on to other finishes while these comparisons remain unresolved.







## B3 implementation, September 19

Implemented reusable plasma-flow and number-foil textures in the live card compositor. Number remains editable; portrait energy follows processed alpha. Existing frame/name/stats/logo preserved. Review at 340 and 520 via card-preview. Current integration notes are in CARD-REDESIGN-HANDOFF.md and public/card/README.md.

## Superseding visual iteration

Rejected isolated flame sprites replaced with the B3-derived foil field. Both sides adapt to cutout silhouette roots; the number uses the same fine filament material with white core/cyan bloom. See the latest handoff section. Preserve the approved layout. Do not confuse passing tests with owner visual approval.
