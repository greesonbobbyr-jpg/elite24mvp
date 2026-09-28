import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/context";
import { can } from "@/lib/authz";
import { getOrgViewData } from "@/lib/orgview";
import { OrgTabs } from "../OrgTabs";
import { OrgTree } from "./OrgTree";

// THE ORG VIEW (grouping Chunk 2) — the org tree: READ-ONLY browsing of the
// whole organization, built to the owner's sketch
// (design/reference/org-tree-sketch.jpg). ORG_ADMIN only, same gate as /org
// (the create_team tier). No edits, no adjustments, no removals — those live
// on their normal screens. Everything rendered is card info the matrix
// already allows; journals are structurally unreachable, and a player's card
// opens their Brand page under its own access rules.
export default async function OrgViewPage() {
  const ctx = await getCurrentContext();
  const user = ctx?.user;
  if (!ctx || !user) redirect("/");

  const orgId = ctx.orgAdminOf[0] ?? ctx.team?.organizationId ?? null;
  const allowed =
    orgId != null &&
    (ctx.profile
      ? can(ctx, "create_team", { organizationId: orgId })
      : user.role === "COACH"); // pre-backfill fallback (dies at Stage 6)
  if (!allowed || orgId == null) redirect("/");

  const data = await getOrgViewData(orgId);
  const { teamCount, playerCount } = data.totals;
  const firstRow = data.showPrograms ? "program" : data.programs[0]?.showDivisions ? "division" : null;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-2 py-8 sm:px-6">
      <header className="px-4 sm:px-0">
        <div className="flex items-center justify-between gap-3">
          <p className="e24-eyebrow">Organization</p>
          <OrgTabs current="browse" />
        </div>
        <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-ink">{data.org.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {teamCount} {teamCount === 1 ? "team" : "teams"} · {playerCount} {playerCount === 1 ? "player" : "players"}.{" "}
          {firstRow ? `Tap a ${firstRow}, then a head coach.` : "Tap a head coach to see the players."}
        </p>
      </header>

      <OrgTree data={data} />
    </main>
  );
}
