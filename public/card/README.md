# Platinum card artwork

Current shared card assets:

- `finishes/platinum/plate.webp`: the frame/background used by the compositor, **built** by `npx tsx scripts/card-art.ts` from the authored source `design/reference/platinum-plate-source.png` (1024×1536, cut from the owner's card art). The build upscales 2× to 2048×3072 so phones get a sharp frame, centers the frame in the canvas, mirrors the top and bottom borders so their notches are centered (owner review, 2026-09-26), and sharpens. Edit the source and re-run the script; never edit the WebP by hand.
- `finishes/platinum/b3-foil-field.png`: flowing blue-violet foil derived from the approved B3 reference, with all people, numbers, lettering, frame and logos removed. It is not a flattened card.

`PlatinumFoilField.tsx` attaches the field to the player: `lib/portrait/foil.ts` finds the top of each shoulder in the processed portrait's alpha, and each half of the artwork is scaled so its hot node (where its currents converge) lands there. `PlatinumEnergyEmission` then makes the energy come out of the player: the currents nearest the body run hotter and the shoulder edge runs white-hot around each root, never on the head (owner review, 2026-09-26). Transform limits preserve texture quality for extreme shapes. Unreadable external alpha falls back to the authored B3 layout; app-processed local cutouts are the intended input. The portrait itself occludes the background.

`DynamicLayers.tsx` clips the same foil material into live jersey-number text, with separate blue bloom and a bright white core. All text and photos remain editable. The earlier `plasma-flow.png` and `number-foil.png` experiments are historical and no longer referenced by these components.

Approved reference: `design/reference/platinum-b3-outward-approved.png`. Only its number and foil style were selected; preserve existing frame, names, logo, portrait layout and stats. Other finishes need their own artwork.
