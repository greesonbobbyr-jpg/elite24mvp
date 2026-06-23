// The curated, app-controlled GIF set for the Team Board.
//
// This is the SINGLE source of truth for which GIFs exist. There is no open
// search and no user upload (CLAUDE.md §3.1/§3.4) — a message may only ever
// reference an `id` listed here, and the server validates that on every post.
//
// It ships EMPTY by design: the picker shows "No GIFs available yet" until at
// least one entry exists below.
//
// To add a GIF:
//   1) drop the file in public/gifs/    (e.g. public/gifs/bball-bounce.gif)
//   2) add ONE line to GIFS below:
//        { id: "bball-bounce", label: "Bouncing ball", file: "/gifs/bball-bounce.gif" }
// Any image format that renders in an <img> works (.gif/.svg/.webp/.png).

export type Gif = { id: string; label: string; file: string };

export const GIFS: Gif[] = [];

const BY_ID = new Map(GIFS.map((g) => [g.id, g]));

// Resolve a stored gifId to its registry entry (or undefined if it was removed).
export const getGif = (id?: string | null): Gif | undefined =>
  id ? BY_ID.get(id) : undefined;

// True only for ids that exist in the curated registry — used to reject anything
// arbitrary/external server-side before it is ever stored.
export const isValidGifId = (id: string): boolean => BY_ID.has(id);
