# Card artwork

Each level has two images in `finishes/<level>/` (`lib/cardAssets.ts`), all **built** by `npx tsx scripts/card-art.ts`. Edit a source (or a level look) and re-run the script; never edit the WebPs by hand.

- `plate.webp`: the frame, background and recessed stat panels. Platinum's comes from the authored source `design/reference/platinum-plate-source.png` (1024×1536, cut from the owner's card art): upscaled 2× to 2048×3072 so phones get a sharp frame, frame centered in the canvas, top and bottom borders mirrored so their notches are centered (owner review, 2026-09-26), sharpened.
- `field.webp`: the energy currents. Platinum's comes from `design/reference/platinum-field-source.png`: flowing blue-violet foil derived from the approved B3 reference, with all people, numbers, lettering, frame and logos removed. It is not a flattened card.

**Bronze, Silver, Gold, Diamond** are the finished Platinum plate and field recolored by gradient map (owner decision, 2026-09-25): each pixel's brightness picks a color from the level's ramp, so every facet, star and current keeps its shape and only the material changes. The ramps live in `lib/finishArt.ts` (`LEVEL_LOOKS`, one table); the plate's frame and window take separate ramps. The same ramps color the live layers (number, text accents, energy), so they always match the art. Diamond adds holographic foil (spectral colors drifting across the card over its ramp), an authored iridescent palette (`DIAMOND_PALETTE`), a stronger frame sheen and a face shimmer that slides with the light (`HoloShimmer`). The climb is gradual and Gold stays under Platinum (owner review, 2026-09-26). Any file can be replaced by designer art under the same name.

A missing file renders the ASSET MISSING state, never a drawn substitute.

`FoilField.tsx` attaches the field to the player: `lib/portrait/foil.ts` finds the top of each shoulder in the processed portrait's alpha, and each half of the artwork is scaled so its hot node (where its currents converge) lands there. `EnergyEmission` then makes the energy come out of the player: the currents nearest the body run hotter and the shoulder edge runs white-hot around each root, never on the head (owner review, 2026-09-26); lower levels run it quieter. Transform limits preserve texture quality for extreme shapes. Unreadable external alpha falls back to the authored B3 layout; app-processed local cutouts are the intended input. The portrait itself occludes the background.

`DynamicLayers.tsx` clips the same field into the live jersey number, with separate bloom and a bright core. All text and photos remain editable.

Approved reference: `design/reference/platinum-b3-outward-approved.png`. Only its number and foil style were selected; preserve existing frame, names, logo, portrait layout and stats. Codex's earlier `number-foil.png` and `plasma-flow.png` experiments are kept in `design/reference/experiments/` (not shipped).
