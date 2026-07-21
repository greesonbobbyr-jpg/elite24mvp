/**
 * One-off: rotate EVERY user's password in the target database to a fresh
 * random, kid-friendly value. Used to retire the shared demo password from the
 * live DB without wiping data (preserves uploaded photos/logos/etc.).
 *
 * Output is ONE-TIME: printed to the console AND written to
 * credentials-rotated.local.txt (git-ignored) so it can't be lost to terminal
 * scrollback. Hand each person their new password, then delete the file.
 *
 * Note: already-issued JWT sessions remain valid until they expire — this
 * rotates credentials; it does not force-log-out active sessions.
 *
 * Run:  ROTATE_CONFIRM=<db host> npx tsx scripts/rotate-passwords.ts
 */
import { writeFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const WORDS = [
  "swish", "dunk", "hoop", "pivot", "rebound", "assist", "clutch", "baseline",
  "crossover", "fastbreak", "buzzer", "triple", "handles", "glass", "downtown",
];

function makePassword(): string {
  const w1 = WORDS[randomInt(WORDS.length)];
  let w2 = WORDS[randomInt(WORDS.length)];
  while (w2 === w1) w2 = WORDS[randomInt(WORDS.length)];
  return `${w1}-${w2}-${randomInt(10, 100)}`;
}

async function main() {
  let dbHost = "";
  try {
    dbHost = new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    /* refused below */
  }
  if (!dbHost || process.env.ROTATE_CONFIRM !== dbHost) {
    console.error(
      `Refusing to rotate. This RESETS EVERY PASSWORD in the database at:\n\n    ${dbHost || "(unparseable DATABASE_URL)"}\n\nIf that is really what you want, run:\n\n    ROTATE_CONFIRM=${dbHost} npx tsx scripts/rotate-passwords.ts\n`,
    );
    process.exit(1);
  }

  const users = await prisma.user.findMany({
    orderBy: [{ teamId: "asc" }, { role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, role: true, email: true, username: true },
  });

  const lines: string[] = [
    `Rotated ${users.length} passwords on ${dbHost} at ${new Date().toISOString()}`,
    `login = email (coach) / username (player)`,
    "",
  ];
  for (const u of users) {
    const password = makePassword();
    await prisma.user.update({
      where: { id: u.id },
      data: { passwordHash: await bcrypt.hash(password, 12) },
    });
    const login = u.role === "COACH" ? u.email : u.username;
    lines.push(
      `${u.role.padEnd(6)}  ${u.name.padEnd(22)}  ${String(login).padEnd(26)}  ${password}`,
    );
  }

  const out = lines.join("\n") + "\n";
  writeFileSync("credentials-rotated.local.txt", out);
  console.log(out);
  console.log(
    "Saved to credentials-rotated.local.txt (git-ignored). Share, then delete it.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
