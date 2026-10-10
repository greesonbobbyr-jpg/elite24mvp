import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/lib/context";
import { groupLabel, loadOrgGroups } from "@/lib/groups";
import { orgAccessFor } from "@/lib/orgaccess";
import { Banner } from "@/app/components/ui/Banner";
import { OrgViewTabs } from "./OrgViewTabs";

// ORGANIZATION VIEW (☰ "Organization View"; owner, 2026-10-09) — everything
// an organization runs, in tabs. Org admins see the whole org; a group admin
// sees their branch; the CEO can open any org (and is told it's recorded).
// This layout only shapes the frame: each page gets its own access first
// (./access).
export default async function OrgViewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const orgId = Number.parseInt((await params).orgId, 10);
  const access = orgAccessFor(await getCurrentContext(), orgId);
  if (!access) notFound();
  const [org, groups] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
    access.branch ? loadOrgGroups(orgId) : Promise.resolve([]),
  ]);
  if (!org) notFound();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-2 py-6 pb-12 sm:px-6">
      <header className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-3 sm:px-0">
        <div>
          <p className="e24-eyebrow">Organization View</p>
          <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-ink">{org.name}</h1>
          {access.branch && (
            <p className="mt-1 text-sm text-muted">
              Your part: {access.branch.map((id) => groupLabel(groups, id)).join(", ")}
            </p>
          )}
        </div>
        {access.via === "ceo" && (
          <Banner tone="info">
            Viewing as CEO. What you open and change here is recorded in this organization&apos;s Activity.{" "}
            <Link href={`/ceo/orgs/${orgId}`} className="font-semibold underline">Back to CEO View</Link>
          </Banner>
        )}
        <OrgViewTabs orgId={orgId} showActivity={access.via !== "group_admin"} />
      </header>
      {children}
    </main>
  );
}
