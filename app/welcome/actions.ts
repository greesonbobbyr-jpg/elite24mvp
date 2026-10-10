"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentContext, type Ctx } from "@/lib/context";
import { roleLabel } from "@/lib/format";
import { acceptStaffInvite, codeKind, createInvite, findInviteByCode, findInviteByToken, inviteState, normalizeCode, stateMessage } from "@/lib/invites";
import { shareable, type MadeInvite } from "@/lib/invite-share";
import { joinTeamForProfile, resolveJoinableTeam } from "@/lib/data/join";
import { createOrganization } from "@/lib/data/create-org";
import { choiceFromForm, templateGroups, templatePlaces } from "@/lib/structure-templates";
import { rateLimit, RATE_LIMITED_MESSAGE } from "@/lib/ratelimit";

// STEP 2 (owner, 2026-10-09): Start an Organization (org code) · Joining a
// Team (team code or staff invite) · Personal Player Development. A code is
// the only way onto a team or into running an organization.

export type CodeState = {
  error?: string;
  kind?: "staff" | "org";
  code?: string;
  what?: string;
};

async function signedIn(): Promise<(Ctx & { profile: NonNullable<Ctx["profile"]> }) | null> {
  const ctx = await getCurrentContext();
  return ctx?.profile ? (ctx as Ctx & { profile: NonNullable<Ctx["profile"]> }) : null;
}

/** The one code box: a team code joins as a player; an invite or org code
 * comes back for a confirm step. */
export async function enterCode(_p: CodeState, formData: FormData): Promise<CodeState> {
  const ctx = await signedIn();
  if (!ctx) redirect("/login?next=/welcome");
  if (!(await rateLimit("welcome-code", String(ctx.profile.id), 20, 3600))) return { error: RATE_LIMITED_MESSAGE };
  const code = normalizeCode(formData.get("code"));
  const kind = codeKind(code);

  if (kind === "team") {
    const joinable = await resolveJoinableTeam(code);
    if (!joinable.ok) {
      return {
        error: joinable.reason === "bad_code"
          ? "That code didn't match a team."
          : "That team isn't accepting players right now — ask your coach to start the season.",
      };
    }
    await joinTeamForProfile(ctx.profile.id, ctx.user.id, joinable.team.id, joinable.seasonId);
    // A new athlete writes their Dream next; anyone already set up goes home.
    redirect(ctx.profile.setupCompletedAt ? "/" : "/onboarding");
  }
  if (kind === "staff" || kind === "org") {
    const invite = await findInviteByCode(code);
    const want = kind === "staff" ? "STAFF" : "ORG_CREATE";
    if (!invite || invite.kind !== want) return { error: "That code didn't match an invite." };
    const state = inviteState(invite);
    if (state !== "open") return { error: stateMessage(state) };
    if (kind === "org") return { kind, code, what: "Start your organization" };
    const team = invite.teamId ? await prisma.team.findUnique({ where: { id: invite.teamId }, select: { name: true } }) : null;
    const org = invite.organizationId ? await prisma.organization.findUnique({ where: { id: invite.organizationId }, select: { name: true } }) : null;
    return { kind, code, what: `${roleLabel(invite.role)} · ${team?.name ?? org?.name ?? ""}${team && org ? ` (${org.name})` : ""}` };
  }
  return { error: "That doesn't look like a code. Team codes have 6 characters; invites have 8, like K7QD-M2PX." };
}

export type AcceptState = { error?: string };

/** Accept a staff invite — by its code, or by its link's token. Adults only. */
export async function acceptInviteCode(_p: AcceptState, formData: FormData): Promise<AcceptState> {
  const ctx = await signedIn();
  if (!ctx) redirect("/login");
  if (formData.get("adult") !== "on") return { error: "Coaches and staff must be adults (18+)." };
  const code = normalizeCode(formData.get("code"));
  const token = String(formData.get("token") ?? "");
  const invite = token ? await findInviteByToken(token) : codeKind(code) === "staff" ? await findInviteByCode(code) : null;
  if (!invite) return { error: "That code didn't match an invite." };
  const result = await acceptStaffInvite(invite, { profileId: ctx.profile.id, userId: ctx.user.id });
  if (!result.ok) return { error: result.error };
  redirect("/");
}

export type OrgState = { error?: string; made?: MadeInvite; orgId?: number };

/** START AN ORGANIZATION — with an org code, or (the CEO) without one. */
export async function startOrganization(_p: OrgState, formData: FormData): Promise<OrgState> {
  const ctx = await signedIn();
  if (!ctx) redirect("/login");
  const isCeo = ctx.platformRole === "CEO";
  let orgCodeId: number | null = null;
  if (!isCeo) {
    // The org code, typed — or the invite link's token.
    const code = normalizeCode(formData.get("code"));
    const token = String(formData.get("token") ?? "");
    const invite = token ? await findInviteByToken(token) : codeKind(code) === "org" ? await findInviteByCode(code) : null;
    if (!invite || invite.kind !== "ORG_CREATE") return { error: "An organization code is needed to start an organization." };
    const state = inviteState(invite);
    if (state !== "open") return { error: stateMessage(state) };
    orgCodeId = invite.id;
  }

  const name = String(formData.get("orgName") ?? "").trim();
  if (name.length < 2 || name.length > 60) return { error: "Name the organization (2–60 characters)." };
  const choice = choiceFromForm(formData);
  const shape = choice ? templateGroups(choice) : { ok: false as const, error: "Pick a shape." };
  if (!shape.ok) return { error: shape.error };

  const teamName = String(formData.get("teamName") ?? "").trim();
  if (teamName.length > 40) return { error: "Team names are at most 40 characters." };
  if (!teamName && choice?.template === "one-team") return { error: "Name your team." };
  const place = String(formData.get("place") ?? "");
  if (place && !templatePlaces(shape.groups).some((p) => p.path === place)) return { error: "Pick where the team goes." };

  const created = await createOrganization({
    name,
    groups: shape.groups,
    team: teamName ? { name: teamName, place: place || null } : null,
    creator: { profileId: ctx.profile.id, userId: ctx.user.id },
    orgCodeId,
    becomeAdmin: !isCeo,
    coachTeam: !isCeo && formData.get("coach") === "on",
  });
  if (!created.ok) return { error: created.error };

  // The CEO set it up for someone: hand back an Org Admin invite to send them.
  const adminFor = String(formData.get("adminFor") ?? "").trim();
  if (isCeo && adminFor) {
    const { code, token } = await createInvite({
      kind: "STAFF",
      role: "ORG_ADMIN",
      organizationId: created.orgId,
      label: adminFor,
      createdByProfileId: ctx.profile.id,
    });
    return { orgId: created.orgId, made: await shareable(code, token, `Org Admin · ${name} · for ${adminFor}`, 7) };
  }
  redirect(`/org/${created.orgId}`);
}
