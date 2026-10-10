import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/lib/context";
import { findInviteByToken, inviteState, stateMessage } from "@/lib/invites";
import { roleLabel } from "@/lib/format";
import { buttonClass } from "@/app/components/ui/Button";
import { OrgWizard } from "@/app/components/OrgWizard";
import { AcceptStaff } from "@/app/welcome/WelcomePaths";

// AN INVITE LINK (/invite/<token>) — public, so someone without an account
// can open it: it says what the invite is for, then they create an account
// (or log in) and accept. Accepting always needs a login, and staff confirm
// they're adults. Shows nothing beyond the invite's own role/team/org names.
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await findInviteByToken(token);
  const state = invite ? inviteState(invite) : null;

  let what = "";
  if (invite?.kind === "STAFF") {
    const [team, org] = await Promise.all([
      invite.teamId ? prisma.team.findUnique({ where: { id: invite.teamId }, select: { name: true } }) : null,
      invite.organizationId ? prisma.organization.findUnique({ where: { id: invite.organizationId }, select: { name: true } }) : null,
    ]);
    what = `${roleLabel(invite.role)}${team ? ` on ${team.name}` : ""}${org ? ` · ${org.name}` : ""}`;
  }
  const ctx = invite && state === "open" ? await getCurrentContext() : null;
  const here = `/invite/${token}`;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-12">
      <div className="text-center">
        <span
          role="img"
          aria-label="Elite24MVP"
          className="text-2xl font-black italic tracking-tight text-ink"
          style={{ fontFamily: "var(--font-barlow)" }}
        >
          Elite<span className="text-logo">24</span>MVP
        </span>
      </div>

      <section className="e24-surface rounded-2xl p-6">
        <div className="relative z-10 flex flex-col gap-4">
          {!invite ? (
            <p className="text-sm text-ink">This invite link isn&apos;t valid. Ask whoever sent it for a new one.</p>
          ) : state !== "open" ? (
            <p className="text-sm text-ink">{stateMessage(state!)}</p>
          ) : (
            <>
              <div>
                <p className="e24-eyebrow">You&apos;re invited</p>
                <h1 className="mt-1 text-xl font-black text-ink">
                  {invite.kind === "STAFF" ? what : "Start your organization on Elite24MVP"}
                </h1>
              </div>
              {!ctx ? (
                <div className="flex flex-col gap-2">
                  <Link href={`/signup?next=${encodeURIComponent(here)}`} className={buttonClass("primary")}>Create your account</Link>
                  <Link href={`/login?next=${encodeURIComponent(here)}`} className={buttonClass("secondary")}>I already have an account — log in</Link>
                </div>
              ) : invite.kind === "STAFF" ? (
                <AcceptStaff token={token} what={what} />
              ) : (
                <OrgWizard token={token} ceo={false} />
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
