import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/context";
import { can } from "@/lib/authz";
import { getOrgViewData } from "@/lib/orgview";
import { OrgExplorer, type Focus } from "./OrgExplorer";

// THE ORG VIEW (grouping Chunk 2) — READ-ONLY browsing of the whole
// organization. ORG_ADMIN only, same gate as /org (the create_team tier).
// No edits, no adjustments, no removals — those live on their normal screens.
// Everything rendered is card info the matrix already allows; journals are
// structurally unreachable.
export default async function OrgViewPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; d?: string; t?: string; hl?: string }>;
}) {
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

  const params = await searchParams;
  const num = (v?: string) => {
    const n = Number.parseInt(v ?? "", 10);
    return Number.isInteger(n) ? n : null;
  };
  const initialFocus: Focus = {
    p: num(params.p),
    d: num(params.d),
    t: num(params.t),
    hl: num(params.hl),
  };

  const data = await getOrgViewData(orgId);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-8">
      <header className="flex items-center justify-between gap-3">
        <p className="e24-eyebrow">Organization</p>
        <div className="flex gap-2">
          <Link
            href="/org"
            className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-zinc-400 transition hover:border-white/30"
          >
            Manage
          </Link>
          <span className="rounded-full border border-red-500 bg-red-600/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-red-300">
            Browse
          </span>
        </div>
      </header>

      <OrgExplorer data={data} initialFocus={initialFocus} />
    </main>
  );
}
