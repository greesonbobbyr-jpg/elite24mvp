import Link from "next/link";
import { PlayerCard, type CardTeam } from "@/app/components/PlayerCard";
import { StaffCard } from "@/app/components/StaffCard";
import { cutoutSrc, photoSrc } from "@/lib/photoUrl";

// The header identity: just the avatar. A player's is their mini card (their
// level's ring and card behind their cutout), from their Profile; staff get
// the quiet staff ring, from User. Kept minimal for now (no name/label). A
// player's avatar links to their Brand page; a coach's is a non-link.
type Photo = { photoUrl: string | null; photoCutoutUrl: string | null; photoMeta: unknown };

type ChipUser = Photo & {
  id: number;
  name: string;
  staff: boolean;
  team: CardTeam;
  profile: (Photo & { jerseyNumber: number | null; points: number }) | null;
};

export function IdentityChip({ user }: { user: ChipUser }) {
  if (user.staff) {
    return (
      <div aria-label={user.name} className="shrink-0">
        <StaffCard
          size="avatar"
          person={{
            name: user.name,
            role: "Coach",
            photoUrl: photoSrc(user.id, user.photoUrl),
            cutoutUrl: cutoutSrc(user.id, user.photoCutoutUrl),
            photoMeta: user.photoMeta,
          }}
        />
      </div>
    );
  }
  return (
    <Link href={`/brand/${user.id}`} aria-label="Your card" className="shrink-0 rounded-full transition active:scale-95">
      <PlayerCard
        size="avatar"
        player={{
          name: user.name,
          photoUrl: photoSrc(user.id, user.profile?.photoUrl ?? null),
          cutoutUrl: cutoutSrc(user.id, user.profile?.photoCutoutUrl ?? null),
          photoMeta: user.profile?.photoMeta,
          jerseyNumber: user.profile?.jerseyNumber ?? null,
          points: user.profile?.points ?? 0,
        }}
        team={user.team}
      />
    </Link>
  );
}
