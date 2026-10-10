import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { inviteState } from "@/lib/invites";
import { cardDefault } from "@/app/components/ui/Card";
import { chipClass } from "@/app/components/ui/Pill";
import { revokeOrgCode } from "../../invites/actions";
import { requireCeo } from "../gate";
import { OrgCodeForm } from "./OrgCodeForm";

// CEO View · Org codes — only the CEO can let someone start an organization.
// One use each; 30 days; cancel any time before it's used.
const STATE_CHIP = {
  open: { tone: "neutral", text: "Not used yet" },
  used: { tone: "good", text: "Used" },
  expired: { tone: "warn", text: "Expired" },
  revoked: { tone: "warn", text: "Cancelled" },
} as const;

export default async function CeoCodesPage() {
  await requireCeo();
  const codes = await prisma.invite.findMany({
    where: { kind: "ORG_CREATE" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, codeHint: true, label: true, organizationId: true, createdAt: true, expiresAt: true, usedAt: true, revokedAt: true },
  });
  const orgs = new Map(
    (await prisma.organization.findMany({ where: { id: { in: codes.map((c) => c.organizationId).filter((x): x is number => x != null) } }, select: { id: true, name: true } })).map((o) => [o.id, o.name]),
  );

  return (
    <section className="flex flex-col gap-3">
      <div className={`${cardDefault} flex flex-col gap-3`}>
        <h2 className="font-bold text-ink">Organization codes</h2>
        <p className="text-sm text-muted">
          Give one to a club, school or district so they can start their organization in the app. Each code works once.
        </p>
        <OrgCodeForm />
      </div>
      {codes.length === 0 && <p className="px-1 text-sm text-subtle">No codes yet.</p>}
      <ul className="flex flex-col gap-2">
        {codes.map((c) => {
          const state = inviteState(c);
          const chip = STATE_CHIP[state];
          return (
            <li key={c.id} className={`${cardDefault} flex flex-wrap items-center gap-x-3 gap-y-1 p-3`}>
              <span className="font-mono text-sm font-bold text-ink">{c.codeHint}</span>
              <span className="min-w-0 flex-1 text-sm text-ink-mid">
                {c.label ?? "—"}
                {c.organizationId != null && orgs.has(c.organizationId) && (
                  <>
                    {" → "}
                    <Link href={`/ceo/orgs/${c.organizationId}`} className="font-semibold text-brand">{orgs.get(c.organizationId)}</Link>
                  </>
                )}
              </span>
              <span className={chipClass(chip.tone)}>{chip.text}</span>
              {state === "open" && (
                <form action={revokeOrgCode}>
                  <input type="hidden" name="inviteId" value={c.id} />
                  <button className="text-xs font-semibold text-brand">Cancel</button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
