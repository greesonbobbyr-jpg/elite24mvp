import { describe, expect, it } from "vitest";
import { parseLoginIdentifier, normalizeUsername } from "../lib/login";

// LOGIN (owner, 2026-10-09: email is the only login):
//   1. Only an email-shaped value is looked up as an email; "@jordan" is the
//      username "jordan", not a failed email lookup.
//   2. A username logs in only an older account that has no email yet (the
//      app then asks for one); once there's an email, only the email works.

describe("parseLoginIdentifier (pure)", () => {
  it("routes email-shaped input to the email column, lowercased", () => {
    expect(parseLoginIdentifier("gary@elite24.demo")).toEqual({ email: "gary@elite24.demo" });
    expect(parseLoginIdentifier("  Gary@Elite24.Demo ")).toEqual({ email: "gary@elite24.demo" });
  });

  it("treats everything else as a username, dropping a leading @", () => {
    expect(parseLoginIdentifier("jordan")).toEqual({ username: "jordan" });
    expect(parseLoginIdentifier(" Jordan ")).toEqual({ username: "jordan" });
    expect(parseLoginIdentifier("@jordan")).toEqual({ username: "jordan" });
    expect(parseLoginIdentifier("@@jordan")).toEqual({ username: "jordan" });
  });

  it("rejects empty input", () => {
    expect(parseLoginIdentifier("")).toBeNull();
    expect(parseLoginIdentifier("   ")).toBeNull();
    expect(parseLoginIdentifier("@")).toBeNull();
  });

  it("normalizes usernames the same way for storage", () => {
    expect(normalizeUsername(" @CoachGary ")).toBe("coachgary");
  });
});

describe("email is the only login", () => {
  it("a username works only for an older account with no email yet", async () => {
    const { loginAllowed } = await import("../lib/login");
    expect(loginAllowed({ email: "a@b.co" }, { email: "a@b.co" })).toBe(true);
    expect(loginAllowed({ username: "jordan" }, { email: null })).toBe(true);
    expect(loginAllowed({ username: "jordan" }, { email: "jordan@example.com" })).toBe(false);
  });
});
