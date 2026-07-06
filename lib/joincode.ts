import { randomInt } from "node:crypto";
import { prisma } from "./prisma";

// Team join codes: short, uppercase, and unambiguous (no 0/O/1/I) so they're easy
// to read aloud and type. Crypto-random, 6 chars.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LENGTH = 6;

export function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

// A join code guaranteed unique across Teams (retry on the rare collision).
export async function uniqueJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateJoinCode();
    const existing = await prisma.team.findUnique({ where: { joinCode: code } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique join code");
}
