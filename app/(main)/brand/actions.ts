"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isOnboarded } from "@/lib/onboarding";
import { validateImageDataUrl } from "@/lib/branding";
import { storeImage } from "@/lib/photoStore";

export type BrandState = { error?: string };

function optionalString(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}
function optionalInt(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? "").trim();
  if (s === "") return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}
function optionalFloat(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? "").trim();
  if (s === "") return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// Edits the CURRENT user's OWN profile only — a player can never edit anyone
// else's brand (we always use user.id, never a target id from the page).
export async function updateBrand(
  _prevState: BrandState,
  formData: FormData,
): Promise<BrandState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "PLAYER" || !isOnboarded(user)) {
    return { error: "Only the player can edit their own profile." };
  }

  // Highlight is a PASTED LINK only. Empty clears it; otherwise it must be a
  // valid http(s) URL (no upload/hosting, CLAUDE.md section 5).
  let highlightUrl: string | null = null;
  const rawHighlight = optionalString(formData.get("highlightUrl"));
  if (rawHighlight) {
    let parsed: URL | null = null;
    try {
      parsed = new URL(rawHighlight);
    } catch {
      parsed = null;
    }
    if (
      !parsed ||
      (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    ) {
      return { error: "Enter a valid link starting with http:// or https://" };
    }
    highlightUrl = parsed.toString();
  }

  // Player photo: an uploaded, size-capped data: image (same validation as the
  // team logo). Empty clears it to null. Owner-only — we always write user.id.
  const photoRes = validateImageDataUrl(
    String(formData.get("photoUrl") ?? ""),
    "photo",
  );
  if ("error" in photoRes) return { error: photoRes.error };
  // Offload to Supabase Storage when configured (no-op passthrough otherwise).
  const storedPhoto = photoRes.url
    ? await storeImage(photoRes.url, `players/${user.id}`)
    : null;

  await prisma.playerProfile.update({
    where: { userId: user.id },
    data: {
      heightInches: optionalInt(formData.get("heightInches")),
      position: optionalString(formData.get("position")),
      jerseyNumber: optionalInt(formData.get("jerseyNumber")),
      pointsPerGame: optionalFloat(formData.get("pointsPerGame")),
      reboundsPerGame: optionalFloat(formData.get("reboundsPerGame")),
      assistsPerGame: optionalFloat(formData.get("assistsPerGame")),
      favoritePlayer: optionalString(formData.get("favoritePlayer")),
      favoriteTeam: optionalString(formData.get("favoriteTeam")),
      highlightUrl,
      photoUrl: storedPhoto,
    },
  });

  // The photo shows on the card across surfaces — refresh them too.
  revalidatePath(`/brand/${user.id}`);
  revalidatePath("/");
  revalidatePath("/leaderboard");
  revalidatePath("/board");
  return {};
}
