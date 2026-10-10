import { createHmac, randomBytes, randomInt } from "node:crypto";
import type { Invite, InviteKind, Prisma, Role } from "@prisma/client";
import { prisma } from "./prisma";

// INVITES + ORG CODES (person-first plan Phase 3, owner 2026-10-09). A code
// is the only way onto a team or into running an organization. There is no
// email service: the inviter shares the short code, a link, or a QR code.
//
//   team join code   6 chars  ("MUSTJV")            → a player (lib/data/join)
//   staff invite     8 chars  ("K7QD-M2PX")         → staff on a team / org admin
//   org code         ORG + 8  ("ORG-W3TX-9KQP")     → start one organization
//
// Only keyed hashes are stored (HMAC with AUTH_SECRET), so a leaked table
// can't be turned back into working codes. Single use (claimed atomically),
// expiring, revocable. The code and link are shown ONCE, when made.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — easy to read aloud
export const STAFF_INVITE_DAYS = 7;
export const ORG_CODE_DAYS = 30;
export const STAFF_ROLES = ["HEAD_COACH", "ASSISTANT_COACH", "GENERAL_MANAGER"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export type InviteRole = StaffRole | "ORG_ADMIN";

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is required for invites");
  return "local-dev-invite-key"; // tests and local runs without .env
}

export const keyed = (value: string) => createHmac("sha256", secret()).update(value).digest("hex");

/** Uppercase letters and digits only: "k7qd-m2px " → "K7QDM2PX". */
export function normalizeCode(raw: unknown): string {
  return String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** What a typed code is, by its shape. */
export function codeKind(normalized: string): "team" | "staff" | "org" | null {
  if (/^[A-Z0-9]{6}$/.test(normalized)) return "team";
  if (/^[A-Z0-9]{8}$/.test(normalized)) return "staff";
  if (/^ORG[A-Z0-9]{8}$/.test(normalized)) return "org";
  return null;
}

function randomChars(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

/** A fresh code as people see it, and its normalized form (what's hashed). */
export function newCode(kind: InviteKind): { display: string; normalized: string } {
  const body = randomChars(8);
  const display = `${body.slice(0, 4)}-${body.slice(4)}`;
  return kind === "ORG_CREATE"
    ? { display: `ORG-${display}`, normalized: `ORG${body}` }
    : { display, normalized: body };
}

export type InviteState = "open" | "used" | "expired" | "revoked";

export function inviteState(invite: Pick<Invite, "usedAt" | "revokedAt" | "expiresAt">, now = new Date()): InviteState {
  if (invite.revokedAt) return "revoked";
  if (invite.usedAt) return "used";
  if (invite.expiresAt <= now) return "expired";
  return "open";
}

export type NewInvite = {
  kind: InviteKind;
  role?: InviteRole | null;
  organizationId?: number | null;
  teamId?: number | null;
  label?: string | null;
  createdByProfileId: number;
};

/** Make an invite; returns the code + link token — the only time they exist in the clear. */
export async function createInvite(input: NewInvite, db: Prisma.TransactionClient | typeof prisma = prisma) {
  const days = input.kind === "ORG_CREATE" ? ORG_CODE_DAYS : STAFF_INVITE_DAYS;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode(input.kind);
    const token = randomBytes(24).toString("base64url");
    try {
      const invite = await db.invite.create({
        data: {
          kind: input.kind,
          codeHash: keyed(code.normalized),
          tokenHash: keyed(token),
          codeHint: `${code.display.slice(0, input.kind === "ORG_CREATE" ? 8 : 4)}-…`,
          role: (input.role ?? null) as Role | null,
          organizationId: input.organizationId ?? null,
          teamId: input.teamId ?? null,
          label: input.label?.trim().slice(0, 60) || null,
          createdByProfileId: input.createdByProfileId,
          expiresAt: new Date(Date.now() + days * 86_400_000),
        },
      });
      return { invite, code: code.display, token };
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e; // a hash collision: try again
    }
  }
  throw new Error("Could not make a unique invite code");
}

export function findInviteByCode(normalized: string) {
  return prisma.invite.findUnique({ where: { codeHash: keyed(normalized) } });
}

export function findInviteByToken(token: string) {
  return /^[A-Za-z0-9_-]{20,64}$/.test(token) ? prisma.invite.findUnique({ where: { tokenHash: keyed(token) } }) : null;
}

/** Claim an open invite for one person — atomically, so it can only ever be used once. */
export async function claimInvite(tx: Prisma.TransactionClient, inviteId: number, profileId: number): Promise<boolean> {
  const now = new Date();
  const claimed = await tx.invite.updateMany({
    where: { id: inviteId, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now, usedByProfileId: profileId },
  });
  return claimed.count === 1;
}

export type AcceptResult =
  | { ok: true; teamId: number | null; organizationId: number }
  | { ok: false; error: string };

/** Accept a STAFF invite: staff on its team (or org admin), in one transaction. */
export async function acceptStaffInvite(invite: Invite, person: { profileId: number; userId: number }): Promise<AcceptResult> {
  if (invite.kind !== "STAFF" || invite.organizationId == null || !invite.role) {
    return { ok: false, error: "That isn't a staff invite." };
  }
  const state = inviteState(invite);
  if (state !== "open") return { ok: false, error: stateMessage(state) };
  const orgId = invite.organizationId;
  const season = await prisma.season.findFirst({ where: { organizationId: orgId, isCurrent: true }, select: { id: true } });
  if (invite.teamId != null && !season) {
    return { ok: false, error: "That organization isn't running a season right now — ask whoever invited you." };
  }

  return prisma.$transaction(async (tx) => {
    if (!(await claimInvite(tx, invite.id, person.profileId))) {
      return { ok: false as const, error: "That invite was just used or is no longer open." };
    }
    if (invite.role === "ORG_ADMIN") {
      const existing = await tx.roleAssignment.findFirst({
        where: { profileId: person.profileId, role: "ORG_ADMIN", organizationId: orgId, revokedAt: null },
      });
      if (!existing) {
        await tx.roleAssignment.create({ data: { profileId: person.profileId, role: "ORG_ADMIN", organizationId: orgId } });
      }
    } else {
      const teamId = invite.teamId!;
      const seasonId = season!.id;
      const existing = await tx.membership.findUnique({
        where: { profileId_teamId_seasonId: { profileId: person.profileId, teamId, seasonId } },
      });
      if (existing) {
        await tx.membership.update({
          where: { id: existing.id },
          data: { role: invite.role!, endedAt: null, endedByProfileId: null },
        });
      } else {
        await tx.membership.create({ data: { profileId: person.profileId, teamId, seasonId, role: invite.role! } });
      }
    }
    await tx.auditEvent.create({
      data: {
        actorProfileId: person.profileId,
        action: "invite.accepted",
        organizationId: orgId,
        teamId: invite.teamId,
        detail: invite.role === "ORG_ADMIN" ? "Org Admin" : String(invite.role),
      },
    });
    return { ok: true as const, teamId: invite.teamId, organizationId: orgId };
  });
}

export function stateMessage(state: InviteState): string {
  switch (state) {
    case "used":
      return "That code was already used. Ask for a new one.";
    case "expired":
      return "That code has expired. Ask for a new one.";
    case "revoked":
      return "That code was cancelled. Ask for a new one.";
    default:
      return "";
  }
}
