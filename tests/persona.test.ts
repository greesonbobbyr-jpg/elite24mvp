import { describe, expect, it } from "vitest";
import { isPlayerSide, isStaffSide, personaOf, type PersonaCtx } from "../lib/persona";
import { chromeFor } from "../lib/nav";

// What someone sees comes from their team roles, not the login's fixed role
// (person-first plan, 2026-10-09).

const base = { membership: null, orgAdminOf: [] as number[] };
const membership = (role: string) => ({ role }) as unknown as PersonaCtx["membership"];
const setUp = { setupCompletedAt: new Date() };

describe("personaOf", () => {
  it("the acting membership decides: PLAYER → athlete, any staff role → staff", () => {
    expect(personaOf({ ...base, membership: membership("PLAYER"), user: { role: "PLAYER" }, profile: setUp })).toBe("athlete");
    for (const role of ["HEAD_COACH", "ASSISTANT_COACH", "GENERAL_MANAGER"]) {
      expect(personaOf({ ...base, membership: membership(role), user: { role: "COACH" }, profile: setUp })).toBe("staff");
    }
  });

  it("the login role never overrides the team role (a player who coaches elsewhere)", () => {
    expect(personaOf({ ...base, membership: membership("HEAD_COACH"), user: { role: "PLAYER" }, profile: setUp })).toBe("staff");
    expect(personaOf({ ...base, membership: membership("PLAYER"), user: { role: "COACH" }, profile: setUp })).toBe("athlete");
  });

  it("no team: org admin → admin; set up → personal; not yet → new", () => {
    expect(personaOf({ ...base, orgAdminOf: [3], user: { role: "COACH" }, profile: setUp })).toBe("admin");
    expect(personaOf({ ...base, user: { role: "PLAYER" }, profile: setUp })).toBe("personal");
    expect(personaOf({ ...base, user: { role: "PLAYER" }, profile: { setupCompletedAt: null } })).toBe("new");
  });

  it("pre-backfill login (no Profile): the legacy role, until Stage 6", () => {
    expect(personaOf({ ...base, user: { role: "COACH" }, profile: null })).toBe("staff");
    expect(personaOf({ ...base, user: { role: "PLAYER" }, profile: null })).toBe("athlete");
  });

  it("sides", () => {
    expect(["staff", "admin"].every((p) => isStaffSide(p as never))).toBe(true);
    expect(["athlete", "personal"].every((p) => isPlayerSide(p as never))).toBe(true);
    expect(isStaffSide("personal")).toBe(false);
    expect(isPlayerSide("new")).toBe(false);
  });
});

describe("chromeFor", () => {
  const opts = { userId: 7, unread: 0, isOrgAdmin: false };
  it("a personal athlete gets no team surfaces", () => {
    const { links, tabs } = chromeFor("personal", opts);
    expect(tabs).toBe("player-solo");
    expect(links.map((l) => l.href)).toEqual(["/brand/7", "/journal", "/notifications", "/library"]);
  });

  it("Organization View shows only for org and group admins", () => {
    expect(chromeFor("staff", opts).links.map((l) => l.label)).not.toContain("Organization View");
    expect(chromeFor("admin", { ...opts, isOrgAdmin: true }).links.map((l) => l.label)).toContain("Organization View");
  });

  it("an athlete's Notifications link carries the unread count", () => {
    const links = chromeFor("athlete", { ...opts, unread: 3 }).links;
    expect(links.find((l) => l.href === "/notifications")?.label).toBe("Notifications (3)");
  });

  it("not set up yet: nothing", () => {
    expect(chromeFor("new", opts)).toEqual({ links: [], tabs: null });
  });
});
