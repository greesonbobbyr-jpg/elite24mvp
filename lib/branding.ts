import { isTeamColor } from "./teamColors";

// Server-side validation for the shared team-branding fields (logo + two colors),
// used by both coach signup and team settings. The logo arrives as a size-capped
// `data:` image URL from TeamBrandingFields (a pasted http(s) URL is also accepted
// for back-compat). Colors must be known palette values — never arbitrary CSS.

const IMAGE_DATA_RE = /^data:image\/(png|jpe?g|webp|gif);base64,/i;
const MAX_IMAGE_BYTES = 300 * 1024; // a little above the client-side cap

export type Branding = {
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
};

function dataUrlBytes(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.floor((b64.length * 3) / 4);
}

// Server re-validation for an uploaded image field: a `data:image` under the byte
// cap, or a pasted http(s) URL (back-compat), or empty → null. Shared by team
// branding (logo) and the player photo. `label` personalizes the error text.
export function validateImageDataUrl(
  raw: string,
  label = "image",
): { url: string | null } | { error: string } {
  const v = raw.trim();
  if (!v) return { url: null };
  if (v.startsWith("data:")) {
    if (!IMAGE_DATA_RE.test(v)) return { error: `That ${label} isn't supported.` };
    if (dataUrlBytes(v) > MAX_IMAGE_BYTES) return { error: `That ${label} is too large.` };
    return { url: v };
  }
  if (/^https?:\/\//i.test(v)) return { url: v }; // pasted URL still allowed
  return { error: `That ${label} isn't a valid image.` };
}

export function readBranding(
  formData: FormData,
): { data: Branding } | { error: string } {
  const rawLogo = String(formData.get("logoUrl") ?? "").trim();
  const rawPrimary = String(formData.get("primaryColor") ?? "").trim();
  const rawSecondary = String(formData.get("secondaryColor") ?? "").trim();

  const logoRes = validateImageDataUrl(rawLogo, "logo image");
  if ("error" in logoRes) return { error: logoRes.error };
  const logoUrl = logoRes.url;

  const primaryColor = rawPrimary || null;
  if (primaryColor && !isTeamColor(primaryColor)) {
    return { error: "Pick a primary color from the palette." };
  }
  const secondaryColor = rawSecondary || null;
  if (secondaryColor && !isTeamColor(secondaryColor)) {
    return { error: "Pick a secondary color from the palette." };
  }

  return { data: { logoUrl, primaryColor, secondaryColor } };
}
