// PLACEHOLDER quotes — Gary to replace with the real Elite24 / E24P quote
// library. These are generic motivational lines so the daily check-in has
// something to show during development. NOT final content.
export const QUOTES: string[] = [
  "Small steps every day add up to big results.",
  "Work hard in silence. Let your game make the noise.",
  "You don't have to be great to start, but you have to start to be great.",
  "Value the ball. Value the work.",
  "Be the hardest worker in the room.",
  "Don't count the days. Make the days count.",
  "Champions are made when no one is watching.",
  "A little progress each day adds up to big results.",
];

// Deterministic pick so the quote stays the same for the whole calendar day
// (a hash of the day string, not random per render).
export function quoteForDay(dayKey: string): string {
  let hash = 0;
  for (let i = 0; i < dayKey.length; i++) {
    hash = (hash * 31 + dayKey.charCodeAt(i)) | 0;
  }
  return QUOTES[Math.abs(hash) % QUOTES.length];
}
