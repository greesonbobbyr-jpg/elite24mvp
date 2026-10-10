import { describe, expect, it } from "vitest";
import { isPlayerSide, isStaffSide, personaOf, type PersonaCtx } from "../lib/persona";
import { chromeFor } from "../lib/nav";

// What someone sees comes from their team roles — the login carries no role
// (person-first plan, 2026-10-09).

const base = { membership: null, orgAdminOf: [] as number[] };
const membership = (role: string) => ({ role }) as unknown as PersonaCtx["membership"];
const setUp = { setupCompletedAt: new Date() };

describe("personaOf", () => {
  it("the acting membership decides: PLAYER → athlete, any staff role → staff", () => {
    expect(personaOf({ ...base, membership: membership("PLAYER"), profile: setUp })).toBe("athlete");
    for (const role of ["HEAD_COACH", "ASSISTANT_COACH", "GENERAL_MANAGER"]) {
      expect(personaOf({ ...base, membership: membership(role), profile: setUp })).toBe("staff");
    }
  });

  it("the team role wins over an admin grant or the CEO grant while acting on a team", () => {
    expect(personaOf({ ...base, membership: membership("PLAYER"), orgAdminOf: [3], profile: setUp })).toBe("athlete");
    expect(personaOf({ ...base, membership: membership("HEAD_COACH"), platformRole: "CEO", profile: setUp })).toBe("staff");
  });

  it("no team: the CEO → ceo; an org or group admin → admin; set up → personal; not yet → new", () => {
    expect(personaOf({ ...base, platformRole: "CEO", profile: setUp })).toBe("ceo");
    expect(personaOf({ ...base, orgAdminOf: [3], profile: setUp })).toBe("admin");
    expect(personaOf({ ...base, groupAdminOf: [{ organizationId: 3, groupId: 9 }], profile: setUp })).toBe("admin");
    expect(personaOf({ ...base, profile: setUp })).toBe("personal");
    expect(personaOf({ ...base, profile: { setupCompletedAt: null } })).toBe("new");
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
