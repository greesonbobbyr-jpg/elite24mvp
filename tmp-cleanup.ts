import { prisma } from "./lib/prisma";
(async () => {
  const r = await prisma.teamMessage.deleteMany({ where: { gifId: "__tmp_test" } });
  console.log("deleted_temp_msgs=" + r.count);
  await prisma.$disconnect();
})();
