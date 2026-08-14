import { describe, expect, it } from "vitest";
import {
  validateCutoutDataUrl,
  parsePhotoMeta,
  MAX_CUTOUT_IMAGE_BYTES,
} from "../lib/branding";

// CARD REDESIGN Stage 9 — server re-validation for the cutout pipeline. The
// client enforces Δ5 (a failed upload submits nothing); the server never
// trusts that and re-validates whatever arrives.

function dataUrl(mime: string, bytes: number): string {
  return `data:${mime};base64,${"A".repeat(Math.ceil((bytes * 4) / 3))}`;
}

describe("validateCutoutDataUrl", () => {
  it("accepts alpha-capable formats under the cap; empty clears", () => {
    expect(validateCutoutDataUrl("")).toEqual({ url: null });
    for (const mime of ["image/png", "image/webp"]) {
      const v = dataUrl(mime, 1000);
      expect(validateCutoutDataUrl(v)).toEqual({ url: v });
    }
  });

  it("rejects non-alpha formats (a cutout IS transparency)", () => {
    expect("error" in validateCutoutDataUrl(dataUrl("image/jpeg", 1000))).toBe(true);
    expect("error" in validateCutoutDataUrl(dataUrl("image/gif", 1000))).toBe(true);
  });

  it("enforces the byte cap", () => {
    expect(
      "error" in validateCutoutDataUrl(dataUrl("image/png", MAX_CUTOUT_IMAGE_BYTES + 1024)),
    ).toBe(true);
  });

  it("passes through https and same-origin paths; blocks protocol-relative", () => {
    expect(validateCutoutDataUrl("https://x.test/cut.png")).toEqual({
      url: "https://x.test/cut.png",
    });
    expect(validateCutoutDataUrl("/api/photo/1?cut=1")).toEqual({
      url: "/api/photo/1?cut=1",
    });
    expect("error" in validateCutoutDataUrl("//evil.test/cut.png")).toBe(true);
  });
});

describe("parsePhotoMeta", () => {
  it("accepts the v2 shape and returns the object", () => {
    const meta = { version: 2, scale: 0.0006, tx: 0.1, ty: 0.05, srcW: 700 };
    expect(parsePhotoMeta(JSON.stringify(meta))).toEqual(meta);
  });

  it("rejects junk: non-JSON, arrays, missing version, oversized", () => {
    expect(parsePhotoMeta("")).toBeNull();
    expect(parsePhotoMeta("not json")).toBeNull();
    expect(parsePhotoMeta("[1,2]")).toBeNull();
    expect(parsePhotoMeta('{"scale":1}')).toBeNull();
    expect(parsePhotoMeta(`{"version":2,"pad":"${"x".repeat(4000)}"}`)).toBeNull();
  });
});
