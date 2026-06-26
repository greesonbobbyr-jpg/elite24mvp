import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getTeamRanking } from "@/lib/leaderboard";

// Single-team leaderboard. STRICTLY the current user's own team — no other team
// is queried or shown (CLAUDE.md section 3.2 / 3.5). A coach views their own
// team read-only. Each name links to that player's team-facing brand page
// (same team only).
export default async function LeaderboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const ranked = await getTeamRanking(user.teamId);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-sm text-zinc-500">{user.team.name}</p>
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-red-500 hover:underline"
        >
          ← Home
        </Link>
      </header>

      <ol className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/40">
        {ranked.map((player, index) => {
          const isMe = player.id === user.id;
          return (
            <li
              key={player.id}
              className={`flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 transition last:border-b-0 ${
                isMe ? "bg-red-600/10" : "hover:bg-white/[0.03]"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-right text-sm font-bold tabular-nums text-zinc-500">
                  {index + 1}
                </span>
                <Link
                  href={`/brand/${player.id}`}
                  className={`text-sm hover:underline ${isMe ? "font-bold text-red-500" : ""}`}
                >
                  {player.name}
                  {isMe ? " (you)" : ""}
                </Link>
              </div>
              <span className="text-sm font-semibold tabular-nums">
                {player.points}
              </span>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
