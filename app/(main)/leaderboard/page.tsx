import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/context";
import {
  getTeamRanking,
  getWeeklyRanking,
  type RankedPlayer,
} from "@/lib/leaderboard";
import { PlayerCard, type CardTeam } from "@/app/components/PlayerCard";
import { cutoutSrc, photoSrc } from "@/lib/photoUrl";

// Single-team leaderboard. STRICTLY the current user's own team — no other team
// is queried or shown (CLAUDE.md section 3.2 / 3.5). A coach views their own
// team read-only (not in the players list, so no "YOU"). Each name links to that
// player's team-facing brand page (same team only).
//
// Layout: a spotlight PODIUM for the top 3 (rank 1 centered + larger, 2 left,
// 3 right, with gold/silver/bronze medal glows) and a LIST of compact PlayerCards
// for rank 4+. The podium shows each player's own card — the full layout at a
// smaller size, as on their Brand page (owner, 2026-09-28).

// Medal look per podium SLOT (0 = 1st place, 1 = 2nd, 2 = 3rd). `order` places
// the winner in the center with 2nd on the left and 3rd on the right.
const MEDALS = [
  {
    order: "order-2",
    glow: "rgba(212,175,55,0.55)",
    chipBg: "linear-gradient(180deg,#E8C766,#D4AF37)",
    chipText: "#1a1204",
  },
  {
    order: "order-1",
    glow: "rgba(203,213,225,0.45)",
    chipBg: "linear-gradient(180deg,#f1f5f9,#cbd5e1)",
    chipText: "#111827",
  },
  {
    order: "order-3",
    glow: "rgba(205,127,50,0.45)",
    chipBg: "linear-gradient(180deg,#d98a4a,#b45309)",
    chipText: "#ffffff",
  },
] as const;

