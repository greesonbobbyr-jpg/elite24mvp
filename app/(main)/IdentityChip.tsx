import Link from "next/link";
import { PlayerCard, type CardTeam } from "@/app/components/PlayerCard";
import { StaffCard } from "@/app/components/StaffCard";
import { cutoutSrc, photoSrc } from "@/lib/photoUrl";

// The header identity: just the avatar, from the person's Profile. A player's
// is their mini card (their level's ring and card behind their cutout); staff
// get the quiet staff ring. Kept minimal for now (no name/label). A player's
// avatar links to their Brand page; a coach's is a non-link.
type ChipUser = {
  id: number;
  name: string;
  staff: boolean;
  team: CardTeam;
  photoUrl: string | null;
  photoCutoutUrl: string | null;
  photoMeta: unknown;
  jerseyNumber: number | null;
  points: number;
};

export function IdentityChip({ user }: { user: ChipUser }) {
  const photo = {
    photoUrl: photoSrc(user.id, user.photoUrl),
    cutoutUrl: cutoutSrc(user.id, user.photoCutoutUrl),
    photoMeta: user.photoMeta,
  };
  if (user.staff) {
    return (
      <div aria-label={user.name} className="shrink-0">
        <StaffCard size="avatar" person={{ name: user.name, role: "Coach", ...photo }} />
      </div>
    );
  }
  return (
    <Link href={`/brand/${user.id}`} aria-label="Your card" className="shrink-0 rounded-full transition active:scale-95">
      <PlayerCard
        size="avatar"
        player={{ name: user.name, ...photo, jerseyNumber: user.jerseyNumber, points: user.points }}
        team={user.team}
      />
    </Link>
  );
}
