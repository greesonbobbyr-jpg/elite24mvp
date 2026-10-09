import type { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { todayKey } from "../daykey";
import { starProgress } from "../cardTheme";
import {
  checkInCountForPlayer,
  checkInCountOnDay,
  checkInTimesForUsers,
  reviewCountForPlayer,
} from "./reflections";

// CEO VIEW reads (owner, 2026-10-09). Gary Harper — the CEO — sees every
// organization, team, coach and player: everything EXCEPT a player's journal
// and reflections (check-in text, Pro Review answers, Mindset takeaways).
// Every read here names its fields explicitly (`select`, never a bare
// include), and check-in/review activity comes only as counts and times from
// lib/data/reflections. tests/ceo.test.ts holds this file to that.
//
// Callers gate on ctx.platformRole === "CEO" (app/(main)/ceo/layout.tsx), and
// each detail view writes an AuditEvent so the organization can see what was
// opened.

const ACTIVE = { endedAt: null, season: { isCurrent: true } } as const;
const STAFF_ROLES: Role[] = ["HEAD_COACH", "ASSISTANT_COACH", "GENERAL_MANAGER"];

export async function ceoOverview() {
  const [organizations, teams, players, staff, checkedInToday, noTeam, noEmail] = await Promise.all([
    prisma.organization.count(),
    prisma.team.count(),
    prisma.profile.count({ where: { memberships: { some: { ...ACTIVE, role: "PLAYER" } } } }),
    prisma.profile.count({ where: { memberships: { some: { ...ACTIVE, role: { in: STAFF_ROLES } } } } }),
    checkInCountOnDay(todayKey()),
    prisma.profile.count({
      where: {
        userId: { not: null },
        setupCompletedAt: { not: null },
        memberships: { none: ACTIVE },
        roleAssignments: { none: { revokedAt: null } },
        platformGrants: { none: { revokedAt: null } },
      },
    }),
    prisma.user.count({ where: { email: null } }),
  ]);
  return { organizations, teams, players, staff, checkedInToday, noTeam, noEmail };
}

export async function listOrganizations(q = "") {
  const orgs = await prisma.organization.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      teams: {
        select: {
          logoUrl: true,
          memberships: { where: ACTIVE, select: { role: true } },
        },
      },
    },
  });
  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    createdAt: o.createdAt,
    logoUrl: o.teams.find((t) => t.logoUrl)?.logoUrl ?? null,
    teams: o.teams.length,
    players: o.teams.reduce((n, t) => n + t.memberships.filter((m) => m.role === "PLAYER").length, 0),
    staff: o.teams.reduce((n, t) => n + t.memberships.filter((m) => m.role !== "PLAYER").length, 0),
  }));
}

export async function orgDetail(orgId: number) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      roleAssignments: {
        where: { role: "ORG_ADMIN", revokedAt: null },
        select: { profile: { select: { id: true, name: true } } },
      },
      teams: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          logoUrl: true,
          memberships: {
            where: ACTIVE,
            select: { role: true, profile: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });
  if (!org) return null;
  return {
    id: org.id,
    name: org.name,
    createdAt: org.createdAt,
    admins: org.roleAssignments.map((r) => r.profile),
    teams: org.teams.map((t) => ({
      id: t.id,
      name: t.name,
      logoUrl: t.logoUrl,
      headCoaches: t.memberships.filter((m) => m.role === "HEAD_COACH").map((m) => m.profile.name),
      players: t.memberships.filter((m) => m.role === "PLAYER").length,
      staff: t.memberships.filter((m) => m.role !== "PLAYER").length,
    })),
  };
}

export async function teamDetail(teamId: number) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      primaryColor: true,
      secondaryColor: true,
      organization: { select: { id: true, name: true } },
      memberships: {
        where: ACTIVE,
        orderBy: { profile: { name: "asc" } },
        select: {
          role: true,
          jerseyNumber: true,
          points: true,
          profile: {
            select: {
              id: true,
              userId: true,
              name: true,
              jerseyNumber: true,
              position: true,
              careerPoints: true,
              currentStreak: true,
            },
          },
        },
      },
    },
  });
  if (!team) return null;
  const playerUserIds = team.memberships
    .filter((m) => m.role === "PLAYER" && m.profile.userId != null)
    .map((m) => m.profile.userId!);
  const checkedIn = new Set((await checkInTimesForUsers(playerUserIds, todayKey())).map((e) => e.userId));
  const people = team.memberships.map((m) => ({
    profileId: m.profile.id,
    name: m.profile.name,
    role: m.role,
    jerseyNumber: m.jerseyNumber ?? m.profile.jerseyNumber,
    position: m.profile.position,
    teamPoints: m.points,
    stars: starProgress(m.profile.careerPoints).stars,
    streak: m.profile.currentStreak,
    checkedInToday: m.profile.userId != null && checkedIn.has(m.profile.userId),
  }));
  return {
    id: team.id,
    name: team.name,
    organization: team.organization,
    staff: people.filter((p) => p.role !== "PLAYER"),
    players: people.filter((p) => p.role === "PLAYER"),
  };
}

