import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getTeamRanking } from "@/lib/leaderboard";
import { EditBrandForm } from "../EditBrandForm";

function formatHeight(inches: number | null): string | null {
  if (inches == null) return null;
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

// A player's team-facing "Your Brand" profile. Viewable by anyone on the SAME
// team (read-only); editable only by the owner. Strictly same-team — a cross-
// team id is refused (CLAUDE.md section 3.2). The journal link is owner-only.
export default async function BrandPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/");

  const targetId = Number.parseInt(userId, 10);
  if (!Number.isInteger(targetId)) redirect("/");

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    include: { profile: true, team: true },
  });
  // Brand pages exist only for onboarded players.
  if (!target || target.role !== "PLAYER" || !target.profile) redirect("/");
  // Strictly same team.
  if (viewer.teamId !== target.teamId) redirect("/");

  const isOwner = viewer.id === target.id;
  const profile = target.profile;
  const height = formatHeight(profile.heightInches);

  const ranking = await getTeamRanking(target.teamId);
  const rank = ranking.findIndex((r) => r.id === target.id) + 1;
  const total = ranking.length;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-red-500">
            Your Brand
          </span>
          <h1 className="text-2xl font-bold tracking-tight">{target.name}</h1>
          <p className="text-sm text-zinc-400">Player · {target.team.name}</p>
        </div>
        <Link
          href="/"
          className="shrink-0 text-sm font-medium text-red-500 hover:underline"
        >
          ← Home
        </Link>
      </header>

      {/* The Dream */}
      <section className="rounded-xl border border-zinc-800 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          The Dream
        </h2>
        <p className="mt-1 text-lg font-medium">{profile.dream}</p>
      </section>

      {/* Points + standing */}
      <section className="grid grid-cols-2 gap-3">
        <Stat label="Points" value={String(profile.points)} />
        <Stat label="Team rank" value={rank > 0 ? `#${rank} of ${total}` : "—"} />
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {profile.position && <Stat label="Position" value={profile.position} />}
        {height && <Stat label="Height" value={height} />}
        {profile.jerseyNumber != null && (
          <Stat label="Jersey" value={`#${profile.jerseyNumber}`} />
        )}
        {profile.pointsPerGame != null && (
          <Stat label="PPG" value={String(profile.pointsPerGame)} />
        )}
        {profile.reboundsPerGame != null && (
          <Stat label="RPG" value={String(profile.reboundsPerGame)} />
        )}
        {profile.assistsPerGame != null && (
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
        <section className="rounded-xl border border-zinc-800 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Highlight
          </h2>
          <a
            href={profile.highlightUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block break-all text-sm font-medium text-red-500 hover:underline"
          >
            {profile.highlightUrl}
          </a>
        </section>
      )}

      {/* Journal link — owner only (journals stay private) */}
      {isOwner && (
        <Link
          href="/journal"
          className="text-sm font-medium text-red-500 hover:underline"
        >
          View your journal →
        </Link>
      )}

      {/* Edit — owner only */}
      {isOwner && <EditBrandForm profile={profile} />}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-900 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}
