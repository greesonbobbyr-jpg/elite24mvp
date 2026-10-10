import { prisma } from "../prisma";
import { claimInvite } from "../invites";
import { uniqueJoinCode } from "../joincode";
import type { TemplateNode } from "../structure-templates";

// START AN ORGANIZATION (person-first plan Phase 3, owner 2026-10-09), in ONE
// transaction: the org code is claimed (single use), then the organization,
// its current season, its groups (the chosen shape), its first team (with a
// join code), its own quest set switched ON, and the creator's place in it.
//
//   creator via an org code → ORG_ADMIN (+ HEAD_COACH of the first team if
//                             they coach it)
//   the CEO (no code)       → no role in it; the CEO already reaches every
//                             org, and invites whoever will run it

export type NewOrganization = {
  name: string;
  groups: TemplateNode[];
  team: { name: string; place: string | null } | null; // place = template path "0.2", null = directly under the org
  creator: { profileId: number; userId: number };
  orgCodeId: number | null; // null only for the CEO
  becomeAdmin: boolean;
  coachTeam: boolean;
};

export type CreatedOrganization = { ok: true; orgId: number; teamId: number | null } | { ok: false; error: string };

export async function createOrganization(input: NewOrganization): Promise<CreatedOrganization> {
  const joinCode = input.team ? await uniqueJoinCode() : null;
  const year = String(new Date().getFullYear());
  try {
    return await prisma.$transaction(async (tx) => {
      if (input.orgCodeId != null && !(await claimInvite(tx, input.orgCodeId, input.creator.profileId))) {
        throw new CodeTaken();
      }
      const org = await tx.organization.create({ data: { name: input.name } });
      const season = await tx.season.create({ data: { organizationId: org.id, name: year, isCurrent: true } });

      // The shape's groups; remember each one's template path for the team.
      const idByPlace = new Map<string, number>();
      const make = async (nodes: TemplateNode[], parentId: number | null, depth: number, prefix: number[]) => {
        for (const [i, node] of nodes.entries()) {
          const g = await tx.group.create({
            data: { organizationId: org.id, parentId, name: node.name, kind: node.kind, depth, sortOrder: i },
          });
          const place = [...prefix, i];
          idByPlace.set(place.join("."), g.id);
          await make(node.children ?? [], g.id, depth + 1, place);
        }
      };
      await make(input.groups, null, 1, []);

      let teamId: number | null = null;
      if (input.team) {
        const groupId = input.team.place ? (idByPlace.get(input.team.place) ?? null) : null;
        const team = await tx.team.create({
          data: { name: input.team.name, organizationId: org.id, groupId, joinCode },
        });
        teamId = team.id;
      }

      // The org's own quest set, ON from the start (the Elite24 set as its
      // starting point — an org can change its quests later).
      const shared = await tx.quest.findMany({ where: { organizationId: null } });
      for (const q of shared) {
        await tx.quest.create({
          data: {
            organizationId: org.id,
            title: q.title,
            description: q.description,
            points: q.points,
            targetCount: q.targetCount,
            sortOrder: q.sortOrder,
            active: true,
          },
        });
      }

      if (input.becomeAdmin) {
        await tx.roleAssignment.create({
          data: { profileId: input.creator.profileId, role: "ORG_ADMIN", organizationId: org.id },
        });
      }
      if (input.coachTeam && teamId != null) {
        await tx.membership.create({
          data: { profileId: input.creator.profileId, teamId, seasonId: season.id, role: "HEAD_COACH" },
        });
      }
      if (input.orgCodeId != null) {
        await tx.invite.update({ where: { id: input.orgCodeId }, data: { organizationId: org.id } });
      }
      await tx.auditEvent.create({
        data: {
          actorProfileId: input.creator.profileId,
          action: input.orgCodeId == null ? "ceo.org.created" : "org.created",
          organizationId: org.id,
          detail: input.name,
        },
      });
      return { ok: true as const, orgId: org.id, teamId };
    });
  } catch (e) {
    if (e instanceof CodeTaken) return { ok: false, error: "That organization code was just used or is no longer open." };
    throw e;
  }
}

class CodeTaken extends Error {}
