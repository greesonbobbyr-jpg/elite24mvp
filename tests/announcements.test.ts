import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { Viewer } from "../lib/announcements";
import { expiryText, toLabel } from "../lib/announcement-view";
import { cleanJpeg } from "../lib/jpeg";

// ANNOUNCEMENTS (person-first plan Phase 5): who sees what, worked out when
// read; pictures cleaned on the server and served only to their audience;
// disappearing ones take their pictures with them.
//
// Same runner contract: localhost-only, DB part self-skips without
// TEST_DATABASE_URL (run it on a freshly seeded e24local).

const url = process.env.TEST_DATABASE_URL;
const host = url ? new URL(url).hostname : null;
if (url && host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("TEST_DATABASE_URL must point at localhost — this suite writes.");
}
if (url) process.env.DATABASE_URL = url;
const dbDescribe = url ? describe : describe.skip;
// Imported after DATABASE_URL is set: the module brings the Prisma client.
const { audienceIncludes, cleanLink, rolesIn } = await import("../lib/announcements");

const long = new Date("2020-01-01");
const viewer = (over: Partial<Viewer>): Viewer => ({
  profileId: 1,
  since: long,
  solo: false,
  ceo: false,
  teams: [],
  orgAdminOf: [],
  groupAdminOf: [],
  ...over,
});
// Org 1: Boys (10) → 17U (11) holds team 100; Girls (20) → 15U (21) holds team 200.
const boysPlayer = viewer({ teams: [{ teamId: 100, orgId: 1, path: [10, 11], player: true, since: long }] });
const girlsCoach = viewer({ teams: [{ teamId: 200, orgId: 1, path: [20, 21], player: false, since: long }] });
const girlsAdmin = viewer({ groupAdminOf: [{ orgId: 1, path: [20] }] });
const orgAdmin = viewer({ orgAdminOf: [1] });
const solo = viewer({ solo: true });
const outsider = viewer({ teams: [{ teamId: 900, orgId: 9, path: [], player: true, since: long }] });

const sees = (v: Viewer, a: Parameters<typeof rolesIn>[1] & { audience: "EVERYONE" | "PLAYERS" | "STAFF" }) =>
  audienceIncludes(a.audience, rolesIn(v, a));
const at = { organizationId: 1, groupId: null, teamId: null };

describe("who sees an announcement", () => {
  it("everyone on Elite24: every account, solo athletes included", () => {
    const a = { scope: "PLATFORM" as const, organizationId: null, groupId: null, teamId: null, audience: "EVERYONE" as const };
    for (const v of [boysPlayer, girlsCoach, girlsAdmin, orgAdmin, solo, outsider]) expect(sees(v, a)).toBe(true);
    expect(sees(solo, { ...a, audience: "STAFF" })).toBe(false);
    expect(sees(orgAdmin, { ...a, audience: "PLAYERS" })).toBe(false);
  });

  it("an organization: its teams and admins — nobody from another org", () => {
    const a = { scope: "ORG" as const, ...at, audience: "EVERYONE" as const };
    for (const v of [boysPlayer, girlsCoach, girlsAdmin, orgAdmin]) expect(sees(v, a)).toBe(true);
    for (const v of [solo, outsider]) expect(sees(v, a)).toBe(false);
  });

  it("a group: teams under it and admins over it — not the other branch", () => {
    const girls = { scope: "GROUP" as const, ...at, groupId: 20, targetPath: [20], audience: "EVERYONE" as const };
    expect(sees(girlsCoach, girls)).toBe(true);
    expect(sees(girlsAdmin, girls)).toBe(true);
    expect(sees(orgAdmin, girls)).toBe(true);
    expect(sees(boysPlayer, girls)).toBe(false);
    expect(sees(outsider, girls)).toBe(false);
  });

  it("a team, narrowed by audience", () => {
    const team = { scope: "TEAM" as const, ...at, teamId: 200, targetPath: [20, 21] };
    expect(sees(girlsCoach, { ...team, audience: "STAFF" })).toBe(true);
    expect(sees(girlsCoach, { ...team, audience: "PLAYERS" })).toBe(false);
    expect(sees(girlsAdmin, { ...team, audience: "STAFF" })).toBe(true);
    expect(sees(boysPlayer, { ...team, audience: "EVERYONE" })).toBe(false);
  });

  it("counts from when you joined the place", () => {
    const joined = new Date("2026-10-01");
    const v = viewer({ teams: [{ teamId: 100, orgId: 1, path: [10, 11], player: true, since: joined }] });
    expect(rolesIn(v, { scope: "TEAM", ...at, teamId: 100, targetPath: [10, 11] }).since).toEqual(joined);
  });
});

