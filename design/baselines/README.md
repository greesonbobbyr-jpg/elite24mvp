# Card baselines

Owner-approved card renders. `scripts/shoot-cards.ts --check` pixel-compares fresh shots against these to catch accidental drift. The owner's visual approval is the design authority; these files only record it.

- `master-platinum.png`: the Platinum master, approved 2026-09-26 (geometry locked).

Check (needs the card dev server against the local `e24cards` database):

```
npx tsx scripts/shoot-cards.ts --master --check --url http://localhost:3001
```

Replace a baseline only after the owner approves a new look: shoot with `--out <dir>` and copy the file here.
