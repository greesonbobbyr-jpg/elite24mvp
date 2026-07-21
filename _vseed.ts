import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
(async () => {
  for (const jc of ["MUSTNG", "THUNDR"]) {
    const t = await prisma.team.findUnique({ where: { joinCode: jc } });
    console.log(`${t!.name}: primary=${t!.primaryColor} secondary=${t!.secondaryColor} logo=${t!.logoUrl ?? "(none)"} code=${t!.joinCode}`);
  }
  const gary = await prisma.user.findUnique({ where: { email: "gary@elite24.demo" }, select: { name: true, role: true } });
  const riley = await prisma.user.findUnique({ where: { email: "riley@elite24.demo" }, select: { name: true, role: true } });
  console.log(`coaches: ${gary!.name}/${gary!.role}, ${riley!.name}/${riley!.role}`);
  const jordan = await prisma.user.findUnique({ where: { username: "jordan" }, select: { profile: { select: { jerseyNumber: true, points: true } } } });
  console.log(`jordan #${jordan!.profile!.jerseyNumber} pts=${jordan!.profile!.points}`);
  for (const jc of ["MUSTNG", "THUNDR"]) {
    const t = await prisma.team.findUnique({ where: { joinCode: jc }, select: { id: true, name: true } });
    const players = await prisma.user.findMany({ where: { teamId: t!.id, role: "PLAYER" }, select: { username: true, profile: { select: { points: true } } } });
    const spread = players.map((p) => `${p.username}:${p.profile?.points ?? "no-profile"}`).join(", ");
    console.log(`${t!.name} spread: ${spread}`);
  }
  await prisma.$disconnect();
})();