describe("links and labels", () => {
  it("video links: YouTube, Vimeo or Hudl over https — nothing else", () => {
    expect(cleanLink("")).toEqual({ ok: true, url: null });
    expect(cleanLink("https://youtu.be/abc")).toEqual({ ok: true, url: "https://youtu.be/abc" });
    expect(cleanLink("https://www.hudl.com/video/1").ok).toBe(true);
    for (const bad of ["http://youtube.com/x", "https://evil.example/youtube.com", "javascript:alert(1)", "https://youtube.com.evil.io/"]) {
      expect(cleanLink(bad).ok, bad).toBe(false);
    }
  });

  it("disappearing time and who it's to", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    expect(expiryText(null, now)).toBeNull();
    expect(expiryText(new Date("2026-10-10T17:30:00Z"), now)).toBe("Disappears in 5h");
    expect(expiryText(new Date("2026-10-17T12:00:00Z"), now)).toBe("Disappears in 7 days");
    expect(toLabel({ scope: "PLATFORM", audience: "EVERYONE" }, null)).toBe("everyone on Elite24MVP");
    expect(toLabel({ scope: "TEAM", audience: "PLAYERS" }, "17U Boys")).toBe("Players · 17U Boys");
  });
});

describe("pictures are cleaned on the server", () => {
  const poster = readFileSync(join(__dirname, "..", "prisma", "seed-assets", "poster-tournament.jpg"));
  // A camera-style APP1 (EXIF) segment carrying a GPS marker.
  const exifData = Buffer.from("Exif\0\0GPS-35.4676");
  const exif = Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, exifData.length + 2]), exifData]);
  const withExif = Buffer.concat([poster.subarray(0, 2), exif, poster.subarray(2)]);

  it("strips EXIF (location) and keeps the picture", () => {
    expect(withExif.includes("GPS-35.4676")).toBe(true);
    const clean = cleanJpeg(withExif)!;
    expect(clean).not.toBeNull();
    expect(clean.bytes.includes("GPS-35.4676")).toBe(false);
    expect(clean.bytes.includes("Exif")).toBe(false);
    expect({ w: clean.width, h: clean.height }).toEqual({ w: 1000, h: 750 });
    expect(clean.bytes.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]));
  });

  it("strips metadata hidden after the image data too", () => {
    const end = withExif.length - 2; // before EOI
    const late = Buffer.concat([withExif.subarray(0, end), Buffer.from([0xff, 0xfe, 0x00, 0x08]), Buffer.from("SECRET"), withExif.subarray(end)]);
    const clean = cleanJpeg(late)!;
    expect(clean.bytes.includes("SECRET")).toBe(false);
  });

  it("refuses anything that isn't a well-formed JPEG", () => {
    expect(cleanJpeg(Buffer.from("not a picture"))).toBeNull();
    expect(cleanJpeg(readFileSync(join(__dirname, "..", "public", "logo.png")))).toBeNull();
    expect(cleanJpeg(poster.subarray(0, 400))).toBeNull(); // cut short
  });
});

