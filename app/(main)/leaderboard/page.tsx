import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getTeamRanking, type RankedPlayer } from "@/lib/leaderboard";

// Single-team leaderboard. STRICTLY the current user's own team — no other team
// is queried or shown (CLAUDE.md section 3.2 / 3.5). A coach views their own
// team read-only (not in the players list, so no "YOU"). Each name links to that
// player's team-facing brand page (same team only).
//
// Layout: a spotlight PODIUM for the top 3 (rank 1 centered + larger, 2 left,
// 3 right, with gold/silver/bronze medal rings) and a LIST for rank 4+. Avatars
// are INITIALS placeholders only — photo upload is deliberately NOT built.

// First two initials of a name (mirrors IdentityChip's placeholder avatar).
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

// Medal look per podium SLOT (0 = 1st place, 1 = 2nd, 2 = 3rd). `order` places
// the winner in the center with 2nd on the left and 3rd on the right.
const MEDALS = [
  {
    order: "order-2",
    ring: "#E8C766",
    glow: "rgba(212,175,55,0.55)",
    chipBg: "linear-gradient(180deg,#E8C766,#D4AF37)",
    chipText: "#1a1204",
  },
  {
    order: "order-1",
    ring: "#e5e7eb",
    glow: "rgba(203,213,225,0.45)",
    chipBg: "linear-gradient(180deg,#f1f5f9,#cbd5e1)",
    chipText: "#111827",
  },
  {
    order: "order-3",
    ring: "#d98a4a",
    glow: "rgba(205,127,50,0.45)",
    chipBg: "linear-gradient(180deg,#d98a4a,#b45309)",
    chipText: "#ffffff",
  },
] as const;

function PodiumItem({
  player,
  slot,
}: {
  player: RankedPlayer;
  slot: number;
}) {
  const medal = MEDALS[slot];
  const big = slot === 0;
  const size = big ? 100 : 74;
  return (
    <div className={`flex w-1/3 flex-col items-center ${medal.order} ${big ? "" : "pt-8"}`}>
      <Link
        href={`/brand/${player.id}`}
        className="flex flex-col items-center transition active:scale-[0.97]"
      >
        <span
          className="flex items-center justify-center rounded-full bg-gradient-to-br from-red-700 to-red-950 font-black uppercase text-white"
          style={{
            width: size,
            height: size,
            fontSize: size * 0.34,
            boxShadow: `0 0 0 3px ${medal.ring}, 0 0 26px ${medal.glow}`,
            textShadow: "0 2px 6px rgba(0,0,0,0.5)",
          }}
        >
          {initials(player.name)}
        </span>
        <span
          className="mt-3 rounded-full px-2.5 py-0.5 text-xs font-black tabular-nums shadow-sm"
          style={{ background: medal.chipBg, color: medal.chipText }}
        >
          #{player.rank}
        </span>
        <span
          className={`mt-2 max-w-full truncate font-black uppercase tracking-tight text-white ${
            big ? "text-lg" : "text-sm"
          }`}
        >
          {firstName(player.name)}
        </span>
        <span className="mt-0.5 flex items-baseline gap-1">
          <span className="text-base font-black tabular-nums text-white">
            {player.points.toLocaleString()}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wide text-white/50">
            pts
          </span>
        </span>
      </Link>
    </div>
  );
}

export default async function LeaderboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const ranked = await getTeamRanking(user.teamId);
  const podium = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const logoUrl = user.team.logoUrl;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-6 py-10">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="e24-eyebrow">Leaderboard</p>
          <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-white">
            {user.team.name}
          </h1>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Your team · updated live
          </p>
        </div>
        {logoUrl ? (
          // Plain <img>: team logos are team-controlled arbitrary URLs, so we
          // avoid next/image's remote-domain allowlist. No logo → render nothing.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={`${user.team.name} logo`}
            className="h-14 w-14 shrink-0 object-contain"
          />
        ) : null}
      </header>

      {/* Podium — top 3 */}
      {podium.length > 0 && (
        <section className="e24-surface rounded-2xl border border-red-600/25 px-4 py-6">
          <div className="relative z-10 flex items-end justify-center gap-2">
            {podium.map((player, i) => (
              <PodiumItem key={player.id} player={player} slot={i} />
            ))}
          </div>
        </section>
      )}

      {/* List — rank 4+ */}
      {rest.length > 0 && (
        <section>
          <div className="mb-3 h-px w-full bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
          <ul className="flex flex-col gap-2">
            {rest.map((player) => {
              const isMe = player.id === user.id;
              return (
                <li key={player.id}>
                  <Link
                    href={`/brand/${player.id}`}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                      isMe
                        ? "bg-red-600/15 ring-1 ring-red-500/40"
                        : "bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="w-7 shrink-0 text-center text-sm font-black tabular-nums text-zinc-500">
                      {player.rank}
                    </span>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-700 to-red-950 text-xs font-bold text-white ring-1 ring-red-500/40">
                      {initials(player.name)}
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-wide ${
                        isMe ? "text-red-400" : "text-white"
                      }`}
                    >
                      {player.name}
                      {isMe && " · You"}
                    </span>
                    <span className="flex shrink-0 items-baseline gap-1">
                      <span className="text-sm font-black tabular-nums text-white">
                        {player.points.toLocaleString()}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-white/40">
                        pts
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
