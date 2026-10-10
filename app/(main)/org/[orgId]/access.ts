import { notFound } from "next/navigation";
import { getCurrentContext, type Ctx } from "@/lib/context";
import { orgAccessFor, type OrgAccess } from "@/lib/orgaccess";

// Every Organization View page calls this FIRST, before any read — the
// layout's check alone never stops a page from rendering. Anyone without
// access to THIS organization gets a 404.
export async function requireOrgAccess(
  params: Promise<{ orgId: string }>,
): Promise<{ ctx: Ctx; access: OrgAccess }> {
  const orgId = Number.parseInt((await params).orgId, 10);
  const ctx = await getCurrentContext();
  const access = ctx ? orgAccessFor(ctx, orgId) : null;
  if (!ctx || !access) notFound();
  return { ctx, access };
}
