// The six board reaction faces, in pill/picker order. Kept as plain constants so
// both the server page (resting pills) and the client picker share one source of
// truth. The `type` strings match the ReactionType enum (prisma/schema.prisma);
// one reaction per person per message (see toggleReaction).
export type ReactionFace = { type: string; emoji: string; label: string };

export const REACTION_FACES: ReactionFace[] = [
  { type: "THUMBS_UP", emoji: "👍", label: "Like" },
  { type: "HEART", emoji: "❤️", label: "Love" },
  { type: "LAUGH", emoji: "😂", label: "Haha" },
  { type: "WOW", emoji: "😮", label: "Wow" },
  { type: "SAD", emoji: "😢", label: "Sad" },
  { type: "PRAY", emoji: "🙏", label: "Respect" },
];

export const EMOJI_BY_TYPE: Record<string, string> = Object.fromEntries(
  REACTION_FACES.map((f) => [f.type, f.emoji]),
);
