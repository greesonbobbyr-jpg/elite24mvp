import Link from "next/link";
import { PlayerCard } from "@/app/components/PlayerCard";
import { photoSrc } from "@/lib/photoUrl";
import { roleLabel } from "@/lib/format";
import type { OrgPerson, OrgViewTeam } from "@/lib/orgview";

// EVERY person in the Org View renders through the existing PlayerCard system
// (compact size) with the role labeled beside it — the established
// caller-label convention (see CoachHome). PlayerCard itself is unmodified.
// Players link to their Brand page (org staff may view per the 4b resolver);
// staff cards are terminal — no staff page exists yet.
export function PersonCard({
  person,
  team,
  highlighted,
}: {
  person: OrgPerson;
  team: OrgViewTeam;
  highlighted?: boolean;
}) {
  const label = roleLabel(person.role);
  const card = (
    <div
      id={`person-${person.userId}`}
      className={`relative rounded-xl ${highlighted ? "ring-2 ring-red-400" : ""}`}
    >
      <PlayerCard
        size="compact"
        player={{
          name: person.name,
          jerseyNumber: person.jerseyNumber,
          position: person.position,
          points: person.points,
          photoUrl: photoSrc(person.userId, person.photoUrl),
        }}
        team={team}
      />
      {label && (
        <span className="absolute -top-1.5 right-2 rounded-full bg-red-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-white shadow">
          {label}
        </span>
      )}
    </div>
  );

  if (person.role === "PLAYER") {
    return (
      <Link
        href={`/brand/${person.userId}`}
        className="block transition hover:opacity-90 active:scale-[0.99]"
      >
        {card}
      </Link>
    );
  }
  return card;
}

// STAFF row above PLAYERS row; either section disappears entirely when empty.
export function TeamContents({
  team,
  hl,
}: {
  team: OrgViewTeam;
  hl: number | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      {team.staff.length > 0 && (
        <section>
          <p className="e24-eyebrow mb-1.5">Staff</p>
          <div className="flex flex-col gap-1.5">
            {team.staff.map((p) => (
              <PersonCard key={p.userId} person={p} team={team} highlighted={p.userId === hl} />
            ))}
          </div>
        </section>
      )}
      {team.players.length > 0 ? (
        <section>
          <p className="e24-eyebrow mb-1.5">Players · {team.players.length}</p>
          <div className="flex flex-col gap-1.5">
            {team.players.map((p) => (
              <PersonCard key={p.userId} person={p} team={team} highlighted={p.userId === hl} />
            ))}
          </div>
        </section>
      ) : (
        <p className="text-xs text-zinc-600">No players yet.</p>
      )}
    </div>
  );
}
