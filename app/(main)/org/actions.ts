"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentContext, type Ctx } from "@/lib/context";
import { isStaffSide, personaOf } from "@/lib/persona";
import { can } from "@/lib/authz";
import { uniqueJoinCode } from "@/lib/joincode";

// ORG STRUCTURE ACTIONS (grouping Chunk 1). ORG_ADMIN only, org-bounded:
// - The GATE reuses the locked matrix's `create_team` tier (ORG_ADMIN-only) —
//   zero matrix changes; grouping layers are never part of a permission check.
// - Every mutation ALSO org-bounds its DATA PATH: the target program /
//   division / team row's org chain must equal the admin's own org. Form ids
//   are never trusted (same discipline as resolveRosterTarget).

export type StructureState = { error?: string; ok?: boolean };

// The admin's org: their ORG_ADMIN grant first (covers admins with no
// membership), else the acting team's org. Null → not an org admin here.
async function requireOrgAdmin(): Promise<{ ctx: Ctx; orgId: number } | null> {
  const ctx = await getCurrentContext();
  if (!ctx) return null;
  const orgId = ctx.orgAdminOf[0] ?? ctx.team?.organizationId ?? null;
  if (orgId == null) return null;
  const allowed = ctx.profile
    ? can(ctx, "create_team", { organizationId: orgId })
    : isStaffSide(personaOf(ctx)); // pre-backfill fallback (dies at Stage 6)
  return allowed ? { ctx, orgId } : null;
}

function cleanName(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  return s.length >= 1 && s.length <= 40 ? s : null;
}

// Org-bounded target loaders — null unless the row belongs to the admin's org.
async function ownProgram(id: number, orgId: number) {
  const program = await prisma.program.findUnique({ where: { id } });
  return program && program.organizationId === orgId ? program : null;
}
async function ownDivision(id: number, orgId: number) {
  const division = await prisma.division.findUnique({
    where: { id },
    include: { program: { select: { organizationId: true } } },
  });
  return division && division.program.organizationId === orgId ? division : null;
}

