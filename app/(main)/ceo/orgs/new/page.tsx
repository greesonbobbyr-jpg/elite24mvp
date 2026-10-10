import Link from "next/link";
import { cardDefault } from "@/app/components/ui/Card";
import { OrgWizard } from "@/app/components/OrgWizard";
import { requireCeo } from "../../gate";

// CEO View · Start an organization — the CEO sets one up without a code, then
// sends an Org Admin invite to whoever will run it (or makes an org code for
// them to start it themselves, under Codes).
export default async function CeoNewOrgPage() {
  await requireCeo();
  return (
    <section className="flex flex-col gap-3">
      <Link href="/ceo/orgs" className="text-xs font-semibold text-brand">← Organizations</Link>
      <div className={`${cardDefault} flex flex-col gap-3`}>
        <h2 className="font-bold text-ink">Start an organization</h2>
        <p className="text-sm text-muted">
          Set it up here and send an Org Admin invite to whoever will run it. Or give them an organization code (Codes tab) so
          they set it up themselves.
        </p>
        <OrgWizard ceo />
      </div>
    </section>
  );
}
