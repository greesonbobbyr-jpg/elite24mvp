import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/context";
import { isAthlete, resolveBrandAccess } from "@/lib/brand-access";
import { getTeamRanking } from "@/lib/leaderboard";
import { EditBrandForm } from "../EditBrandForm";
import { Card } from "@/app/components/ui/Card";
import { PERSONAL_CARD_TEAM, PlayerCard } from "@/app/components/PlayerCard";
import { photoSrc, cutoutSrc } from "@/lib/photoUrl";
import { formatHeight } from "@/lib/height";

// A player's team-facing "Your Brand" profile. Access is org-bounded via
// lib/brand-access: the owner sees everything and can edit; org STAFF get the
// full read-only view; a TEAMMATE gets CARD INFO ONLY — the Dream and
// per-game stats are not teammate-visible (§2.10 ruling: the Dream lives on
// the athlete's own Home).
// Anyone else — including all of other organizations — is refused.
export default async function BrandPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/");

  const targetId = Number.parseInt(userId, 10);
  if (!Number.isInteger(targetId)) redirect("/");

  const resolved = await resolveBrandAccess(ctx, targetId);
  if (!resolved || resolved.access === null) redirect("/");
  const { target, access, team } = resolved;
  const profile = target.profile;
  // Brand pages exist only for athletes who have set up (written their Dream).
  if (!profile || !isAthlete(target) || profile.setupCompletedAt == null) redirect("/");

  const isOwner = access === "self";
  // Card info only for teammates — Dream + per-game stats are staff/self.
  const fullView = access === "self" || access === "staff";
  const height = formatHeight(profile.heightInches);
  // Card tier/points = CAREER points (crosses orgs by design — it's the
  // athlete's own progression).
  const careerPoints = profile.careerPoints;

  const ranking = team != null ? await getTeamRanking(team.id) : [];
  const rank = ranking.findIndex((r) => r.id === target.id) + 1;
  const total = ranking.length;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      {/* Identity hero — the full player card */}
      <div className="flex flex-col items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-brand">
          Your Brand
        </span>
        <PlayerCard
          size="full"
          player={{
            name: target.name,
            jerseyNumber: profile.jerseyNumber,
            position: profile.position,
            heightInches: profile.heightInches,
            rank: rank > 0 ? rank : null,
            points: careerPoints,
            total: careerPoints,
            rosterSize: total,
            photoUrl: photoSrc(target.id, profile.photoUrl),
            cutoutUrl: cutoutSrc(target.id, profile.photoCutoutUrl),
            photoMeta: profile.photoMeta,
          }}
          team={team ?? PERSONAL_CARD_TEAM}
        />
      </div>

      {/* The Dream — self + staff only (no longer teammate-visible) */}
      {fullView && (
        <Card>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-brand">
            The Dream
          </h2>
          <p className="mt-1 text-lg font-medium">{profile.dream}</p>
        </Card>
      )}

      {/* Points + standing */}
      <section className="grid grid-cols-2 gap-3">
        <Stat label="Points" value={String(careerPoints)} />
        <Stat label="Team rank" value={rank > 0 ? `#${rank} of ${total}` : "—"} />
      </section>

      {/* Stats — per-game numbers are self + staff only */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {profile.position && <Stat label="Position" value={profile.position} />}
        {height && <Stat label="Height" value={height} />}
        {profile.jerseyNumber != null && (
          <Stat label="Jersey" value={`#${profile.jerseyNumber}`} />
        )}
        {fullView && profile.pointsPerGame != null && (
          <Stat label="PPG" value={String(profile.pointsPerGame)} />
        )}
        {fullView && profile.reboundsPerGame != null && (
          <Stat label="RPG" value={String(profile.reboundsPerGame)} />
        )}
        {fullView && profile.assistsPerGame != null && (
          <Stat label="APG" value={String(profile.assistsPerGame)} />
        )}
        {profile.favoritePlayer && (
          <Stat label="Favorite player" value={profile.favoritePlayer} />
        )}
        {profile.favoriteTeam && (
          <Stat label="Favorite team" value={profile.favoriteTeam} />
        )}
      </section>

      {/* Highlight — a pasted link only */}
      {profile.highlightUrl && (
        <Card>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-brand">
            Highlight
          </h2>
          <a
            href={profile.highlightUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block break-all text-sm font-medium text-brand hover:underline"
          >
            {profile.highlightUrl}
          </a>
        </Card>
      )}

      {/* Edit — owner only */}
      {isOwner && <EditBrandForm profile={profile} />}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2 shadow-sm shadow-shade">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-subtle">
        {label}
      </div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}
