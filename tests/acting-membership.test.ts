import { describe, expect, it } from "vitest";
import { pickActingMembership } from "../lib/context";

// The acting-membership cookie is a HINT, never an authority — everything
// stale, foreign, or garbled must fall back to the most recent membership.

const older = { id: 1, startedAt: new Date("2026-01-01") };
const newer = { id: 2, startedAt: new Date("2026-06-01") };

describe("pickActingMembership", () => {
  it("no memberships → null", () => {
    expect(pickActingMembership([], "1")).toBeNull();
  });

  it("exactly one → implicit, cookie ignored entirely", () => {
    expect(pickActingMembership([older], null)).toBe(older);
    expect(pickActingMembership([older], "999")).toBe(older);
  });

  it("2+ with a valid cookie → the hinted membership", () => {
    expect(pickActingMembership([older, newer], "1")).toBe(older);
  });

  it("2+ with a stale/foreign cookie id → most recent", () => {
    expect(pickActingMembership([older, newer], "999")).toBe(newer);
  });

  it("2+ with a missing or garbled cookie → most recent", () => {
    expect(pickActingMembership([older, newer], null)).toBe(newer);
    expect(pickActingMembership([older, newer], undefined)).toBe(newer);
    expect(pickActingMembership([older, newer], "abc")).toBe(newer);
    expect(pickActingMembership([older, newer], "1.5")).toBe(newer);
  });

  it("startedAt tie breaks by higher id (deterministic)", () => {
    const a = { id: 3, startedAt: new Date("2026-06-01") };
    expect(pickActingMembership([newer, a], null)).toBe(a);
  });
});
