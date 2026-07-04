// Board reaction faces + composer quick-emoji tray. Kept as plain constants so
// the server page (resting badge), the client picker, and the composer share one
// source of truth. `type` strings match the ReactionType enum. `svg` points at a
// self-hosted high-quality emoji image (public/emoji/, Twemoji — CC-BY 4.0) so
// the glyphs render crisply and consistently instead of the OS emoji font.
export type ReactionFace = { type: string; emoji: string; svg: string; label: string };

export const REACTION_FACES: ReactionFace[] = [
  { type: "THUMBS_UP", emoji: "👍", svg: "/emoji/1f44d.svg", label: "Like" },
  { type: "HEART", emoji: "❤️", svg: "/emoji/2764.svg", label: "Love" },
  { type: "LAUGH", emoji: "😂", svg: "/emoji/1f602.svg", label: "Haha" },
  { type: "WOW", emoji: "😮", svg: "/emoji/1f62e.svg", label: "Wow" },
  { type: "SAD", emoji: "😢", svg: "/emoji/1f622.svg", label: "Sad" },
  { type: "PRAY", emoji: "🙏", svg: "/emoji/1f64f.svg", label: "Respect" },
];

// The composer's quick-insert tray. The button shows the crisp `svg`, but tapping
// inserts the plain Unicode `char` into the text (typed message bodies stay
// native — only reactions + this tray use the images).
export type TrayEmoji = { char: string; svg: string };

export const TRAY_EMOJIS: TrayEmoji[] = [
  { char: "🏀", svg: "/emoji/1f3c0.svg" },
  { char: "🔥", svg: "/emoji/1f525.svg" },
  { char: "💪", svg: "/emoji/1f4aa.svg" },
  { char: "🐐", svg: "/emoji/1f410.svg" },
  { char: "⛹️", svg: "/emoji/26f9.svg" },
  { char: "🏆", svg: "/emoji/1f3c6.svg" },
  { char: "👏", svg: "/emoji/1f44f.svg" },
  { char: "🎯", svg: "/emoji/1f3af.svg" },
  { char: "💯", svg: "/emoji/1f4af.svg" },
  { char: "🙌", svg: "/emoji/1f64c.svg" },
];
