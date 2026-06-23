import { prisma } from "./lib/prisma";
(async () => {
  const us = await prisma.user.findMany({ where: { OR: [{ name: "Jordan Carter" }, { name: "Coach Marcus Bell" }, { name: "Marcus Green" }] }, select: { id:true, name:true } });
  for (const u of us) console.log(`${u.name}=${u.id}`);
  await prisma.$disconnect();
})();
