import { prisma } from "@/lib/prisma";
import { getOrgViewData } from "@/lib/orgview";
import { OrgTree } from "../tree/OrgTree";
import { requireOrgAccess } from "./access";

// ORGANIZATION VIEW · TREE — the org tree (the owner's sketch): READ-ONLY
// browsing of the organization, or a group admin's branch of it. Everything
// rendered is card info the matrix already allows; journals are structurally
// unreachable, and a player's card opens their Brand page under its own rules.
export default async function OrgTreePage({ params }: { params: Promise<{ orgId: string }> }) {
  const { access } = await requireOrgAccess(params);
  const data = await getOrgViewData(access.orgId, { branch: access.branch ?? undefined });
  if (access.via === "ceo") {
    await prisma.auditEvent.create({
      data: { actorProfileId: access.profileId, action: "ceo.view_org", organizationId: access.orgId, detail: "Organization View · Tree" },
    });
  }
  const { teamCount, playerCount } = data.totals;
  const hasGroups = data.groups.length > 0;

  return (
    <>
      <p className="mx-auto w-full max-w-3xl px-3 text-sm text-muted sm:px-0">
        {teamCount} {teamCount === 1 ? "team" : "teams"} · {playerCount} {playerCount === 1 ? "player" : "players"}.{" "}
        {hasGroups ? "Tap a group, then a head coach." : "Tap a head coach to see the players."}
      </p>
      <OrgTree data={data} />
    </>
  );
}
