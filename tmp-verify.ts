import { prisma } from "./lib/prisma";
import { listTeamMessages } from "./lib/board";
import { GIFS, getGif, isValidGifId } from "./lib/gifs";

(async () => {
  console.log("REGISTRY_SIZE=" + GIFS.length);
  console.log("isValidGifId('anything')=" + isValidGifId("anything"));
  console.log("isValidGifId('bball-bounce')=" + isValidGifId("bball-bounce"));
  console.log("getGif('anything')=" + getGif("anything"));

  // gifId column round-trip at the data layer (independent of the empty registry):
  // create a Team A message carrying a gifId, confirm it comes back, then clean up.
  const aUser = await prisma.user.findFirst({
    where: { team: { name: "Team A" } },
    select: { id: true, teamId: true },
  });
  const tmp = await prisma.teamMessage.create({
    data: { teamId: aUser!.teamId, authorId: aUser!.id, body: "", gifId: "round-trip-test" },
  });
  const msgs = await listTeamMessages(aUser!.teamId);
  const found = msgs.find((m) => m.id === tmp.id);
  console.log("ROUND_TRIP_gifId=" + found?.gifId);
  console.log("ROUND_TRIP_body_empty=" + (found?.body === ""));
  // With an empty registry, getGif() returns undefined → board renders no <img> (graceful).
  console.log("UNKNOWN_GIF_RENDERS_NOTHING=" + (getGif(found?.gifId) === undefined));
  await prisma.teamMessage.delete({ where: { id: tmp.id } });

  await prisma.$disconnect();
})();
