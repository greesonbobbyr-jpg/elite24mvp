import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/context";
import { can } from "@/lib/authz";
import { getOrgStructure } from "@/lib/structure";
import { prisma } from "@/lib/prisma";
import { moveDivision, moveProgram, assignTeamToDivision } from "./actions";
import { AddForm, RenameableName } from "./StructureForms";
import { OrgTabs } from "./OrgTabs";

// ORGANIZATION STRUCTURE (grouping Chunk 1) — ORG_ADMIN only. Programs →
// Divisions → Teams with create/rename/reorder/assign. PROGRESSIVE
// DISCLOSURE: a layer with a single entry renders no header or controls — a
// small club sees just its teams; the full tree appears as structure grows.
// (The read-only org tree is Browse, /org/view.)
export default async function OrgPage() {
  const ctx = await getCurrentContext();
  const user = ctx?.user;
  if (!ctx || !user) redirect("/");

  const orgId = ctx.orgAdminOf[0] ?? ctx.team?.organizationId ?? null;
  const allowed =
    orgId != null &&
    (ctx.profile
      ? can(ctx, "create_team", { organizationId: orgId })
      : user.role === "COACH"); // pre-backfill fallback (dies at Stage 6)
  if (!allowed || orgId == null) redirect("/");

  const [org, structure] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
    getOrgStructure(orgId),
  ]);
  if (!org) redirect("/");

  const allDivisions = structure.programs.flatMap((p) =>
    p.divisions.map((d) => ({
      id: d.id,
      label: structure.showPrograms ? `${p.name} · ${d.name}` : d.name,
    })),
  );
  const showAssign = allDivisions.length > 1;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-6 py-8">
      <header>
        <div className="flex items-center justify-between gap-3">
          <p className="e24-eyebrow">Organization</p>
          <OrgTabs current="manage" />
        </div>
        <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-ink">
          {org.name}
        </h1>
        <p className="mt-1 text-sm text-subtle">
          Programs and divisions group your teams. Layers with a single entry
          stay hidden from everyone until you add more.
        </p>
      </header>

      {structure.programs.map((program, pi) => (
        <section
          key={program.id}
          className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-4"
        >
          {/* Program header — hidden while the org has a single program */}
          {structure.showPrograms && (
            <div className="flex items-center gap-2">
              <RenameableName
                kind="program"
                id={program.id}
                name={program.name}
                className="text-sm font-black uppercase tracking-wide text-brand-2"
              />
              <span className="flex-1" />
              <ReorderButtons
                action={moveProgram}
                field="programId"
                id={program.id}
                first={pi === 0}
                last={pi === structure.programs.length - 1}
              />
            </div>
          )}

          {program.divisions.map((division, di) => (
            <div key={division.id} className="flex flex-col gap-1.5">
              {/* Division header — hidden while the program has a single division */}
              {program.showDivisions && (
                <div className="flex items-center gap-2">
                  <RenameableName
                    kind="division"
                    id={division.id}
                    name={division.name}
                    className="text-xs font-bold uppercase tracking-wide text-muted"
                  />
                  <span className="flex-1" />
                  <ReorderButtons
                    action={moveDivision}
                    field="divisionId"
                    id={division.id}
                    first={di === 0}
                    last={di === program.divisions.length - 1}
                  />
                </div>
              )}

              {division.teams.length === 0 && (
                <p className="px-1 text-xs text-subtle">No teams yet.</p>
              )}
              {division.teams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center gap-3 rounded-xl border border-line-faint bg-raised px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{team.name}</p>
                    {team.joinCode && (
                      <p className="text-[11px] text-subtle">
                        Join code <span className="font-mono">{team.joinCode}</span>
                      </p>
                    )}
                  </div>
                  {showAssign && (
                    <form action={assignTeamToDivision}>
                      <input type="hidden" name="teamId" value={team.id} />
                      <select
                        name="divisionId"
                        defaultValue={division.id}
                        className="rounded-lg border border-line-strong bg-field px-2 py-1 text-xs text-ink-mid"
                      >
                        {allDivisions.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="ml-2 rounded-full border border-line-strong px-2.5 py-1 text-[11px] font-semibold text-ink-mid transition hover:border-field-line"
                      >
                        Move
                      </button>
                    </form>
                  )}
                </div>
              ))}
              <AddForm kind="team" parentField="divisionId" parentId={division.id} />
            </div>
          ))}

          <AddForm kind="division" parentField="programId" parentId={program.id} />
        </section>
      ))}

      {structure.unassignedTeams.length > 0 && (
        <section className="rounded-2xl border border-warn/30 bg-warn/5 p-4">
          <p className="e24-eyebrow mb-2">Not in a division yet</p>
          {structure.unassignedTeams.map((team) => (
            <div key={team.id} className="flex items-center gap-3 py-1.5">
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                {team.name}
              </p>
              <form action={assignTeamToDivision}>
                <input type="hidden" name="teamId" value={team.id} />
                <select
                  name="divisionId"
                  className="rounded-lg border border-line-strong bg-field px-2 py-1 text-xs text-ink-mid"
                >
                  {allDivisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="ml-2 rounded-full border border-line-strong px-2.5 py-1 text-[11px] font-semibold text-ink-mid transition hover:border-field-line"
                >
                  Assign
                </button>
              </form>
            </div>
          ))}
        </section>
      )}

      <AddForm kind="program" />
    </main>
  );
}

// Server-rendered ▲/▼ pair posting to a reorder action.
function ReorderButtons({
  action,
  field,
  id,
  first,
  last,
}: {
  action: (formData: FormData) => Promise<void>;
  field: "programId" | "divisionId";
  id: number;
  first: boolean;
  last: boolean;
}) {
  return (
    <div className="flex gap-1">
      {!first && (
        <form action={action}>
          <input type="hidden" name={field} value={id} />
          <input type="hidden" name="direction" value="up" />
          <button className="rounded border border-line-strong px-1.5 text-xs text-muted hover:border-field-line" aria-label="Move up">▲</button>
        </form>
      )}
      {!last && (
        <form action={action}>
          <input type="hidden" name={field} value={id} />
          <input type="hidden" name="direction" value="down" />
          <button className="rounded border border-line-strong px-1.5 text-xs text-muted hover:border-field-line" aria-label="Move down">▼</button>
        </form>
      )}
    </div>
  );
}
