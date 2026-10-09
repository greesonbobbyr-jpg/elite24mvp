import Link from "next/link";
import { ceoOverview } from "@/lib/data/ceo";
import { requireCeo } from "./gate";
import { cardDefault } from "@/app/components/ui/Card";
import { chipClass } from "@/app/components/ui/Pill";
import { StatTile } from "@/app/components/ui/StatTile";

// CEO View · Overview — the whole app in numbers.
export default async function CeoOverviewPage() {
  const o = await ceoOverview(await requireCeo());
  const tiles: [string, number][] = [
    ["Organizations", o.organizations],
    ["Teams", o.teams],
    ["Players", o.players],
    ["Coaches & staff", o.staff],
    ["Checked in today", o.checkedInToday],
    ["Athletes with no team", o.noTeam],
  ];
  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map(([label, value]) => (
          <StatTile key={label} label={label}>
            <p className="text-xl font-black leading-none text-ink">{value.toLocaleString()}</p>
          </StatTile>
        ))}
      </div>
      {o.noEmail > 0 && (
        <div className={`${cardDefault} flex items-center gap-3 p-4`}>
          <span className={chipClass("warn")}>{o.noEmail}</span>
          <span className="flex-1 text-sm text-ink-mid">
            {o.noEmail === 1 ? "account still logs in" : "accounts still log in"} with a username only (no email yet)
          </span>
        </div>
      )}
      <Link href="/ceo/orgs" className={`${cardDefault} flex items-center justify-between p-4`}>
        <span className="text-sm font-semibold text-ink">Browse every organization</span>
        <span className="text-xs font-semibold text-brand">Open →</span>
      </Link>
      <p className="text-xs text-subtle">
        🔒 Players&apos; journals and reflections are private to each player — CEO View never shows them.
      </p>
    </section>
  );
}
