import Link from "next/link";
import { redirect } from "next/navigation";
import { actingScope, actingTeamId, getCurrentContext } from "@/lib/context";
import { isStaffSide, personaOf } from "@/lib/persona";
import { can } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { JoinCodeCard } from "./JoinCodeCard";
import { TeamSettingsForm } from "./TeamSettingsForm";
import { RosterManager } from "./RosterManager";
import { StartSeasonForm } from "./StartSeasonForm";
import { Card } from "@/app/components/ui/Card";
import { StaffInviteForm } from "@/app/components/StaffInviteForm";
import { loadOrgGroups, pathOf } from "@/lib/groups";
import { invitableRoles } from "@/lib/orgaccess";

// Staff team page (matrix-gated per section). ALL staff see the roster
// (view_roster); the join code, team settings, and password resets are
// team_settings (HEAD_COACH / ORG_ADMIN); the Remove control is
// end_membership (HC / GM / ORG_ADMIN — not assistants). Team comes from the
// session — a staffer only ever sees/edits their own team.
export default async function TeamSettingsPage() {
  const ctx = await getCurrentContext();
  const user = ctx?.user;
  if (!ctx || !user) redirect("/");

  const scope = actingScope(ctx);
  const isStaff = scope != null && can(ctx, "view_roster", scope) && isStaffSide(personaOf(ctx));
  const teamId = actingTeamId(ctx);
  if (!isStaff || teamId == null) redirect("/");
  const canManageSettings = scope != null && can(ctx, "team_settings", scope);
  const canEndMembership = scope != null && can(ctx, "end_membership", scope);
  // create_season is ORG_ADMIN only.
  const canStartSeason = scope != null && can(ctx, "create_season", scope);

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) redirect("/");

  // Roster = ACTIVE PLAYER memberships in the current season. Empty right
  // after a season rollover: players re-join by code.
  const memberships = await prisma.membership.findMany({
    where: { teamId, role: "PLAYER", endedAt: null, season: { isCurrent: true } },
    select: { profile: { select: { userId: true, name: true, user: { select: { username: true } } } } },
    orderBy: { profile: { name: "asc" } },
  });
  const players = memberships
    .filter((m) => m.profile.userId != null)
    .map((m) => ({
      id: m.profile.userId!,
      name: m.profile.name,
      username: m.profile.user?.username ?? null,
    }));

  // Invite staff to THIS team (head coaches: assistants and GMs).
  const inviteRoles =
    team.organizationId != null
      ? invitableRoles(ctx, team.organizationId, { id: team.id, groupPath: pathOf(await loadOrgGroups(team.organizationId), team.groupId) })
      : [];

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-6 py-8">
      <header>
        <p className="e24-eyebrow">Team Settings</p>
        <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-ink">
          {team.name}
        </h1>
      </header>

      {canManageSettings && <JoinCodeCard code={team.joinCode} />}

      {/* Roster — all staff view; controls per the matrix */}
      <section>
        <p className="e24-eyebrow mb-2">Roster · {players.length}</p>
        <RosterManager
          players={players}
          canRemove={canEndMembership}
          canResetPassword={canManageSettings}
        />
      </section>

      {inviteRoles.length > 0 && team.organizationId != null && (
        <section>
          <p className="e24-eyebrow mb-2">Invite staff</p>
          <Card>
            <StaffInviteForm orgId={team.organizationId} teams={[{ id: team.id, name: team.name, roles: inviteRoles }]} allowOrgAdmin={false} />
          </Card>
        </section>
      )}

      {canStartSeason && ctx.season && (
        <section>
          <p className="e24-eyebrow mb-2">Season</p>
          <StartSeasonForm currentSeason={ctx.season.name} />
        </section>
      )}

      {canManageSettings && (
        <section>
          <p className="e24-eyebrow mb-2">Team details</p>
          <Card>
            <TeamSettingsForm
              team={{
                name: team.name,
                logoUrl: team.logoUrl,
                primaryColor: team.primaryColor,
                secondaryColor: team.secondaryColor,
                checkInReminderHour: team.checkInReminderHour,
              }}
              coachPhotoUrl={ctx.profile.photoUrl}
              coachCutoutUrl={ctx.profile.photoCutoutUrl}
              coachPhotoMeta={ctx.profile.photoMeta ? JSON.stringify(ctx.profile.photoMeta) : null}
            />
          </Card>
        </section>
      )}

      {/* Every staffer's own login (not team-wide, so no matrix gate). */}
      <section>
        <p className="e24-eyebrow mb-2">Your login</p>
        <Card className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink">
            You log in with <span className="font-semibold">{user.email}</span>
          </p>
          <Link href="/account/password" className="text-sm font-semibold text-brand">Change password</Link>
        </Card>
      </section>
    </main>
  );
}
