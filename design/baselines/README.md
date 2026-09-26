# Card baselines

Owner-approved card renders. `scripts/shoot-cards.ts --check` pixel-compares fresh shots against these to catch accidental drift. The owner's visual approval is the design authority; these files only record it.

- `master-bronze.png`, `master-silver.png`, `master-gold.png`, `master-platinum.png`, `master-diamond.png`: the master card at every level, approved together on 2026-09-26 ("This looks really good. Let's go with this for now"). Platinum's geometry was locked earlier the same day; it has changed by 0.01% since (its energy texture moved to WebP), and this set records the lineup as approved.

Check (needs the card dev server against the local `e24cards` database):

```
npx tsx scripts/shoot-cards.ts --master --check --url http://localhost:3001
```

Replace a baseline only after the owner approves a new look: shoot with `--out <dir>` and copy the file here.
