"use server";

import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { uniqueJoinCode } from "@/lib/joincode";
import { readBranding } from "@/lib/branding";
import { signIn } from "@/auth";
import { rateLimit, clientIp, RATE_LIMITED_MESSAGE } from "@/lib/ratelimit";
import { USERNAME_RE, USERNAME_RULES, normalizeUsername } from "@/lib/login";

export type SignupState = { error?: string };

// Coach self-signup: creates the coach AND their team (with a unique join code)
// atomically, then logs them in. Coaches are adults; player signup is code-gated
// in a later chunk. No minor self-signup here.
export async function signup(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  // Throttle account creation: 5 signups per hour per IP.
  if (!(await rateLimit("signup", await clientIp(), 5, 3600))) {
    return { error: RATE_LIMITED_MESSAGE };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  // Optional: staff can log in with a username too (blank = email only).
  const username = normalizeUsername(String(formData.get("username") ?? "")) || null;
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const teamName = String(formData.get("teamName") ?? "").trim();

  if (!name || !email || !teamName) {
    return { error: "Fill in your name, email, and team name." };
  }
  if (username && !USERNAME_RE.test(username)) return { error: USERNAME_RULES };
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords don't match." };
  }

  const branding = readBranding(formData);
  if ("error" in branding) return { error: branding.error };
  const { logoUrl, primaryColor, secondaryColor } = branding.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "That email is already in use." };
  }
  if (username && (await prisma.user.findUnique({ where: { username } }))) {
    return { error: "That username is taken — try another." };
  }

  const joinCode = await uniqueJoinCode();
  const passwordHash = await hashPassword(password);

  try {
    await prisma.$transaction(async (tx) => {
      // Dual-write (Stage 3): a coach signup creates the WHOLE world in both
      // models — same semantics the Stage 1 backfill applied to existing
      // teams (org named after the team, one current season, quest clones
      // created INACTIVE so the legacy quest list never sees them).
      const org = await tx.organization.create({ data: { name: teamName } });
      const season = await tx.season.create({
        data: {
          organizationId: org.id,
          name: String(new Date().getFullYear()),
          isCurrent: true,
        },
      });
      // No groups yet: the team sits directly under the organization; the
      // org shapes its group tree in Organization View when it grows.
      const team = await tx.team.create({
        data: {
          name: teamName,
          joinCode,
          logoUrl,
          primaryColor,
          secondaryColor,
          organizationId: org.id,
        },
      });
      const coach = await tx.user.create({
        data: { name, email, username, role: "COACH", teamId: team.id, passwordHash },
      });
      const profile = await tx.profile.create({
        data: { userId: coach.id, name, setupCompletedAt: new Date() },
      });
      await tx.membership.create({
        data: {
          profileId: profile.id,
          teamId: team.id,
          seasonId: season.id,
          role: "HEAD_COACH",
        },
      });
      await tx.roleAssignment.create({
        data: { profileId: profile.id, role: "ORG_ADMIN", organizationId: org.id },
      });
      const globalQuests = await tx.quest.findMany({
        where: { organizationId: null },
      });
      for (const gq of globalQuests) {
        await tx.quest.create({
          data: {
            organizationId: org.id,
            title: gq.title,
            description: gq.description,
            points: gq.points,
            targetCount: gq.targetCount,
            // On: the org's own set is what its players are served (the
            // Stage 4a converge already ran — copying them switched off left
            // new orgs with an empty Quests page).
            active: true,
            sortOrder: gq.sortOrder,
          },
        });
      }
    });
  } catch {
    // Unique violation (rare race on email/joinCode) → generic message.
    return { error: "Could not create your account. Please try again." };
  }

  // Log the new coach straight in (throws NEXT_REDIRECT on success).
  try {
    await signIn("credentials", { identifier: email, password, redirectTo: "/" });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created — please log in." };
    }
    throw error;
  }
}