export async function createProgram(
  _prev: StructureState,
  formData: FormData,
): Promise<StructureState> {
  const admin = await requireOrgAdmin();
  if (!admin) return { error: "Organization admin only." };
  const name = cleanName(formData.get("name"));
  if (!name) return { error: "Name the program (1–40 characters)." };
  const last = await prisma.program.findFirst({
    where: { organizationId: admin.orgId },
    orderBy: { sortOrder: "desc" },
  });
  await prisma.program.create({
    data: { organizationId: admin.orgId, name, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  revalidatePath("/org");
  return { ok: true };
}

export async function renameProgram(
  _prev: StructureState,
  formData: FormData,
): Promise<StructureState> {
  const admin = await requireOrgAdmin();
  if (!admin) return { error: "Organization admin only." };
  const id = Number.parseInt(String(formData.get("programId") ?? ""), 10);
  const name = cleanName(formData.get("name"));
  if (!Number.isInteger(id) || !name) return { error: "Enter a name (1–40 characters)." };
  if (!(await ownProgram(id, admin.orgId))) return { error: "Not your program." };
  await prisma.program.update({ where: { id }, data: { name } });
  revalidatePath("/org");
  return { ok: true };
}

export async function createDivision(
  _prev: StructureState,
  formData: FormData,
): Promise<StructureState> {
  const admin = await requireOrgAdmin();
  if (!admin) return { error: "Organization admin only." };
  const programId = Number.parseInt(String(formData.get("programId") ?? ""), 10);
  const name = cleanName(formData.get("name"));
  if (!Number.isInteger(programId) || !name) {
    return { error: "Name the division (1–40 characters)." };
  }
  if (!(await ownProgram(programId, admin.orgId))) return { error: "Not your program." };
  const last = await prisma.division.findFirst({
    where: { programId },
    orderBy: { sortOrder: "desc" },
  });
  await prisma.division.create({
    data: { programId, name, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  revalidatePath("/org");
  return { ok: true };
}

export async function renameDivision(
  _prev: StructureState,
  formData: FormData,
): Promise<StructureState> {
  const admin = await requireOrgAdmin();
  if (!admin) return { error: "Organization admin only." };
  const id = Number.parseInt(String(formData.get("divisionId") ?? ""), 10);
  const name = cleanName(formData.get("name"));
  if (!Number.isInteger(id) || !name) return { error: "Enter a name (1–40 characters)." };
  if (!(await ownDivision(id, admin.orgId))) return { error: "Not your division." };
  await prisma.division.update({ where: { id }, data: { name } });
  revalidatePath("/org");
  return { ok: true };
}

// Reorder by one step. Rewrites sortOrder = list position for ALL siblings
// (self-normalizing — seeded/backfilled rows may share sortOrder 0).
export async function moveProgram(formData: FormData): Promise<void> {
  const admin = await requireOrgAdmin();
  if (!admin) return;
  const id = Number.parseInt(String(formData.get("programId") ?? ""), 10);
  const dir = String(formData.get("direction")) === "up" ? -1 : 1;
  if (!Number.isInteger(id) || !(await ownProgram(id, admin.orgId))) return;
  const siblings = await prisma.program.findMany({
    where: { organizationId: admin.orgId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  const i = siblings.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= siblings.length) return;
  [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
  await prisma.$transaction(
    siblings.map((s, idx) =>
      prisma.program.update({ where: { id: s.id }, data: { sortOrder: idx } }),
    ),
  );
  revalidatePath("/org");
}

export async function moveDivision(formData: FormData): Promise<void> {
  const admin = await requireOrgAdmin();
  if (!admin) return;
  const id = Number.parseInt(String(formData.get("divisionId") ?? ""), 10);
  const dir = String(formData.get("direction")) === "up" ? -1 : 1;
  if (!Number.isInteger(id)) return;
  const division = await ownDivision(id, admin.orgId);
  if (!division) return;
  const siblings = await prisma.division.findMany({
    where: { programId: division.programId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  const i = siblings.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= siblings.length) return;
  [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
  await prisma.$transaction(
    siblings.map((s, idx) =>
      prisma.division.update({ where: { id: s.id }, data: { sortOrder: idx } }),
    ),
  );
  revalidatePath("/org");
}

export async function assignTeamToDivision(formData: FormData): Promise<void> {
  const admin = await requireOrgAdmin();
  if (!admin) return;
  const teamId = Number.parseInt(String(formData.get("teamId") ?? ""), 10);
  const divisionId = Number.parseInt(String(formData.get("divisionId") ?? ""), 10);
  if (!Number.isInteger(teamId) || !Number.isInteger(divisionId)) return;
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team || team.organizationId !== admin.orgId) return; // not your team
  if (!(await ownDivision(divisionId, admin.orgId))) return; // not your division
  await prisma.team.update({ where: { id: teamId }, data: { divisionId } });
  revalidatePath("/org");
}

// Create a team INSIDE a division: gets its own join code; no staff attached
// (staff invites are the post-merge roadmap phase) — the org admin runs it
// until then, and players can join with its code immediately.
export async function createTeamInDivision(
  _prev: StructureState,
  formData: FormData,
): Promise<StructureState> {
  const admin = await requireOrgAdmin();
  if (!admin) return { error: "Organization admin only." };
  const divisionId = Number.parseInt(String(formData.get("divisionId") ?? ""), 10);
  const name = cleanName(formData.get("name"));
  if (!Number.isInteger(divisionId) || !name) {
    return { error: "Name the team (1–40 characters)." };
  }
  if (!(await ownDivision(divisionId, admin.orgId))) return { error: "Not your division." };
  const joinCode = await uniqueJoinCode();
  await prisma.team.create({
    data: { name, joinCode, organizationId: admin.orgId, divisionId },
  });
  revalidatePath("/org");
  return { ok: true };
}
