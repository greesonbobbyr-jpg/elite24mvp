import { prisma } from "@/lib/prisma";
import { descendantsOf, loadOrgGroups, pathOf } from "@/lib/groups";
import { inviteState, type InviteRole } from "@/lib/invites";
import { invitableRoles, mayInviteOrgAdmin, mayInviteRole } from "@/lib/orgaccess";
import { roleLabel } from "@/lib/format";
import { cardDefault } from "@/app/components/ui/Card";
import { chipClass } from "@/app/components/ui/Pill";
import { StaffInviteForm } from "@/app/components/StaffInviteForm";
import { revokeStaffInvite } from "../../../invites/actions";
import { requireOrgAccess } from "../access";

// ORGANIZATION VIEW · INVITES — invite coaches, staff and org admins without
// an email service (code, link, QR), and see every invite's state. A group
// admin works within their branch; org admins and the CEO, the whole org.

const STATE_CHIP = {
  open: { tone: "neutral", text: "Open" },
  used: { tone: "good", text: "Used" },
  expired: { tone: "warn", text: "Expired" },
  revoked: { tone: "warn", text: "Cancelled" },
} as const;

export default async function InvitesPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { ctx, access } = await requireOrgAccess(params);
  const orgId = access.orgId;
  const [groups, teams, invites] = await Promise.all([
    loadOrgGroups(orgId),
    prisma.team.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" }, select: { id: true, name: true, groupId: true } }),
    prisma.invite.findMany({
      where: { kind: "STAFF", organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, codeHint: true, role: true, teamId: true, label: true, createdAt: true, expiresAt: true, usedAt: true, revokedAt: true, usedByProfileId: true },
    }),
  ]);
  const inBranch = access.branch ? new Set(access.branch.flatMap((id) => [id, ...descendantsOf(groups, id)])) : null;
  const reach = teams
    .filter((t) => !inBranch || (t.groupId != null && inBranch.has(t.groupId)))
    .map((t) => ({ ...t, groupPath: pathOf(groups, t.groupId) }));
  const formTeams = reach
    .map((t) => ({ id: t.id, name: t.name, roles: invitableRoles(ctx, orgId, t) }))
    .filter((t) => t.roles.length > 0);
  const allowOrgAdmin = mayInviteOrgAdmin(ctx, orgId);
  const teamById = new Map(reach.map((t) => [t.id, t]));
  const visible = invites.filter((i) => (i.teamId == null ? allowOrgAdmin : teamById.has(i.teamId)));
  const users = new Map(
    (await prisma.profile.findMany({ where: { id: { in: visible.map((i) => i.usedByProfileId).filter((x): x is number => x != null) } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]),
  );

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 sm:px-0">
      {formTeams.length > 0 || allowOrgAdmin ? (
        <div className={`${cardDefault} flex flex-col gap-3`}>
          <h2 className="font-bold text-ink">Invite a coach or staff member</h2>
          <p className="text-sm text-muted">
            No email needed: you&apos;ll get a code, a link and a QR code to send by text, WhatsApp, or however you like.
          </p>
          <StaffInviteForm orgId={orgId} teams={formTeams} allowOrgAdmin={allowOrgAdmin} />
        </div>
      ) : (
        <p className="text-sm text-muted">There are no teams here to invite staff to yet.</p>
      )}

      <h2 className="e24-eyebrow mt-2">Invites</h2>
      {visible.length === 0 && <p className="text-sm text-subtle">No invites yet.</p>}
      <ul className="flex flex-col gap-2">
        {visible.map((i) => {
          const state = inviteState(i);
          const team = i.teamId != null ? teamById.get(i.teamId) : null;
          const chip = STATE_CHIP[state];
          const canCancel =
            state === "open" && mayInviteRole(ctx, orgId, team ? { id: team.id, groupPath: team.groupPath } : null, i.role as InviteRole);
          return (
            <li key={i.id} className={`${cardDefault} flex flex-wrap items-center gap-x-3 gap-y-1 p-3`}>
              <span className="font-mono text-sm font-bold text-ink">{i.codeHint}</span>
              <span className="min-w-0 flex-1 text-sm text-ink-mid">
                {roleLabel(i.role)} · {team?.name ?? "Whole organization"}
                {i.label ? <span className="text-subtle"> · for {i.label}</span> : null}
                {state === "used" && i.usedByProfileId ? <span className="text-subtle"> · used by {users.get(i.usedByProfileId) ?? "someone"}</span> : null}
              </span>
              <span className={chipClass(chip.tone)}>{chip.text}</span>
              {canCancel && (
                <form action={revokeStaffInvite}>
                  <input type="hidden" name="inviteId" value={i.id} />
                  <button className="text-xs font-semibold text-brand">Cancel</button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
