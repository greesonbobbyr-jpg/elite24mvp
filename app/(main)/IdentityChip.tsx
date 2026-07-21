import Link from "next/link";
import { PlayerCard } from "@/app/components/PlayerCard";
import { photoSrc } from "@/lib/photoUrl";

// The header identity: just the avatar (team-ring photo, or initials fallback) —
// a PLAYER's photo comes from their PlayerProfile, a COACH's from User.photoUrl.
// Kept minimal for now (no name/label). A player's avatar links to their Brand
// page; a coach's is a non-link.
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
  const photoUrl = photoSrc(
    user.id,
    isPlayer ? (user.profile?.photoUrl ?? null) : user.photoUrl,
  );

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

  if (isPlayer) {
    return (
      <Link
        href={`/brand/${user.id}`}
        aria-label="Your card"
        className="shrink-0 rounded-full transition active:scale-95"
      >
        {avatar}
      </Link>
    );
  }
  return (
    <div aria-label={user.name} className="shrink-0">
      {avatar}
    </div>
  );
}