function PodiumItem({
  player,
  slot,
  team,
  rosterSize,
}: {
  player: Omit<RankedPlayer, "photoCutoutUrl"> & { cutoutUrl: string | null };
  slot: number;
  team: CardTeam;
  rosterSize: number;
}) {
  const medal = MEDALS[slot];
  const big = slot === 0;
  return (
    // 1st place gets the wider column and stands taller; the cards fill their
    // columns, so the podium fits from a 320px phone up.
    <div className={`flex min-w-0 flex-col items-center ${medal.order} ${big ? "flex-[1.25_1_0%]" : "flex-1 pt-8"}`}>
      <Link
        href={`/brand/${player.id}`}
        aria-label={`#${player.rank} ${player.name}, ${player.points.toLocaleString()} points`}
        className="flex w-full flex-col items-center transition active:scale-[0.97]"
      >
        {/* The player's card, as on their Brand page; the medal glow and
            chip carry the podium place. */}
        <span className="block w-full" style={{ maxWidth: big ? 132 : 104, filter: `drop-shadow(0 0 14px ${medal.glow})` }}>
          <PlayerCard
            size="mini"
            player={{
              name: player.name,
              jerseyNumber: player.jerseyNumber,
              position: player.position,
              rank: player.rank,
              rosterSize,
              points: player.careerPoints,
              total: player.careerPoints,
              photoUrl: player.photoUrl,
              cutoutUrl: player.cutoutUrl,
              photoMeta: player.photoMeta,
            }}
            team={team}
          />
        </span>
        <span
          className="mt-2.5 rounded-full px-2.5 py-0.5 text-xs font-black tabular-nums shadow-sm"
          style={{ background: medal.chipBg, color: medal.chipText }}
        >
          #{player.rank}
        </span>
        <span className="mt-1 flex items-baseline gap-1">
          <span className="text-base font-black tabular-nums text-ink">
            {player.points.toLocaleString()}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wide text-ink/50">
            pts
          </span>
        </span>
      </Link>
    </div>
  );
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const ctx = await getCurrentContext();
  const user = ctx?.user;
  if (!ctx || !user) redirect("/");
  // Re-home (4f): no roster spot → no team board.
  if (user.role === "PLAYER" && ctx.profile && !ctx.membership) redirect("/");

  const { view } = await searchParams;
  const weekView = view === "week";

  // Boards are the ACTING membership's team (4d); legacy teamId fallback.
  const boardTeamId = ctx.membership?.teamId ?? user.teamId;
  // photoSrc/cutoutSrc: serve photos via /api/photo instead of inlining base64 into HTML.
  const ranked = (await getTeamRanking(boardTeamId)).map(({ photoCutoutUrl, ...p }) => ({
    ...p,
    photoUrl: photoSrc(p.id, p.photoUrl),
    cutoutUrl: cutoutSrc(p.id, photoCutoutUrl),
  }));
  const weekly = weekView
    ? (await getWeeklyRanking(boardTeamId)).map(({ photoCutoutUrl, ...p }) => ({
        ...p,
        photoUrl: photoSrc(p.id, p.photoUrl),
        cutoutUrl: cutoutSrc(p.id, photoCutoutUrl),
      }))
    : [];
  // "Most improved": biggest positive gain vs. your OWN last week.
  const mostImprovedId = weekly.reduce<{ id: number; delta: number } | null>(
    (best, p) =>
      p.delta > 0 && (!best || p.delta > best.delta)
        ? { id: p.id, delta: p.delta }
        : best,
    null,
  )?.id;
  const podium = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const logoUrl = user.team.logoUrl;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-6 py-10">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="e24-eyebrow">Leaderboard</p>
          <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-ink">
            {user.team.name}
          </h1>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-subtle">
            Your team · updated live
          </p>
        </div>
        {logoUrl ? (
          // Plain <img>: team logos are team-controlled arbitrary URLs, so we
          // avoid next/image's remote-domain allowlist. No logo → render nothing.
          // On a black tile: logos are drawn for the black brand (white
          // outlines vanish on a light page); in dark mode the tile blends in.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={`${user.team.name} logo`}
            className="h-14 w-14 shrink-0 rounded-xl bg-black object-contain p-1"
          />
        ) : null}
      </header>

      {/* View tabs: all-time vs weekly sprint (resets every Monday) */}
      <div className="flex gap-2">
        <Link
          href="/leaderboard"
          className={`rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
            !weekView
              ? "border-red-500 bg-red-600/20 text-brand-3"
              : "border-ink/15 text-muted hover:border-ink/30"
          }`}
        >
          All-time
        </Link>
        <Link
          href="/leaderboard?view=week"
          className={`rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
            weekView
              ? "border-red-500 bg-red-600/20 text-brand-3"
              : "border-ink/15 text-muted hover:border-ink/30"
          }`}
        >
          This week
        </Link>
      </div>

      {/* Weekly sprint — everyone starts Monday at 0 (keeps the whole roster in
          the race), with a "most improved vs your own last week" badge. */}
      {weekView && (
        <section>
          <ul className="flex flex-col gap-2">
            {weekly.map((p) => {
              const isMe = p.id === user.id;
              return (
                <li key={p.id}>
                  <Link
                    href={`/brand/${p.id}`}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                      isMe
                        ? "bg-red-600/15 ring-1 ring-red-500/40"
                        : "bg-ink/[0.02] hover:bg-ink/[0.05]"
                    }`}
                  >
                    <span className="w-7 shrink-0 text-center text-sm font-black tabular-nums text-subtle">
                      {p.rank}
                    </span>
                    <PlayerCard
                      size="avatar"
                      player={{
                        name: p.name,
                        jerseyNumber: p.jerseyNumber,
                        points: p.weekPoints,
                        total: p.careerPoints,
                        photoUrl: p.photoUrl,
                        cutoutUrl: p.cutoutUrl,
                        photoMeta: p.photoMeta,
                      }}
                      team={user.team}
                    />
                    <span
                      className={`min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-wide ${
                        isMe ? "text-brand-2" : "text-ink"
                      }`}
                    >
                      {p.name}
                      {isMe && " · You"}
                    </span>
                    {p.id === mostImprovedId && (
                      <span className="shrink-0 rounded-full bg-green-600/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-good">
                        ▲ Most improved
                      </span>
                    )}
                    <span className="flex shrink-0 items-baseline gap-1">
                      <span className="text-sm font-black tabular-nums text-ink">
                        {p.weekPoints.toLocaleString()}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-ink/40">
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

      {/* Podium — top 3 */}
      {!weekView && podium.length > 0 && (
        <section className="e24-surface rounded-2xl border border-red-600/25 px-4 py-6">
          <div className="relative z-10 flex items-end justify-center gap-2">
            {podium.map((player, i) => (
              <PodiumItem key={player.id} player={player} slot={i} team={user.team} rosterSize={ranked.length} />
            ))}
          </div>
        </section>
      )}

      {/* List — rank 4+ */}
      {!weekView && rest.length > 0 && (
        <section>
          <div className="mb-3 h-px w-full bg-gradient-to-r from-transparent via-line-strong to-transparent" />
          <ul className="flex flex-col gap-2">
            {rest.map((player) => {
              const isMe = player.id === user.id;
              return (
                <li key={player.id}>
                  <Link
                    href={`/brand/${player.id}`}
                    className={`relative block rounded-xl transition active:scale-[0.99] ${
                      isMe ? "ring-2 ring-red-400" : "hover:opacity-90"
                    }`}
                  >
                    <PlayerCard
                      size="compact"
                      player={{
                        name: player.name,
                        jerseyNumber: player.jerseyNumber,
                        position: player.position,
                        rank: player.rank,
                        points: player.points,
                        total: player.careerPoints,
                        photoUrl: player.photoUrl,
                        cutoutUrl: player.cutoutUrl,
                        photoMeta: player.photoMeta,
                      }}
                      team={user.team}
                    />
                    {isMe && (
                      <span className="absolute -top-1.5 right-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-white shadow">
                        You
                      </span>
                    )}
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
