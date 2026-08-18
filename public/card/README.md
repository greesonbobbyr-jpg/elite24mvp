# public/card — authored Player Card art (the PRODUCTION ASSET CONTRACT)

The Full Player Card is a deterministic layered compositor (Plan v4 §4.5).
The physical collectible-card artwork is SUPPLIED here as authored assets;
engineering never recreates it with CSS/SVG. The typed contract lives in
`lib/cardAssets.ts` — this file is the human-readable drop-zone guide.

Missing asset → the layer renders an explicit **ASSET MISSING** state and
stops. Nothing is approximated.

## Layout

```
public/card/
  finishes/
    platinum/            ← Platinum first (the geometric master)
      chassis.webp       layer 16  the physical frame + stat-rail/footer chassis (alpha)
      background.webp    layer 15  face-window environment material (alpha outside)
      chassis-fg.webp    layer 10  frame pieces that sit IN FRONT of the player (alpha)
    bronze/ silver/ gold/ diamond/   ← only AFTER GEOMETRY LOCKED, same three files
  masks/                 ← shared, grayscale, luminance-driven
    occlusion.webp       layer 12  contact-shadow map (multiply)         optional
    highlight.webp       layer  3  bevel specular map (screen)           optional
    foil.webp            layer  2  where prismatic foil may appear       REQUIRED
    reflection.webp      layer  1  where the tilt sheen may land         REQUIRED
  atmosphere.webp        layer 12  neutral particle/energy texture       optional
```

## Global rules

- **Canvas:** every file is FULL-CANVAS on the 1000×1500 master, delivered at
  exactly **2000×3000 px** (2×). Positioned `inset:0`; the only geometry is
  inside the pixels — never crop to content.
- **Alpha:** straight (non-premultiplied) alpha, sRGB. Art layers: transparent
  where the contract says; masks: OPAQUE grayscale (luminance drives them).
- **Format:** WebP (lossy q≈85 for photographic/opaque, lossless for crisp
  alpha edges). Filenames are fixed as `.webp`; if PNG is easier to author, deliver PNG and it will be converted to the `.webp` name at drop-in.
- **No dynamic content baked in:** no player, number, names, stats, stars,
  PROSPECT/TIER text, ELITE24MVP wordmark, team logo, Player ID.
- **Top-right stays empty** in the art.
- **Finish owns material, team owns environment:** never bake team color.

See `lib/cardAssets.ts` for the per-asset contract (contents, exclusions,
foil/reflection participation, above/below player, technical requirements).
