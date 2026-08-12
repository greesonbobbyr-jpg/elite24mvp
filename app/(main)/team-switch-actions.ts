"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ACTING_COOKIE, getCurrentContext } from "@/lib/context";

// THE CONTEXT SWITCHER (Stage 5): a person with 2+ active memberships picks
// which team they're acting for. The cookie only ever selects among the
// caller's OWN active memberships (validated here AND re-validated by the
// resolver on every request — it is a hint, never an authority). The legacy
// teamId anchor follows the acting team (dies at Stage 6).
export async function setActingTeam(formData: FormData): Promise<void> {
  const ctx = await getCurrentContext();
  if (!ctx) return;

  const membershipId = Number.parseInt(String(formData.get("membershipId") ?? ""), 10);
  if (!Number.isInteger(membershipId)) return;
  const membership = ctx.memberships.find((m) => m.id === membershipId);
  if (!membership) return; // not one of the caller's own — ignore

  const jar = await cookies();
  jar.set(ACTING_COOKIE, String(membership.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  await prisma.user.update({
    where: { id: ctx.user.id },
    data: { teamId: membership.teamId },
  });
  revalidatePath("/", "layout");
}
