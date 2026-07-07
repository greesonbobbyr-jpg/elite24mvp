import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getTeamRanking } from "@/lib/leaderboard";
import { CardPreview } from "./cards";
import type { CardPlayer, CardTeam } from "@/app/components/PlayerCard";

// Design sandbox for the PlayerCard — reachable only by typing /card-preview,
// not linked from any nav. Pulls a REAL record (the viewer's team + a real player
// + real rank) to prove the component consumes the live Team/PlayerProfile shape
// and the no-color fallback; the client switcher adds fake palettes + a tier
// switcher for live iteration. Wired into no real feature yet.
export default async function CardPreviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ranking = await getTeamRanking(user.teamId);
  const targetId = user.role === "PLAYER" ? user.id : ranking[0]?.id;
  const target = targetId
    ? await prisma.user.findUnique({
        where: { id: targetId },
        include: { profile: true },
      })
    : null;
  const team = await prisma.team.findUnique({ where: { id: user.teamId } });
  const rankEntry = ranking.find((r) => r.id === targetId);

  const realPlayer: CardPlayer = target
    ? {
        name: target.name,
        jerseyNumber: target.profile?.jerseyNumber ?? null,
        position: target.profile?.position ?? null,
        heightInches: target.profile?.heightInches ?? null,
        rank: rankEntry?.rank ?? null,
        points: target.profile?.points ?? 0,
      }
    : { name: user.name, points: 0, rank: null };

  const realTeam: CardTeam = {
    name: team?.name ?? "Your team",
    logoUrl: team?.logoUrl ?? null,
    primaryColor: team?.primaryColor ?? null,
    secondaryColor: team?.secondaryColor ?? null,
  };

  return <CardPreview realPlayer={realPlayer} realTeam={realTeam} />;
}
