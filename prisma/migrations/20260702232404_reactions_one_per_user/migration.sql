-- Move MessageReaction to ONE reaction per person per message (Messenger-style).
-- The ReactionType enum gained LAUGH/WOW/SAD/PRAY, but SQLite stores enums as
-- TEXT with no CHECK constraint, so that change emits no SQL — only the unique
-- index changes below.

-- Safety: before tightening the unique constraint to (messageId, userId), keep
-- only the MOST RECENT reaction per (message, user). Existing data could hold two
-- rows for one user on one message (old model allowed one per reactionType); the
-- new UNIQUE index would fail on those without this de-dupe.
DELETE FROM "MessageReaction"
WHERE "id" NOT IN (
  SELECT MAX("id") FROM "MessageReaction" GROUP BY "messageId", "userId"
);

-- DropIndex
DROP INDEX "MessageReaction_messageId_userId_reactionType_key";

-- CreateIndex
CREATE UNIQUE INDEX "MessageReaction_messageId_userId_key" ON "MessageReaction"("messageId", "userId");
