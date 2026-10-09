import Link from "next/link";
import { notFound } from "next/navigation";
import { personDetail, recordAudit } from "@/lib/data/ceo";
import { requireCeo } from "../../gate";
import { roleLabel } from "@/lib/format";
import { formatHeight } from "@/lib/height";
import { cardDefault, rowNested } from "@/app/components/ui/Card";
import { chipClass } from "@/app/components/ui/Pill";

// CEO View · one person: their teams, their card, and this week's activity as
// counts. Never their journal or reflections. Opening it is recorded.
export default async function CeoPersonPage({ params }: { params: Promise<{ profileId: string }> }) {
  const ceo = await requireCeo();
  const id = Number.parseInt((await params).profileId, 10);
  if (!Number.isInteger(id)) notFound();
  const p = await personDetail(ceo, id);
  if (!p) notFound();
  const active = p.memberships.find((m) => m.active);
  await recordAudit(ceo, "ceo.view_person", {
    targetProfileId: p.id,
    teamId: active?.teamId ?? null,
    detail: p.name,
  });
  const height = formatHeight(p.card.heightInches);

  return (
    <section className="flex flex-col gap-3">
      <Link href="/ceo/people" className="text-xs font-semibold text-brand">← People</Link>
      <div>
        <h2 className="text-xl font-black text-ink">{p.name}</h2>
        <p className="text-xs text-subtle">
          {p.email ?? (p.username ? `${p.username} (username only)` : "No login")} · joined{" "}
          {p.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      </div>

      <div className={`${cardDefault} flex flex-col gap-2 p-4`}>
        <h3 className="e24-eyebrow">Teams</h3>
        {p.memberships.length === 0 && p.orgAdminOf.length === 0 && (
          <p className="text-sm text-muted">No team — training on their own.</p>
        )}
        {p.orgAdminOf.map((o) => (
          <Link key={`admin-${o.id}`} href={`/ceo/orgs/${o.id}`} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-ink">{o.name}</span>
            <span className={chipClass("accent")}>Org Admin</span>
          </Link>
        ))}
        {p.memberships.map((m, i) => (
          <Link key={i} href={`/ceo/teams/${m.teamId}`} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0">
              <span className="block truncate font-semibold text-ink">{m.team}</span>
              <span className="block truncate text-xs text-subtle">
                {[m.org, `${m.season} season`].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className={chipClass(m.active ? (m.role === "PLAYER" ? "neutral" : "accent") : "warn")}>
              {m.active ? (roleLabel(m.role) ?? "Player") : "Ended"}
            </span>
          </Link>
        ))}
      </div>

      <div className={`${cardDefault} flex flex-col gap-1.5 p-4 text-sm text-ink`}>
        <h3 className="e24-eyebrow">Card</h3>
        <p>
          {p.card.stars}-star Prospect · {p.card.careerPoints.toLocaleString()} career pts
          {p.card.position ? ` · ${p.card.position}` : ""}
          {p.card.jerseyNumber != null ? ` · #${p.card.jerseyNumber}` : ""}
          {height ? ` · ${height}` : ""}
        </p>
        <p>🔥 {p.card.currentStreak}-day streak (best {p.card.bestStreak})</p>
        {p.card.dream && <p><span className="font-semibold">Dream:</span> {p.card.dream}</p>}
      </div>

      <div className={`${cardDefault} p-4 text-sm text-ink`}>
        <h3 className="e24-eyebrow">This week</h3>
        <p className="mt-1.5">
          {p.thisWeek.checkIns} check-ins · {p.thisWeek.quests} quests · {p.thisWeek.reviews} Pro Reviews
        </p>
      </div>

      <div className={`${rowNested} px-3 py-2 text-sm text-muted`}>
        🔒 Journal and reflections are private to the player — not even the CEO sees them.
      </div>
    </section>
  );
}
