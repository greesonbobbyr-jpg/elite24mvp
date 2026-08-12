import type {
  Membership,
  Organization,
  PlayerProfile,
  Profile,
  Role,
  Season,
  Team,
  User,
} from "@prisma/client";
import { prisma } from "./prisma";

// THE session choke point, v2 (hierarchy rebuild Stage 2). Resolves who is
// acting: login → permanent person (Profile) → their active memberships → the
// ACTING membership → that team/org/season, plus org-admin grants.
//
// During the migration (Stages 2–5) `ctx.user` is the LEGACY row loaded with
// the exact same query getCurrentUser() has always run — the compat shim in
// lib/session.ts returns it as-is, so every not-yet-cut-over surface behaves
// byte-for-byte identically. Legacy row and new-world fields both die in
// Stage 6, together.

export const ACTING_COOKIE = "e24_ctx";

export type ActiveMembership = Membership & {
  team: Team & { organization: Organization | null };
  season: Season;
};

export type Ctx = {
  // Legacy user row (with team + PlayerProfile) — the compat shim's source.
  // team is non-null exactly as in the legacy payload (User.teamId required).
  user: User & { team: Team; profile: PlayerProfile | null };
  // The permanent person. Null only for logins created by the legacy signup
  // path after the Stage 1 backfill ran — they converge at the next backfill
  // re-run (Stage 4a) and via dual-write (Stage 3).
  profile: Profile | null;
  memberships: ActiveMembership[];
  membership: ActiveMembership | null; // the ACTING membership
  team: ActiveMembership["team"] | null; // acting team (branding)
  org: Organization | null;
  season: Season | null;
  orgAdminOf: number[]; // orgs with an unrevoked ORG_ADMIN grant
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
    // EXACT legacy getCurrentUser query — do not change while the shim lives.
    prisma.user.findUnique({
      where: { id: userId },
      include: { team: true, profile: true },
    }),
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
          where: { role: "ORG_ADMIN", revokedAt: null },
          select: { organizationId: true },
        },
      },
    }),
  ]);
  if (!user) return null;

  const memberships = profile?.memberships ?? [];
  const membership = pickActingMembership(memberships, actingCookie);
  const team = membership?.team ?? null;

  let profileOnly: Profile | null = null;
  if (profile) {
    // Strip the include payloads so ctx.profile is a plain Profile.
    const { memberships: _m, roleAssignments: _r, ...rest } = profile;
    profileOnly = rest;
  }

  return {
    user,
    profile: profileOnly,
    memberships,
    membership,
    team,
    org: team?.organization ?? null,
    season: membership?.season ?? null,
    orgAdminOf: profile?.roleAssignments.map((r) => r.organizationId) ?? [],
  };
}

// The org-bounded authorization scope of the ACTING membership, for can()
// calls on team surfaces. Null when the viewer has no acting membership or
// their team predates the backfill (callers fall back to legacy role checks
// until Stage 6).
export function actingScope(
  ctx: Pick<Ctx, "membership" | "team">,
): { organizationId: number; teamId: number } | null {
  if (!ctx.membership || ctx.team?.organizationId == null) return null;
  return { organizationId: ctx.team.organizationId, teamId: ctx.membership.teamId };
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
// trusted. (Moved here from lib/session.ts, which re-exports it.)
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
