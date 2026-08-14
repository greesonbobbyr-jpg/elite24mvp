import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { Gallery } from "./gallery";

// CARD SYSTEM PREVIEW (Stage 2) — the visual loop's workbench. Renders the 9
// dev environments (5 player finishes + 4 staff roles) with reference-overlay
// mode. DEV-ONLY: production builds 404 (closes the shipped-sandbox audit
// finding — the old page was login-gated but reachable in prod).
//
// Query params (used by scripts/shoot-cards.ts):
//   ?overlay=50   initial overlay opacity for every card (0/25/50/75/100)
//   ?static=1     freeze dynamic finish motion for regression baselines (Δ11)
export default async function CardPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ overlay?: string; static?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const params = await searchParams;
  const initialOverlay = Number.parseInt(params.overlay ?? "0", 10) || 0;
  const isStatic = params.static === "1";

  // List the approved reference images (design/reference/, outside public/).
  let refs: string[] = [];
  try {
    const entries = await readdir(join(process.cwd(), "design", "reference"));
    refs = entries
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    // No reference folder yet — the gallery renders without overlay mode.
  }

  return <Gallery refs={refs} initialOverlay={initialOverlay} isStatic={isStatic} />;
}
