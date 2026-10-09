/**
 * GRANT THE CEO ROLE (person-first plan, 2026-10-09). The ONLY way anyone
 * becomes CEO — nothing in the app can create a PlatformGrant.
 *
 * The CEO (Gary Harper, the owner of the business) sees every organization,
 * team, coach and player in CEO View — never a player's journal or
 * reflections. There is one CEO: a second grant is refused.
 *
 * If no account has the email yet, one is made: no team, CEO View as home,
 * and the starting password from CEO_INITIAL_PASSWORD (never on the command
 * line, never printed, never committed). The account must pick its own
 * password at first login (mustChangePassword).
 *
 *   npx tsx scripts/grant-platform-role.ts --email <email> [--name "Full Name"]
 *       → dry run: says what it would do
 *   BACKFILL_CONFIRM=<db host> CEO_INITIAL_PASSWORD=... npx tsx ... --execute
 *       → apply (password only needed when the account doesn't exist yet)
 *   BACKFILL_CONFIRM=<db host> npx tsx ... --email <email> --revoke
 *       → end the grant (the account stays)
 *   npx tsx scripts/grant-platform-role.ts --verify
 *       → who holds the CEO role
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { MIN_PASSWORD_LENGTH } from "../lib/account";

export const prisma = new PrismaClient();

function hostOf(url: string | undefined): string {
  try {
    return new URL(url ?? "").hostname;
  } catch {
    return "";
  }
}

function requireConfirm() {
  const host = hostOf(process.env.DATABASE_URL);
  if (process.env.BACKFILL_CONFIRM !== host) {
    console.error(
      `Refusing to run. This WRITES to:\n\n    ${host}\n\nIf intended, re-run with BACKFILL_CONFIRM=${host}\n`,
    );
    process.exit(1);
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// Logs show the email masked: g***@gmail.com.
function masked(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

export type GrantPlan =
  | { kind: "create-account"; email: string; name: string }
  | { kind: "grant-existing"; email: string; userId: number; hasProfile: boolean }
  | { kind: "already-ceo"; email: string }
  | { kind: "refused"; reason: string };

export async function planGrant(db: PrismaClient, email: string, name?: string): Promise<GrantPlan> {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, profileRecord: { select: { id: true, platformGrants: { where: { revokedAt: null } } } } },
  });
  const ceos = await db.platformGrant.findMany({
    where: { role: "CEO", revokedAt: null },
    select: { profile: { select: { user: { select: { email: true } } } } },
  });
  if (ceos.some((g) => g.profile.user?.email !== email)) {
    return { kind: "refused", reason: "Another account already holds the CEO role (there is one CEO)." };
  }
  if (!user) {
    if (!name) return { kind: "refused", reason: "No account has that email — pass --name to create it." };
    return { kind: "create-account", email, name };
  }
  if (user.profileRecord?.platformGrants.some((g) => g.role === "CEO")) return { kind: "already-ceo", email };
  return { kind: "grant-existing", email, userId: user.id, hasProfile: user.profileRecord != null };
}

export async function applyGrant(db: PrismaClient, plan: GrantPlan, initialPassword?: string) {
  if (plan.kind === "refused" || plan.kind === "already-ceo") return plan;
  if (plan.kind === "create-account" && (!initialPassword || initialPassword.length < MIN_PASSWORD_LENGTH)) {
    return { kind: "refused" as const, reason: `Set CEO_INITIAL_PASSWORD (at least ${MIN_PASSWORD_LENGTH} characters).` };
  }
  const passwordHash = plan.kind === "create-account" ? await hashPassword(initialPassword!) : null;

  return db.$transaction(async (tx) => {
    let profileId: number;
    if (plan.kind === "create-account") {
      // No team; the legacy login role is COACH only because the column is
      // required — nothing reads it for an account with a Profile (lib/persona).
      const user = await tx.user.create({
        data: {
          name: plan.name,
          email: plan.email,
          role: "COACH",
          teamId: null,
          passwordHash,
          mustChangePassword: true,
        },
      });
      profileId = (
        await tx.profile.create({ data: { userId: user.id, name: plan.name, setupCompletedAt: new Date() } })
      ).id;
    } else {
      const existing = await tx.profile.findUnique({ where: { userId: plan.userId }, select: { id: true } });
      if (existing) {
        profileId = existing.id;
      } else {
        const user = await tx.user.findUniqueOrThrow({ where: { id: plan.userId }, select: { name: true } });
        profileId = (
          await tx.profile.create({ data: { userId: plan.userId, name: user.name, setupCompletedAt: new Date() } })
        ).id;
      }
    }
    await tx.platformGrant.create({
      data: { profileId, role: "CEO", note: "granted by scripts/grant-platform-role.ts" },
    });
    await tx.auditEvent.create({
      data: { actorProfileId: profileId, action: "platform.grant", targetProfileId: profileId, detail: "CEO" },
    });
    return { kind: plan.kind, profileId };
  });
}

export async function revokeGrant(db: PrismaClient, email: string) {
  return (
    await db.platformGrant.updateMany({
      where: { role: "CEO", revokedAt: null, profile: { user: { email } } },
      data: { revokedAt: new Date() },
    })
  ).count;
}

async function report() {
  const grants = await prisma.platformGrant.findMany({
    where: { revokedAt: null },
    select: { role: true, createdAt: true, profile: { select: { name: true, user: { select: { email: true, mustChangePassword: true } } } } },
  });
  console.log(`CEO grants on ${hostOf(process.env.DATABASE_URL)}: ${grants.length}`);
  for (const g of grants) {
    const email = g.profile.user?.email;
    console.log(
      `  ${g.role}: ${g.profile.name} <${email ? masked(email) : "no login"}> since ${g.createdAt.toISOString().slice(0, 10)}` +
        (g.profile.user?.mustChangePassword ? " — still has to pick their own password" : ""),
    );
  }
  return grants.length;
}

async function main() {
  if (process.argv.includes("--verify")) {
    process.exitCode = (await report()) === 1 ? 0 : 1;
    return;
  }
  const email = arg("--email")?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error("Pass --email <the CEO's email>.");
    process.exitCode = 1;
    return;
  }
  if (process.argv.includes("--revoke")) {
    requireConfirm();
    console.log(`Revoked ${await revokeGrant(prisma, email)} CEO grant(s) for ${masked(email)}.`);
    return;
  }
  const plan = await planGrant(prisma, email, arg("--name")?.trim());
  const say: Record<GrantPlan["kind"], string> = {
    "create-account": `create an account for ${masked(email)} (no team, must pick own password) and make it CEO`,
    "grant-existing": `make the existing account ${masked(email)} CEO`,
    "already-ceo": `nothing — ${masked(email)} is already CEO`,
    refused: plan.kind === "refused" ? `REFUSED: ${plan.reason}` : "",
  };
  console.log(`Plan against ${hostOf(process.env.DATABASE_URL)}: ${say[plan.kind]}`);
  if (!process.argv.includes("--execute")) {
    console.log("\nDry run only. --execute applies it.");
    return;
  }
  requireConfirm();
  const result = await applyGrant(prisma, plan, process.env.CEO_INITIAL_PASSWORD);
  if (result.kind === "refused") {
    console.error(`REFUSED: ${result.reason}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Done: ${result.kind}.`);
  await report();
}

// CLI entry — skipped when the test suite imports the functions above.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/grant-platform-role.ts")) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
