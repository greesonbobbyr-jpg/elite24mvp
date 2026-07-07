import Link from "next/link";
import { PlayerCard } from "@/app/components/PlayerCard";

// The header identity chip. Both roles get an avatar-size PlayerCard (team ring +
// photo/initials): a PLAYER's photo comes from their PlayerProfile, a COACH's from
// User.photoUrl (uploaded in Team Settings). A player's chip links to their Brand
// page; a coach's is a non-link.

const chipClass =
  "flex max-w-[58vw] items-center gap-2.5 rounded-full border border-red-600/30 bg-gradient-to-br from-zinc-900 to-black py-1.5 pl-1.5 pr-3 shadow-[0_0_0_1px_rgba(220,38,38,0.12),0_4px_14px_-6px_rgba(0,0,0,0.7)]";

type ChipUser = {
  id: number;
  name: string;
  role: string;
  photoUrl: string | null;
  team: {
    name: string;
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
  };
  profile: {
    photoUrl: string | null;
    jerseyNumber: number | null;
    points: number;
  } | null;
};

export function IdentityChip({ user }: { user: ChipUser }) {
  const isPlayer = user.role === "PLAYER";
  const photoUrl = isPlayer ? (user.profile?.photoUrl ?? null) : user.photoUrl;

  const avatar = (
    <PlayerCard
      size="avatar"
      player={{
        name: user.name,
        photoUrl,
        jerseyNumber: user.profile?.jerseyNumber ?? null,
        points: user.profile?.points ?? 0,
      }}
      team={user.team}
    />
  );

  const inner = (
    <>
      {avatar}
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold text-white">
          {user.name}
        </span>
        {isPlayer ? (
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-red-400">
            Your Card →
          </span>
        ) : (
          <span className="block text-[10px] uppercase tracking-wide text-zinc-500">
            Coach
          </span>
        )}
      </span>
    </>
  );

  if (isPlayer) {
    return (
      <Link
        href={`/brand/${user.id}`}
        className={`${chipClass} transition hover:border-red-500/60 active:scale-[0.98]`}
      >
        {inner}
      </Link>
    );
  }
  return <div className={chipClass}>{inner}</div>;
}
