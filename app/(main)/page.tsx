import { getCurrentUser } from "@/lib/session";

function formatHeight(inches: number | null | undefined): string | null {
  if (inches == null) return null;
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Dev build
        </span>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Elite24MVP
        </h1>
        <p className="max-w-sm text-sm text-zinc-500">
          No user selected. Use the <strong>Dev: switch user</strong> menu in the
          bottom-left corner to view the app as a coach or a player.
        </p>
      </main>
    );
  }

  const profile = user.profile;
  const height = formatHeight(profile?.heightInches);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Viewing as
        </span>
        <h1 className="text-3xl font-bold tracking-tight">{user.name}</h1>
        <p className="text-sm text-zinc-500">
          {user.role === "COACH" ? "Coach" : "Player"} · {user.team.name}
        </p>
      </header>

      {user.role === "PLAYER" && profile ? (
        <>
          <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              The Dream
            </h2>
            <p className="mt-1 text-lg font-medium">{profile.dream}</p>
          </section>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Points" value={String(profile.points)} />
            {profile.position && (
              <Stat label="Position" value={profile.position} />
            )}
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
          </section>
        </>
      ) : (
        <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <p className="text-sm text-zinc-500">
            Coach view. Team roster and coaching tools arrive in later phases.
          </p>
        </section>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-900">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}
