import type {
  Membership,
  Organization,
  Profile,
  Role,
  Season,
  Team,
  User,
} from "@prisma/client";
import { prisma } from "./prisma";

// THE session choke point. Resolves who is acting: login (User) → the
// permanent person (Profile) → their active memberships → the ACTING
// membership → that team/org/season, plus org-admin grants and the CEO grant.
// Nothing else decides what someone is: there is no role or team on the login.

export const ACTING_COOKIE = "e24_ctx";

export type ActiveMembership = Membership & {
  team: Team & { organization: Organization | null };
  season: Season;
};

export type Ctx = {
  // The login: id, name, email — nothing about roles or teams.
  user: User;
  // The permanent person: every login has one (made with the account).
  profile: Profile;
  memberships: ActiveMembership[];
  membership: ActiveMembership | null; // the ACTING membership
  team: ActiveMembership["team"] | null; // acting team (branding)
  org: Organization | null;
  season: Season | null;
  orgAdminOf: number[]; // orgs with an unrevoked ORG_ADMIN grant
  // Unrevoked GROUP_ADMIN grants: an org admin for one branch of the tree.
  groupAdminOf: { organizationId: number; groupId: number }[];
  // Authority above every org (PlatformGrant) — the CEO. Null for everyone
  // else. Never read for journals/reflections: those stay the player's own.
  platformRole: "CEO" | null;
};

// Picks the acting membership. The cookie is a HINT, never an authority: it
// only ever selects among the profile's own active memberships, is re-validated
// on every request, and anything stale/foreign/garbled falls back to the most
// recent membership. Exactly one membership → used implicitly (today's entire
// user base; zero new friction).
export function pickActingMembership<
  M extends { id: number; startedAt: Date },
>(memberships: readonly M[], cookieValue: string | null | undefined): M | null {
  if (memberships.length === 0) return null;
  if (memberships.length === 1) return memberships[0];
  const hinted = Number(cookieValue);
  if (Number.isInteger(hinted)) {
    const match = memberships.find((m) => m.id === hinted);
    if (match) return match;
  }
  return [...memberships].sort(
    (a, b) => b.startedAt.getTime() - a.startedAt.getTime() || b.id - a.id,
  )[0];
}

// Pure data resolution for a known user id (no auth/cookies — testable and
// script-callable). getCurrentContext() below is the request-scoped wrapper.
export async function resolveContextForUser(
  userId: number,
  actingCookie?: string | null,
): Promise<Ctx | null> {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.profile.findUnique({
      where: { userId },
      include: {
        memberships: {
          // ACTIVE = not ended, in the org's current season.
          where: { endedAt: null, season: { isCurrent: true } },
          include: { team: { include: { organization: true } }, season: true },
          orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        },
        roleAssignments: {
          where: { role: { in: ["ORG_ADMIN", "GROUP_ADMIN"] }, revokedAt: null },
          select: { role: true, organizationId: true, groupId: true },
        },
        platformGrants: {
          where: { revokedAt: null },
          select: { role: true },
        },
      },
    }),
  ]);
  // A login with no person can't act (every account is made with one).
  if (!user || !profile) return null;

  // Strip the include payloads so ctx.profile is a plain Profile.
  const { memberships, roleAssignments, platformGrants, ...profileOnly } = profile;
  const membership = pickActingMembership(memberships, actingCookie);
  const team = membership?.team ?? null;

  return {
    user,
    profile: profileOnly,
    memberships,
    membership,
    team,
    org: team?.organization ?? null,
    season: membership?.season ?? null,
    orgAdminOf: roleAssignments.filter((r) => r.role === "ORG_ADMIN").map((r) => r.organizationId),
    groupAdminOf: roleAssignments
      .filter((r) => r.role === "GROUP_ADMIN" && r.groupId != null)
      .map((r) => ({ organizationId: r.organizationId, groupId: r.groupId! })),
    platformRole: platformGrants.some((g) => g.role === "CEO") ? "CEO" : null,
  };
}

// The org-bounded authorization scope of the ACTING membership, for can()
// calls on team surfaces. Null when the viewer has no acting membership.
export function actingScope(
  ctx: Pick<Ctx, "membership" | "team">,
): { organizationId: number; teamId: number } | null {
  if (!ctx.membership || ctx.team?.organizationId == null) return null;
  return { organizationId: ctx.team.organizationId, teamId: ctx.membership.teamId };
}

// The team a person is acting for on team surfaces: the acting membership's
// team. Null = no team (a personal athlete, a removed player, an admin with
// no roster spot, the CEO). Every read AND write on one surface must use this
// same team.
export function actingTeamId(ctx: Pick<Ctx, "membership">): number | null {
  return ctx.membership?.teamId ?? null;
}

// The acting team's row (branding, names) — the same team actingTeamId picks.
export function actingTeam(ctx: Pick<Ctx, "membership">): Team | null {
  return ctx.membership?.team ?? null;
}

// Display-role snapshot stamped onto posts (Notification / TeamMessage): the
// acting membership's role, or ORG_ADMIN for an admin with no membership.
// Stored at write time so display stays stable if roles later change.
export function snapshotAuthorRole(
  ctx: Pick<Ctx, "membership" | "orgAdminOf">,
): Role | null {
  return ctx.membership?.role ?? (ctx.orgAdminOf.length > 0 ? "ORG_ADMIN" : null);
}

// Identity from the verified Auth.js session — no client-provided id is
// trusted.
export async function getCurrentUserId(): Promise<number | null> {
  const { auth } = await import("@/auth");
  const session = await auth();
  const raw = session?.user?.id;
  if (raw == null) return null;
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

// The request-scoped resolver: verified session + acting-membership cookie.
// (auth/next imports are lazy so this module stays importable from tests and
// scripts that never enter a request scope.)
export async function getCurrentContext(): Promise<Ctx | null> {
  const id = await getCurrentUserId();
  if (id === null) return null;
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  return resolveContextForUser(id, jar.get(ACTING_COOKIE)?.value ?? null);
}
