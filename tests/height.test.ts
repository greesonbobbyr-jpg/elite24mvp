import { describe, expect, it } from "vitest";
import { formatHeight, parseHeight, splitHeight } from "../lib/height";

// HEIGHT IN FEET + INCHES (owner note): entered as two boxes, stored as total
// inches, shown as 5'8".

describe("parseHeight", () => {
  it("combines feet and inches into total inches", () => {
    expect(parseHeight("5", "8")).toEqual({ ok: true, inches: 68 });
    expect(parseHeight(" 6 ", "0")).toEqual({ ok: true, inches: 72 });
    expect(parseHeight("4", "11")).toEqual({ ok: true, inches: 59 });
  });

  it("treats an empty inches box as an even height", () => {
    expect(parseHeight("6", "")).toEqual({ ok: true, inches: 72 });
  });

  it("leaves height unset when both boxes are empty", () => {
    expect(parseHeight("", "")).toEqual({ ok: true, inches: null });
    expect(parseHeight(null, undefined)).toEqual({ ok: true, inches: null });
  });

  it("rejects out-of-range or partial values with a clear message", () => {
    expect(parseHeight("", "8")).toMatchObject({ ok: false });
    expect(parseHeight("2", "0")).toMatchObject({ ok: false });
    expect(parseHeight("9", "0")).toMatchObject({ ok: false });
    expect(parseHeight("5", "12")).toMatchObject({ ok: false });
    expect(parseHeight("5.5", "0")).toMatchObject({ ok: false });
    expect(parseHeight("68", "")).toMatchObject({ ok: false }); // old total-inches habit
  });
});

describe("formatHeight / splitHeight", () => {
  it("round-trips stored inches", () => {
    expect(formatHeight(68)).toBe(`5'8"`);
    expect(formatHeight(72)).toBe(`6'0"`);
    expect(formatHeight(null)).toBeNull();
    expect(splitHeight(76)).toEqual({ feet: 6, inches: 4 });
    expect(splitHeight(undefined)).toBeNull();
  });
});
