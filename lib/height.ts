// Height is stored as total inches (Profile.heightInches); people read and
// type it as feet + inches (owner note: "ft and in instead of only total in").

export function formatHeight(inches: number | null | undefined): string | null {
  if (inches == null) return null;
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

export function splitHeight(
  inches: number | null | undefined,
): { feet: number; inches: number } | null {
  if (inches == null) return null;
  return { feet: Math.floor(inches / 12), inches: inches % 12 };
}

export type HeightResult = { ok: true; inches: number | null } | { ok: false; error: string };

// Both boxes empty = no height. Feet 3–8 (kids start around 4'), inches 0–11;
// an empty inches box with a feet value means an even height (5 ft → 5'0").
export function parseHeight(feetRaw: unknown, inchesRaw: unknown): HeightResult {
  const feetText = String(feetRaw ?? "").trim();
  const inchesText = String(inchesRaw ?? "").trim();
  if (feetText === "" && inchesText === "") return { ok: true, inches: null };

  const feet = Number(feetText);
  const inches = inchesText === "" ? 0 : Number(inchesText);
  if (feetText === "" || !Number.isInteger(feet) || feet < 3 || feet > 8) {
    return { ok: false, error: "Height: enter feet from 3 to 8." };
  }
  if (!Number.isInteger(inches) || inches < 0 || inches > 11) {
    return { ok: false, error: "Height: inches go from 0 to 11." };
  }
  return { ok: true, inches: feet * 12 + inches };
}
