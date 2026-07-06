import { isTeamColor } from "./teamColors";

// Server-side validation for the shared team-branding fields (logo + two colors),
// used by both coach signup and team settings. The logo arrives as a size-capped
// `data:` image URL from TeamBrandingFields (a pasted http(s) URL is also accepted
// for back-compat). Colors must be known palette values — never arbitrary CSS.

const LOGO_DATA_RE = /^data:image\/(png|jpe?g|webp|gif);base64,/i;
const MAX_LOGO_BYTES = 300 * 1024; // a little above the client-side cap

export type Branding = {
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
};

function dataUrlBytes(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.floor((b64.length * 3) / 4);
}

export function readBranding(
  formData: FormData,
): { data: Branding } | { error: string } {
  const rawLogo = String(formData.get("logoUrl") ?? "").trim();
  const rawPrimary = String(formData.get("primaryColor") ?? "").trim();
  const rawSecondary = String(formData.get("secondaryColor") ?? "").trim();

  let logoUrl: string | null = null;
  if (rawLogo) {
    if (rawLogo.startsWith("data:")) {
      if (!LOGO_DATA_RE.test(rawLogo)) {
        return { error: "That logo image isn't supported." };
      }
      if (dataUrlBytes(rawLogo) > MAX_LOGO_BYTES) {
        return { error: "That logo image is too large." };
      }
      logoUrl = rawLogo;
    } else if (/^https?:\/\//i.test(rawLogo)) {
      logoUrl = rawLogo; // pasted URL still allowed
    } else {
      return { error: "That logo isn't a valid image." };
    }
  }

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
