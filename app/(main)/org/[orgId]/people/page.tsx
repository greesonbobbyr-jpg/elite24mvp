import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { descendantsOf, groupLabel, loadOrgGroups, pathOf } from "@/lib/groups";
import { can } from "@/lib/authz";
import { roleLabel } from "@/lib/format";
import { cardDefault } from "@/app/components/ui/Card";
import { fieldClass } from "@/app/components/ui/Field";
import { chipClass, pillClass } from "@/app/components/ui/Pill";
import { requireOrgAccess } from "../access";
import { ChangeRole } from "./ChangeRole";

// ORGANIZATION VIEW · PEOPLE — everyone in the organization (or a group
// admin's branch): their teams and roles, and who runs what. Names and roles
// only; a player's card details stay behind their Brand page's own rules.

const FILTERS = [
  { key: "all", label: "All" },
  { key: "players", label: "Players" },
  { key: "staff", label: "Coaches & staff" },
  { key: "admins", label: "Admins" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

type Person = {
  profileId: number;
  userId: number | null;
  name: string;
  roles: { label: string; tone: "neutral" | "accent"; player: boolean }[];
  // Team spots whose role the viewer may change (Change role).
  changeable: { id: number; team: string; role: "PLAYER" | "HEAD_COACH" | "ASSISTANT_COACH" | "GENERAL_MANAGER" }[];
};

export default async function PeoplePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ show?: string; q?: string }>;
}) {
  const { ctx, access } = await requireOrgAccess(params);
  const orgId = access.orgId;
  const { show = "all", q = "" } = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.key === show) ? (show as Filter) : "all";

  const groups = await loadOrgGroups(orgId);
  const inBranch = access.branch ? new Set(access.branch.flatMap((id) => [id, ...descendantsOf(groups, id)])) : null;
  const [memberships, grants] = await Promise.all([
    prisma.membership.findMany({
      where: {
        endedAt: null,
        season: { isCurrent: true },
        team: inBranch ? { organizationId: orgId, groupId: { in: [...inBranch] } } : { organizationId: orgId },
      },
      select: {
        id: true,
        role: true,
        team: { select: { id: true, name: true, groupId: true } },
        profile: { select: { id: true, userId: true, name: true } },
      },
    }),
    prisma.roleAssignment.findMany({
      where: {
        organizationId: orgId,
        revokedAt: null,
        role: { in: inBranch ? ["GROUP_ADMIN"] : ["ORG_ADMIN", "GROUP_ADMIN"] },
        ...(inBranch ? { groupId: { in: [...inBranch] } } : {}),
      },
      select: { role: true, groupId: true, profile: { select: { id: true, userId: true, name: true } } },
    }),
  ]);
  if (access.via === "ceo") {
    await prisma.auditEvent.create({
      data: { actorProfileId: access.profileId, action: "ceo.view_org", organizationId: orgId, detail: "Organization View · People" },
    });
  }

  const people = new Map<number, Person>();
  const personFor = (p: { id: number; userId: number | null; name: string }) => {
    const existing = people.get(p.id);
    if (existing) return existing;
    const fresh: Person = { profileId: p.id, userId: p.userId, name: p.name, roles: [], changeable: [] };
    people.set(p.id, fresh);
    return fresh;
  };
  for (const g of grants) {
    personFor(g.profile).roles.push({
      label: g.role === "ORG_ADMIN" ? "Org Admin" : `Group admin · ${g.groupId ? groupLabel(groups, g.groupId) : ""}`,
      tone: "accent",
      player: false,
    });
  }
  for (const m of memberships) {
    const target = { organizationId: orgId, teamId: m.team.id, groupPath: pathOf(groups, m.team.groupId) };
    if (m.profile.id !== access.profileId && can(ctx, "change_member_role", target) && m.role !== "ORG_ADMIN" && m.role !== "GROUP_ADMIN" && m.role !== "COACH") {
      personFor(m.profile).changeable.push({ id: m.id, team: m.team.name, role: m.role });
    }
    personFor(m.profile).roles.push({
      label: `${roleLabel(m.role) ?? "Player"} · ${m.team.name}`,
      tone: m.role === "PLAYER" ? "neutral" : "accent",
      player: m.role === "PLAYER",
    });
  }

  const term = q.trim().toLowerCase();
  const list = [...people.values()]
    .filter((p) =>
      filter === "players"
        ? p.roles.some((r) => r.player)
        : filter === "staff"
          ? p.roles.some((r) => !r.player && !r.label.startsWith("Org Admin") && !r.label.startsWith("Group admin"))
          : filter === "admins"
            ? p.roles.some((r) => r.label.startsWith("Org Admin") || r.label.startsWith("Group admin"))
            : true,
    )
    .filter((p) => !term || p.name.toLowerCase().includes(term))
    .sort((a, b) => a.name.localeCompare(b.name));

  const href = (key: Filter) => `/org/${orgId}/people?show=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const linkFor = (p: Person) =>
    access.via === "ceo"
      ? `/ceo/people/${p.profileId}`
      : access.via === "org_admin" && p.userId != null && p.roles.some((r) => r.player)
        ? `/brand/${p.userId}`
        : null;

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-3 sm:px-0">
      <form role="search">
        <input type="hidden" name="show" value={filter} />
        <label htmlFor="org-people-q" className="sr-only">Search people</label>
        <input id="org-people-q" name="q" defaultValue={q} placeholder="Search by name" className={fieldClass} />
      </form>
      <nav aria-label="Show" className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link key={f.key} href={href(f.key)} aria-current={filter === f.key ? "page" : undefined} className={pillClass(filter === f.key, "sm")}>
            {f.label}
          </Link>
        ))}
      </nav>
      <p className="text-xs text-subtle">{list.length} {list.length === 1 ? "person" : "people"}</p>
      <ul className="flex flex-col gap-2">
        {list.map((p) => {
          const link = linkFor(p);
          const body = (
            <>
              <p className="truncate font-semibold text-ink">{p.name}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {p.roles.map((r, i) => (
                  <span key={i} className={chipClass(r.tone)}>{r.label}</span>
                ))}
              </div>
            </>
          );
          return (
            <li key={p.profileId} className={`${cardDefault} p-3`}>
              {link ? <Link href={link} className="block">{body}</Link> : body}
              {p.changeable.length > 0 && <ChangeRole orgId={orgId} firstName={p.name.split(" ")[0]} memberships={p.changeable} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
