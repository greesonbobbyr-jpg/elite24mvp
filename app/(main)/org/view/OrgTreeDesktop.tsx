import { PlayerCard } from "@/app/components/PlayerCard";
import { photoSrc } from "@/lib/photoUrl";
import type { OrgViewData } from "@/lib/orgview";
import { NodeCard, Rail } from "./NodeCard";
import { TeamContents } from "./PersonCard";
import type { Focus, Resolved } from "./OrgExplorer";

// DESKTOP (md+): the wide tree. Owner card → org node → program rail →
// division rail → team rail → the focused team's people. One branch at a time
// (the focus params); progressive disclosure skips single-entry rails using
// lib/structure's flags (never recomputed).
export function OrgTreeDesktop({
  data,
  resolved,
  hl,
  navigate,
}: {
  data: OrgViewData;
  resolved: Resolved;
  hl: number | null;
  navigate: (focus: Focus) => void;
}) {
  const { program, division, team } = resolved;

  return (
    <div className="flex flex-col gap-5">
      {/* Org owner + organization node */}
      <div className="flex flex-col items-center gap-3">
        {data.owner && (
          <div className="flex flex-col items-center">
            <PlayerCard
              size="wide"
              player={{
                name: data.owner.name,
                points: 0,
                photoUrl: photoSrc(data.owner.userId, data.owner.photoUrl),
              }}
              team={{ name: data.org.name }}
            />
            <p className="e24-eyebrow mt-1.5">Org Owner</p>
          </div>
        )}
        <div className="rounded-2xl border border-red-600/30 bg-red-600/10 px-6 py-3 text-center">
          <p className="text-lg font-black tracking-tight text-white">{data.org.name}</p>
          <p className="mt-0.5 text-[11px] font-medium text-zinc-400">
            {data.showPrograms ? `${data.totals.programCount} programs · ` : ""}
            {data.totals.divisionCount > 1 ? `${data.totals.divisionCount} divisions · ` : ""}
            {data.totals.teamCount} teams · {data.totals.playerCount} players
          </p>
          {data.admins.length > 1 && (
            <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-500">
              Admins: {data.admins.map((a) => a.name).join(" · ")}
            </p>
          )}
        </div>
      </div>

      {/* Program rail — hidden while the org has a single program */}
      {data.showPrograms && (
        <Rail label="Programs">
          {data.programs.map((p) => (
            <NodeCard
              key={p.id}
              title={p.name}
              counts={`${p.divisionCount} divisions · ${p.teamCount} teams · ${p.playerCount} players`}
              active={p.id === program?.id}
              onClick={() => navigate({ p: p.id, d: null, t: null, hl: null })}
            />
          ))}
        </Rail>
      )}

      {/* Division rail — hidden while the focused program has a single division */}
      {program && program.showDivisions && (
        <Rail label={`Divisions${data.showPrograms ? ` · ${program.name}` : ""}`}>
          {program.divisions.map((d) => (
            <NodeCard
              key={d.id}
              title={d.name}
              counts={`${d.teamCount} teams · ${d.playerCount} players`}
              active={d.id === division?.id}
              onClick={() => navigate({ p: program.id, d: d.id, t: null, hl: null })}
            />
          ))}
        </Rail>
      )}

      {/* Team rail for the focused (or only) division */}
      {division && (
        <Rail label={`Teams${program?.showDivisions ? ` · ${division.name}` : ""}`}>
          {division.teams.map((t) => (
            <NodeCard
              key={t.id}
              title={t.name}
              counts={`${t.staff.length} staff · ${t.playerCount} players`}
              active={t.id === team?.id}
              onClick={() =>
                navigate({ p: program?.id ?? null, d: division.id, t: t.id, hl: null })
              }
            />
          ))}
        </Rail>
      )}

      {/* The focused team's people */}
      {team && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <p className="mb-3 text-sm font-black uppercase tracking-wide text-red-400">
            {team.name}
          </p>
          <TeamContents team={team} hl={hl} />
        </section>
      )}
    </div>
  );
}
