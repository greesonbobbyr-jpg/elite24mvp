import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cardDefault } from "@/app/components/ui/Card";
import { requireOrgAccess } from "../access";

// ORGANIZATION VIEW · ACTIVITY — the organization's own record: structure
// changes, and everything the CEO opened or changed here (owner, 2026-10-09:
// "each organization sees what he did"). The whole org's record, so org
// admins and the CEO only — not a group admin.

const VERB: Record<string, string> = {
  "ceo.view_org": "opened",
  "ceo.view_team": "opened team",
  "ceo.view_person": "opened the page of",
  "org.add_group": "added group",
  "org.edit_group": "renamed / changed group",
  "org.reorder_group": "reordered group",
  "org.move_group": "moved group",
  "org.delete_group": "deleted group",
  "org.add_team": "added team",
  "org.move_team": "moved team",
  "org.apply_template": "started the structure from the shape",
  "org.add_group_admin": "made a group admin:",
  "org.remove_group_admin": "removed a group admin:",
};

export default async function ActivityPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { access } = await requireOrgAccess(params);
  if (access.via === "group_admin") notFound();
  const events = await prisma.auditEvent.findMany({
    where: { organizationId: access.orgId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, action: true, detail: true, createdAt: true, actorProfileId: true },
  });
  const actors = new Map(
    (
      await prisma.profile.findMany({
        where: { id: { in: [...new Set(events.map((e) => e.actorProfileId))] } },
        select: { id: true, name: true, platformGrants: { where: { revokedAt: null }, select: { role: true } } },
      })
    ).map((p) => [p.id, p]),
  );

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-3 sm:px-0">
      {events.length === 0 ? (
        <p className="py-4 text-sm text-muted">Nothing yet. Changes to your structure, and anything the CEO opens here, show up in this list.</p>
      ) : (
        <ul className={`${cardDefault} flex flex-col divide-y divide-line p-0`}>
          {events.map((e) => {
            const actor = actors.get(e.actorProfileId);
            const viaCeo = e.action.startsWith("ceo.");
            const verb = VERB[e.action] ?? VERB[e.action.replace(/^ceo\./, "")] ?? e.action;
            return (
              <li key={e.id} className="px-4 py-3">
                <p className="text-sm text-ink">
                  <span className="font-semibold">{actor?.name ?? "Someone"}</span>
                  {viaCeo && <span className="text-muted"> (CEO)</span>} {verb}
                  {e.detail ? <span className="font-semibold"> {e.detail}</span> : null}
                </p>
                <p className="text-xs text-subtle">
                  {e.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