dbDescribe("announcements on the seeded world", () => {
  const ctxOf = async (email: string) => {
    const { prisma } = await import("../lib/prisma");
    const { resolveContextForUser } = await import("../lib/context");
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return (await resolveContextForUser(user.id, null))!;
  };
  const playerOn = async (team: { joinCode?: string; name?: string }) => {
    const { prisma } = await import("../lib/prisma");
    const m = await prisma.membership.findFirstOrThrow({
      where: { role: "PLAYER", endedAt: null, team, profile: { user: { email: { not: null } } } },
      include: { profile: { include: { user: true } } },
    });
    return ctxOf(m.profile.user!.email!);
  };
  const byTitle = async (title: string) => {
    const { prisma } = await import("../lib/prisma");
    return prisma.announcement.findFirstOrThrow({ where: { title } });
  };

  afterAll(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });

  it("a Varsity player: the CEO's poster (already read) and Mustang's tournament — not staff notes, the Girls, or Lincoln", async () => {
    const { inboxFor, unreadAnnouncements } = await import("../lib/announcements");
    const ctx = await ctxOf("jordan.carter@example.com");
    const inbox = await inboxFor(ctx);
    const titles = inbox.map((a) => a.title).sort();
    expect(titles).toEqual(["Home tournament Saturday", "See it. Say it. Sketch it. Feel it."]);
    expect(inbox.find((a) => a.title.startsWith("See it"))!.read).toBe(true);
    expect(await unreadAnnouncements(ctx)).toBe(1);
    // The disappeared one never shows.
    expect(titles).not.toContain("Yesterday's challenge: 50 makes");
  });

  it("staff and admins see their notes; the Girls group admin sees the Girls note", async () => {
    const { inboxFor } = await import("../lib/announcements");
    const dana = (await inboxFor(await ctxOf("dana@elite24.demo"))).map((a) => a.title);
    expect(dana).toContain("Varsity staff: practice plans due Friday");
    expect(dana).toContain("Coaches: Organization View is live");
    const vince = (await inboxFor(await ctxOf("vince@elite24.demo"))).map((a) => a.title);
    expect(vince).toContain("Coaches: Organization View is live");
    expect(vince).not.toContain("Home tournament Saturday");
    const girlsPlayer = await playerOn({ name: "15U Mustang Girls" });
    expect((await inboxFor(girlsPlayer)).map((a) => a.title)).toContain("Girls: film session Thursday");
  });

  it("a solo athlete gets Elite24 announcements only", async () => {
    const { inboxFor } = await import("../lib/announcements");
    const titles = (await inboxFor(await ctxOf("avery.collins@example.com"))).map((a) => a.title);
    expect(titles).toEqual(["See it. Say it. Sketch it. Feel it."]);
  });

  it("who may send where", async () => {
    const { maySend } = await import("../lib/announcements");
    const { prisma } = await import("../lib/prisma");
    const mustang = await prisma.organization.findFirstOrThrow({ where: { name: "Mustang Broncos" } });
    const girls = await prisma.group.findFirstOrThrow({ where: { organizationId: mustang.id, name: "Girls" } });
    const boys = await prisma.group.findFirstOrThrow({ where: { organizationId: mustang.id, name: "Boys" } });
    const varsity = await prisma.team.findFirstOrThrow({ where: { joinCode: "MUSTNG" } });
    const [ceo, alex, gina, dana, jordan] = await Promise.all(
      ["ceo@elite24.demo", "alex@elite24.demo", "gina@elite24.demo", "dana@elite24.demo", "jordan.carter@example.com"].map(ctxOf),
    );
    expect(await maySend(ceo, { scope: "PLATFORM" })).toBe(true);
    expect(await maySend(alex, { scope: "PLATFORM" })).toBe(false);
    expect(await maySend(alex, { scope: "ORG", organizationId: mustang.id })).toBe(true);
    expect(await maySend(gina, { scope: "GROUP", organizationId: mustang.id, groupId: girls.id })).toBe(true);
    expect(await maySend(gina, { scope: "GROUP", organizationId: mustang.id, groupId: boys.id })).toBe(false);
    expect(await maySend(gina, { scope: "ORG", organizationId: mustang.id })).toBe(false);
    expect(await maySend(gina, { scope: "TEAM", organizationId: mustang.id, teamId: varsity.id })).toBe(false);
    expect(await maySend(dana, { scope: "TEAM", organizationId: mustang.id, teamId: varsity.id })).toBe(false);
    expect(await maySend(jordan, { scope: "TEAM", organizationId: mustang.id, teamId: varsity.id })).toBe(false);
    // A group id from another org is never "inside" this one.
    const lincolnGroup = await prisma.group.findFirstOrThrow({ where: { name: "Lincoln Middle" } });
    expect(await maySend(alex, { scope: "GROUP", organizationId: mustang.id, groupId: lincolnGroup.id })).toBe(false);
    // Even the CEO can't file a place under the wrong organization.
    expect(await maySend(ceo, { scope: "GROUP", organizationId: mustang.id, groupId: lincolnGroup.id })).toBe(false);
    expect(await maySend(ceo, { scope: "GROUP", organizationId: mustang.id, groupId: girls.id })).toBe(true);
    expect(await maySend(ceo, { scope: "ORG", organizationId: 99999999 })).toBe(false);
  });

  it("outsiders can't see or mark another org's announcement; an org never deletes the CEO's", async () => {
    const { canSeeAnnouncement, markRead, mayDelete } = await import("../lib/announcements");
    const tournament = await byTitle("Home tournament Saturday");
    const thunderPlayer = await playerOn({ joinCode: "THUNDR" });
    expect(await canSeeAnnouncement(thunderPlayer, tournament)).toBe(false);
    expect(await markRead(thunderPlayer, tournament.id)).toBe(false);
    // A disappeared announcement is closed to everyone — its sender too.
    expect(await canSeeAnnouncement(await ctxOf("ceo@elite24.demo"), await byTitle("Yesterday's challenge: 50 makes"))).toBe(false);
    const poster = await byTitle("See it. Say it. Sketch it. Feel it.");
    expect(await mayDelete(await ctxOf("alex@elite24.demo"), poster)).toBe(false);
    expect(await mayDelete(await ctxOf("alex@elite24.demo"), tournament)).toBe(true);
    expect(await mayDelete(await ctxOf("ceo@elite24.demo"), tournament)).toBe(true);
  });

  it("seen by X of Y counts only the people it's for; reading moves it", async () => {
    const { seenBy, markRead } = await import("../lib/announcements");
    const { prisma } = await import("../lib/prisma");
    const plans = await byTitle("Varsity staff: practice plans due Friday");
    const before = await seenBy(plans);
    // Varsity staff who were there two days ago: dana and morgan (gary sent
    // it; the org admins' accounts are newer than the note).
    expect(before).toEqual({ seen: 1, of: 2 });
    const morgan = await ctxOf("morgan@elite24.demo");
    expect(await markRead(morgan, plans.id)).toBe(true);
    expect((await seenBy(plans)).seen).toBe(2);
    await prisma.announcementRead.deleteMany({ where: { announcementId: plans.id, profileId: morgan.profile!.id } });
  });

  it("the hourly cleanup deletes disappeared pictures from storage", async () => {
    const { expireMedia } = await import("../lib/announcements");
    const { memoryStore, setMediaStoreForTests } = await import("../lib/mediaStore");
    const { prisma } = await import("../lib/prisma");
    const expired = await byTitle("Yesterday's challenge: 50 makes");
    const asset = await prisma.mediaAsset.findFirstOrThrow({ where: { announcementId: expired.id } });
    const store = memoryStore();
    await store.put(asset.storageKey, Buffer.from([1]), "image/jpeg");
    setMediaStoreForTests(store);
    try {
      const { removed } = await expireMedia();
      expect(removed).toBeGreaterThanOrEqual(1);
      expect(store.keys()).not.toContain(asset.storageKey);
      expect((await prisma.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } })).deletedAt).not.toBeNull();
      // Live announcements keep theirs.
      const live = await prisma.mediaAsset.findFirstOrThrow({ where: { announcement: { title: "Home tournament Saturday" } } });
      expect(live.deletedAt).toBeNull();
    } finally {
      await prisma.mediaAsset.update({ where: { id: asset.id }, data: { deletedAt: null } });
      setMediaStoreForTests(undefined);
    }
  });
});
