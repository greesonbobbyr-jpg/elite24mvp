import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { Gallery } from "./gallery";
import { allAssetsFor } from "@/lib/cardAssets";

// CARD SYSTEM PREVIEW (Stage 2 / v4) — the visual loop's workbench. Renders
// the dev environments with reference-overlay mode, or (?master=1) ONE
// Platinum master at exactly 1000×1500 CSS px for the checkpoint. DEV-ONLY:
// production builds 404.
//
// Query params (used by scripts/shoot-cards.ts):
//   ?overlay=50   initial overlay opacity for every card (0/25/50/75/100)
//   ?static=1     freeze dynamic finish motion + tilt (regression / master)
//   ?master=1     Platinum master render at 1000×1500 with crop-aligned overlay
export default async function CardPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ overlay?: string; static?: string; master?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const params = await searchParams;
  const initialOverlay = Number.parseInt(params.overlay ?? "0", 10) || 0;
  const isStatic = params.static === "1";
  const isMaster = params.master === "1";

  // Approved reference images from both drop zones (outside public/).
  const refs = new Set<string>();
  for (const dir of [
    join(process.cwd(), "design-reference", "elite24mvp-player-card"),
    join(process.cwd(), "design", "reference"),
  ]) {
    try {
      for (const f of await readdir(dir)) if (/\.(png|jpe?g|webp)$/i.test(f)) refs.add(f);
    } catch {
      // folder absent — fine
    }
  }

  // Asset-contract status for the Platinum master (server fs, dev only): the
  // gallery lists exactly which authored files are still missing.
  const missing: string[] = [];
  for (const spec of allAssetsFor("platinum")) {
    const abs = join(process.cwd(), "public", spec.file);
    try {
      await readdir(join(abs, ".."));
      const dirFiles = await readdir(join(abs, ".."));
      if (!dirFiles.includes(spec.file.split("/").pop()!)) missing.push(spec.file);
    } catch {
      missing.push(spec.file);
    }
  }

  return (
    <Gallery
      refs={[...refs].sort((a, b) => a.localeCompare(b))}
      initialOverlay={initialOverlay}
      isStatic={isStatic}
      isMaster={isMaster}
      missingAssets={missing}
    />
  );
}
