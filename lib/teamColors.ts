// Curated team-color palette. A coach picks a PRIMARY and a SECONDARY color for
// their team from this fixed set (see app/components/TeamBrandingFields). Keeping
// it a fixed palette (rather than a free hex picker) means every team color is a
// known, on-brand value we can validate server-side — no arbitrary CSS from user
// input. Covers common school/pro combos (OKC light blue + orange, OU crimson +
// cream, etc.). Hexes are lowercase; validation is case-insensitive.

export type TeamColor = { name: string; hex: string };

export const TEAM_COLORS: TeamColor[] = [
  // Reds & oranges
  { name: "Crimson", hex: "#a6192e" },
  { name: "Scarlet", hex: "#e1102a" },
  { name: "Red", hex: "#d32f2f" },
  { name: "Orange Red", hex: "#ff4500" },
  { name: "Orange", hex: "#f57c00" },
  { name: "Burnt Orange", hex: "#cc5500" },
  { name: "Gold", hex: "#f2a900" },
  { name: "Yellow", hex: "#ffd21e" },
  // Greens & teals
  { name: "Kelly Green", hex: "#2e7d32" },
  { name: "Forest", hex: "#1b5e20" },
  { name: "Light Green", hex: "#66bb6a" },
  { name: "Teal", hex: "#008080" },
  { name: "Aqua", hex: "#26c6da" },
  // Blues
  { name: "Sky Blue", hex: "#4fa8dd" },
  { name: "Royal Blue", hex: "#1e58c8" },
  { name: "Blue", hex: "#1565c0" },
  { name: "Navy", hex: "#0b2559" },
  // Purples & pinks
  { name: "Purple", hex: "#5e35b1" },
  { name: "Violet", hex: "#7c4dff" },
  { name: "Magenta", hex: "#c2185b" },
  { name: "Pink", hex: "#ec407a" },
  // Browns & maroon
  { name: "Maroon", hex: "#6a1b2a" },
  { name: "Brown", hex: "#6d4c41" },
  // Neutrals
  { name: "Cream", hex: "#f4ecd8" },
  { name: "White", hex: "#ffffff" },
  { name: "Silver", hex: "#c0c0c0" },
  { name: "Gray", hex: "#9e9e9e" },
  { name: "Charcoal", hex: "#37474f" },
  { name: "Black", hex: "#111111" },
];

const HEX_SET = new Set(TEAM_COLORS.map((c) => c.hex.toLowerCase()));

// Server-side guard: is this a color from our palette? (Blocks arbitrary values.)
export function isTeamColor(hex: string): boolean {
  return HEX_SET.has(hex.trim().toLowerCase());
}
