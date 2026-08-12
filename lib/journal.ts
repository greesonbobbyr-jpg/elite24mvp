// Day keys are timezone-aware (lib/daykey) — re-exported here so the many
// existing `import { todayKey } from "@/lib/journal"` call sites keep working.
// Journal DATA ACCESS lives exclusively in lib/data/reflections.ts (author-only
// module; build-enforced by scripts/check-reflections-boundary.mjs).
import { todayKey } from "./daykey";
export { todayKey };
