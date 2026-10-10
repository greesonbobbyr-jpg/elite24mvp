import { prisma } from "@/lib/prisma";
import { canMove, childrenByParent, descendantsOf, GROUP_KIND_LABEL, GROUP_KINDS, groupLabel, loadOrgGroups, MAX_GROUP_DEPTH, type GroupRow } from "@/lib/groups";
import { canShapeAt } from "@/lib/orgaccess";
import { roleLabel } from "@/lib/format";
import { cardDefault } from "@/app/components/ui/Card";
import { chipClass } from "@/app/components/ui/Pill";
import { requireOrgAccess } from "../access";
import { reorderGroup } from "../actions";
import { AddGroup, AddTeam, GroupAdminRemove, GroupEditor, TeamMover, TemplatePicker } from "./StructureControls";

// ORGANIZATION VIEW · STRUCTURE — the group tree with its teams: add, rename,
// change kind, reorder, move, delete-when-empty; teams in any group; group
// admins per group. A group admin sees and shapes only what's inside their
// branch. Every change is re-checked on the server (../actions).

type Team = { id: number; name: string; joinCode: string | null; groupId: number | null };
type Grant = { id: number; groupId: number | null; profile: { name: string } };
type Option = { value: string; label: string };

export default async function StructurePage({ params }: { params: Promise<{ orgId: string }> }) {
  const { ctx, access } = await requireOrgAccess(params);
  const orgId = access.orgId;
  const [allGroups, allTeams, grants, staff] = await Promise.all([
    loadOrgGroups(orgId),
    prisma.team.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, joinCode: true, groupId: true },
    }),
    prisma.roleAssignment.findMany({
      where: { organizationId: orgId, role: "GROUP_ADMIN", revokedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, groupId: true, profile: { select: { name: true } } },
    }),
    // Group admin candidates: this org's staff.
    prisma.membership.findMany({
      where: { role: { not: "PLAYER" }, endedAt: null, season: { isCurrent: true }, team: { organizationId: orgId } },
      orderBy: { profile: { name: "asc" } },
      select: { role: true, team: { select: { name: true } }, profile: { select: { id: true, name: true } } },
    }),
  ]);

  // A group admin's part: their groups and everything under them.
  const inBranch = access.branch ? new Set(access.branch.flatMap((id) => [id, ...descendantsOf(allGroups, id)])) : null;
  const groups = inBranch ? allGroups.filter((g) => inBranch.has(g.id)) : allGroups;
  const teams = inBranch ? allTeams.filter((t) => t.groupId != null && inBranch.has(t.groupId)) : allTeams;
  const shapeAt = (groupId: number | null) => canShapeAt(ctx, access, allGroups, groupId);
  const wholeOrg = shapeAt(null);

  const kinds: Option[] = GROUP_KINDS.map((k) => ({ value: k, label: GROUP_KIND_LABEL[k] }));
  const places: Option[] = [
    ...(wholeOrg ? [{ value: "", label: "The organization (top level)" }] : []),
    ...groups.filter((g) => shapeAt(g.id)).map((g) => ({ value: String(g.id), label: groupLabel(allGroups, g.id) })),
  ];
  const candidates: Option[] = [
    ...new Map(staff.map((m) => [m.profile.id, { value: String(m.profile.id), label: `${m.profile.name} · ${roleLabel(m.role)}, ${m.team.name}` }])).values(),
  ];
  const children = childrenByParent(groups);
  const top = inBranch ? groups.filter((g) => !g.parentId || !inBranch.has(g.parentId)) : (children.get(null) ?? []);
  const teamsIn = (groupId: number | null) => teams.filter((t) => t.groupId === groupId);

  const ctxProps = { orgId, allGroups, kinds, places, candidates, grants, shapeAt, wholeOrg, children, teamsIn };

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 sm:px-0">
      <p className="text-sm text-muted">
        {`Groups organize your teams any way you run them — Boys and Girls, age groups, JV and Varsity, schools — up to ${MAX_GROUP_DEPTH} levels. A level with only one group stays out of everyone's way.`}
      </p>

      {allGroups.length === 0 && wholeOrg && (
        <div className={`${cardDefault} flex flex-col gap-3`}>
          <h2 className="font-bold text-ink">Start from a shape</h2>
          <p className="text-sm text-muted">Creates the groups for you; rename, move or delete any of them after. Or add groups one at a time below.</p>
          <TemplatePicker orgId={orgId} />
        </div>
      )}

      {top.map((g, i) => (
        <GroupBlock key={g.id} group={g} root siblings={top.length} index={i} {...ctxProps} />
      ))}

      {!inBranch && (teamsIn(null).length > 0 || wholeOrg) && (
        <div className={`${cardDefault} flex flex-col gap-2 p-4`}>
          <h2 className="e24-eyebrow">{allGroups.length ? "Teams not in a group" : "Teams"}</h2>
          {teamsIn(null).length === 0 && <p className="text-sm text-subtle">No teams here.</p>}
          {teamsIn(null).map((t) => (
            <TeamRow key={t.id} team={t} orgId={orgId} places={places} movable={wholeOrg} />
          ))}
          {wholeOrg && (
            <div className="flex flex-wrap gap-4 pt-1">
              <AddTeam orgId={orgId} groupId={null} />
              <AddGroup orgId={orgId} parentId={null} kinds={kinds} label="Add group" />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function TeamRow({ team, orgId, places, movable }: { team: Team; orgId: number; places: Option[]; movable: boolean }) {
  return (
    <div data-team={team.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-sunken px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{team.name}</p>
        {team.joinCode && (
          <p className="text-[11px] text-subtle">
            Join code <span className="font-mono">{team.joinCode}</span>
          </p>
        )}
      </div>
      {movable && places.length > 1 && <TeamMover orgId={orgId} teamId={team.id} current={team.groupId} targets={places} />}
    </div>
  );
}

function GroupBlock({
  group,
  root = false,
  siblings,
  index,
  orgId,
  allGroups,
  kinds,
  places,
  candidates,
  grants,
  shapeAt,
  wholeOrg,
  children,
  teamsIn,
}: {
  group: GroupRow;
  root?: boolean;
  siblings: number;
  index: number;
  orgId: number;
  allGroups: GroupRow[];
  kinds: Option[];
  places: Option[];
  candidates: Option[];
  grants: Grant[];
  shapeAt: (groupId: number | null) => boolean;
  wholeOrg: boolean;
  children: Map<number | null, GroupRow[]>;
  teamsIn: (groupId: number | null) => Team[];
}) {
  const kids = children.get(group.id) ?? [];
  const teams = teamsIn(group.id);
  const editable = shapeAt(group.parentId); // its place is in reach
  const inside = shapeAt(group.id); // what's inside is in reach
  const admins = grants.filter((g) => g.groupId === group.id);
  const moveTargets = places.filter((p) => p.value === String(group.parentId ?? "") || canMove(allGroups, group.id, p.value ? Number(p.value) : null).ok);
  const top = root;
  const props = { orgId, allGroups, kinds, places, candidates, grants, shapeAt, wholeOrg, children, teamsIn };

  return (
    <div data-group={group.id} className={top ? `${cardDefault} flex flex-col gap-3 p-4` : "flex flex-col gap-2 border-l-2 border-line pl-3"}>
      <div data-group-header className="flex flex-wrap items-center gap-2">
        <h2 className={top ? "text-base font-black text-ink" : "text-sm font-bold text-ink"}>{group.name}</h2>
        <span className={chipClass("neutral")}>{GROUP_KIND_LABEL[group.kind]}</span>
        {admins.map((a) => (
          <span key={a.id} className={chipClass("accent")}>
            {a.profile.name} · Group admin
            {wholeOrg && <GroupAdminRemove orgId={orgId} grantId={a.id} name={a.profile.name} />}
          </span>
        ))}
        <span className="flex-1" />
        {editable && (
          <GroupEditor
            orgId={orgId}
            group={group}
            kinds={kinds}
            moveTargets={moveTargets}
            empty={kids.length === 0 && teams.length === 0 && admins.length === 0}
            adminCandidates={wholeOrg ? candidates : undefined}
          />
        )}
        {editable && siblings > 1 && (
          <span className="flex gap-1">
            {index > 0 && <Reorder orgId={orgId} groupId={group.id} direction="up" />}
            {index < siblings - 1 && <Reorder orgId={orgId} groupId={group.id} direction="down" />}
          </span>
        )}
      </div>

      {teams.map((t) => (
        <TeamRow key={t.id} team={t} orgId={orgId} places={places} movable={inside} />
      ))}
      {kids.map((k, i) => (
        <GroupBlock key={k.id} group={k} siblings={kids.length} index={i} {...props} />
      ))}
      {kids.length === 0 && teams.length === 0 && <p className="text-xs text-subtle">Nothing in this group yet.</p>}

      {inside && (
        <div data-group-actions className="flex flex-wrap gap-4">
          <AddTeam orgId={orgId} groupId={group.id} />
          {group.depth < MAX_GROUP_DEPTH && <AddGroup orgId={orgId} parentId={group.id} kinds={kinds} label={`Add group in ${group.name}`} />}
        </div>
      )}
    </div>
  );
}

function Reorder({ orgId, groupId, direction }: { orgId: number; groupId: number; direction: "up" | "down" }) {
  return (
    <form action={reorderGroup}>
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="direction" value={direction} />
      <button
        aria-label={direction === "up" ? "Move up" : "Move down"}
        className="rounded border border-line-strong px-1.5 text-xs text-muted hover:border-field-line"
      >
        {direction === "up" ? "▲" : "▼"}
      </button>
    </form>
  );
}
