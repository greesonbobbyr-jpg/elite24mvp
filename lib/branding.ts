// Server-side validation for the shared team-branding fields (logo + two colors),
// used by both coach signup and team settings. The logo arrives as a size-capped
// `data:` image URL from TeamBrandingFields (a pasted http(s) URL or a same-origin
// "/asset.png" path is also accepted). Colors must be a #RRGGBB hex — the UI picks
// from the swatch palette, but any valid hex is accepted (brand colors like the
// seeded #c8102e aren't in the fixed palette). Hex-only still blocks arbitrary CSS.
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

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
  // Root-relative same-origin path (e.g. a seeded /mustang-logo.png in public/).
  // Single slash only — reject "//host" (protocol-relative → off-site).
  if (v.startsWith("/") && !v.startsWith("//")) return { url: v };
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
  if (primaryColor && !HEX_COLOR.test(primaryColor)) {
    return { error: "Primary color must be a hex value like #RRGGBB." };
  }
  const secondaryColor = rawSecondary || null;
  if (secondaryColor && !HEX_COLOR.test(secondaryColor)) {
    return { error: "Secondary color must be a hex value like #RRGGBB." };
  }

  return { data: { logoUrl, primaryColor, secondaryColor } };
}
