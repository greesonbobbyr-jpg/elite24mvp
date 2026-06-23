import { prisma } from "./lib/prisma";
import { isValidGifId } from "./lib/gifs";

(async () => {
  console.log("isValidGifId('__tmp_test')=" + isValidGifId("__tmp_test")); // now true
  const aUser = await prisma.user.findFirst({
    where: { name: "Jordan Carter" },
    select: { id: true, teamId: true },
  });
  const msg = await prisma.teamMessage.create({
    data: { teamId: aUser!.teamId, authorId: aUser!.id, body: "GIF round-trip", gifId: "__tmp_test" },
  });
  console.log("CREATED_MSG_ID=" + msg.id);
  await prisma.$disconnect();
})();