export async function searchPeople(q: string) {
  const term = q.trim();
  if (term.length < 2) return [];
  const profiles = await prisma.profile.findMany({
    where: {
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { user: { email: { contains: term, mode: "insensitive" } } },
        { user: { username: { contains: term, mode: "insensitive" } } },
      ],
    },
    orderBy: { name: "asc" },
    take: 25,
    select: {
      id: true,
      name: true,
      user: { select: { email: true, username: true } },
      memberships: {
        where: ACTIVE,
        select: { role: true, team: { select: { name: true, organization: { select: { name: true } } } } },
      },
    },
  });
  return profiles.map((p) => ({
    id: p.id,
    name: p.name,
    login: p.user?.email ?? p.user?.username ?? null,
    teams: p.memberships.map((m) => ({
      role: m.role,
      team: m.team.name,
      org: m.team.organization?.name ?? null,
    })),
  }));
}

// Monday-start week key for "this week" counts.
function weekStartKey(now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return todayKey(d);
}

export async function personDetail(profileId: number) {
  const p = await prisma.profile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      userId: true,
      name: true,
      createdAt: true,
      position: true,
      jerseyNumber: true,
      heightInches: true,
      dream: true,
      careerPoints: true,
      currentStreak: true,
      bestStreak: true,
      user: { select: { email: true, username: true } },
      memberships: {
        orderBy: { startedAt: "desc" },
        select: {
          role: true,
          startedAt: true,
          endedAt: true,
          season: { select: { name: true, isCurrent: true } },
          team: { select: { id: true, name: true, organization: { select: { id: true, name: true } } } },
        },
      },
      roleAssignments: {
        where: { revokedAt: null },
        select: { role: true, organization: { select: { id: true, name: true } } },
      },
    },
  });
  if (!p) return null;
  const since = weekStartKey();
  const [checkIns, quests, reviews] =
    p.userId != null
      ? await Promise.all([
          checkInCountForPlayer(p.userId, since),
          prisma.questLog.count({ where: { userId: p.userId, day: { gte: since }, status: "APPROVED" } }),
          reviewCountForPlayer(p.userId, since),
        ])
      : [0, 0, 0];
  const level = starProgress(p.careerPoints);
  return {
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    email: p.user?.email ?? null,
    username: p.user?.username ?? null,
    card: {
      position: p.position,
      jerseyNumber: p.jerseyNumber,
      heightInches: p.heightInches,
      careerPoints: p.careerPoints,
      stars: level.stars,
      currentStreak: p.currentStreak,
      bestStreak: p.bestStreak,
      dream: p.dream,
    },
    thisWeek: { checkIns, quests, reviews },
    memberships: p.memberships.map((m) => ({
      role: m.role,
      team: m.team.name,
      teamId: m.team.id,
      org: m.team.organization?.name ?? null,
      season: m.season.name,
      active: m.endedAt == null && m.season.isCurrent,
      startedAt: m.startedAt,
      endedAt: m.endedAt,
    })),
    orgAdminOf: p.roleAssignments.map((r) => r.organization),
  };
}

// ---- Audit ---------------------------------------------------------------

export type CeoAuditAction = "ceo.view_org" | "ceo.view_team" | "ceo.view_person";

export async function recordAudit(
  actorProfileId: number,
  action: CeoAuditAction,
  refs: { organizationId?: number | null; teamId?: number | null; targetProfileId?: number | null; detail?: string },
) {
  await prisma.auditEvent.create({
    data: {
      actorProfileId,
      action,
      organizationId: refs.organizationId ?? null,
      teamId: refs.teamId ?? null,
      targetProfileId: refs.targetProfileId ?? null,
      detail: refs.detail ?? null,
    },
  });
}

export async function listAudit(actorProfileId: number, limit = 100) {
  return prisma.auditEvent.findMany({
    where: { actorProfileId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, action: true, detail: true, createdAt: true },
  });
}
