import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseLoginIdentifier, normalizeUsername } from "../lib/login";

// LOGIN IDENTIFIERS (owner note: "can't use username to login, only email"):
//   1. Only an email-shaped value is looked up as an email; "@jordan" is the
//      username "jordan", not a failed email lookup.
//   2. Staff can claim a username for their own account; it's stored
//      normalized and can't collide with anyone else's.
//
// Same runner contract: localhost-only, self-skips without TEST_DATABASE_URL.

const url = process.env.TEST_DATABASE_URL;
const host = url ? new URL(url).hostname : null;
if (url && host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("TEST_DATABASE_URL must point at localhost — this suite writes.");
}
if (url) process.env.DATABASE_URL = url;

const dbDescribe = url ? describe : describe.skip;

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

dbDescribe("claimUsername + lookup", () => {
  const w = {} as { orgId: number; teamId: number; aId: number; bId: number };

  beforeAll(async () => {
    const { prisma } = await import("../lib/prisma");
    const org = await prisma.organization.create({ data: { name: "__lg_org__" } });
    const team = await prisma.team.create({
      data: { name: "__lg_team__", organizationId: org.id, joinCode: "LGIN01" },
    });
    const a = await prisma.user.create({
      data: { name: "__lg_a__", email: "__lg_a__@example.test", role: "COACH", teamId: team.id },
    });
    const b = await prisma.user.create({
      data: {
        name: "__lg_b__",
        email: "__lg_b__@example.test",
        role: "COACH",
        teamId: team.id,
        username: "__lg_taken",
      },
    });
    Object.assign(w, { orgId: org.id, teamId: team.id, aId: a.id, bId: b.id });
  });

  afterAll(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.user.deleteMany({ where: { id: { in: [w.aId, w.bId] } } });
    await prisma.team.deleteMany({ where: { id: w.teamId } });
    await prisma.organization.deleteMany({ where: { id: w.orgId } });
    await prisma.$disconnect();
  });

  it("stores a valid username normalized, and login finds it with or without @", async () => {
    const { prisma } = await import("../lib/prisma");
    const { claimUsername } = await import("../lib/login");
    const result = await claimUsername(w.aId, " @__LG_Coach ");
    expect(result).toEqual({ ok: true, username: "__lg_coach" });

    for (const typed of ["__lg_coach", "@__lg_coach", "__LG_COACH"]) {
      const found = await prisma.user.findUnique({ where: parseLoginIdentifier(typed)! });
      expect(found?.id).toBe(w.aId);
    }
  });

  it("refuses someone else's username and invalid ones; re-saving your own is fine", async () => {
    const { claimUsername } = await import("../lib/login");
    expect(await claimUsername(w.aId, "__lg_taken")).toMatchObject({ ok: false });
    expect(await claimUsername(w.aId, "no spaces")).toMatchObject({ ok: false });
    expect(await claimUsername(w.aId, "ab")).toMatchObject({ ok: false });
    expect(await claimUsername(w.bId, "__lg_taken")).toEqual({ ok: true, username: "__lg_taken" });
  });
});
