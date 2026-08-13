import { PlayerCard } from "@/app/components/PlayerCard";
import { photoSrc } from "@/lib/photoUrl";
import type { OrgViewData, OrgViewDivision, OrgViewProgram, OrgViewTeam } from "@/lib/orgview";
import { NodeCard, Rail } from "./NodeCard";
import { TeamContents } from "./PersonCard";
import type { Focus, Resolved } from "./OrgExplorer";

// MOBILE (< md): FOCUS-AND-EXPAND. The focused node sits center/front, its
// SIBLINGS shrink into a horizontal strip above (swipe to hop without backing
// out), its children fan out below. Every node carries a stable
// view-transition-name, so the tap-to-focus morph is animated by the browser
// (OrgExplorer wraps navigation in document.startViewTransition; reduced
// motion and unsupported browsers get an instant swap).
export function OrgTreeMobile({
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
  const explicitDivision = division && (program?.showDivisions ?? false);

  // Deepest explicit focus decides the layout level.
  if (team && division) {
    return (
      <FocusLayout
        strip={division.teams.map((t) => (
          <NodeCard
            key={t.id}
            small
            title={t.name}
            active={t.id === team.id}
            vt={`vt-t-${t.id}`}
            onClick={() => navigate({ p: program?.id ?? null, d: division.id, t: t.id, hl: null })}
          />
        ))}
        center={
          <div
            className="rounded-2xl border border-red-500 bg-red-600/10 px-5 py-3 text-center"
            style={{ viewTransitionName: `vt-t-${team.id}` } as React.CSSProperties}
          >
            <p className="text-lg font-black tracking-tight text-white">{team.name}</p>
            <p className="text-[11px] text-zinc-400">
              {team.staff.length} staff · {team.playerCount} players
            </p>
          </div>
        }
      >
        <TeamContents team={team} hl={hl} />
      </FocusLayout>
    );
  }

  if (division && (explicitDivision || program)) {
    // Division focus (explicit, or the auto-resolved only-division when its
    // parent was tapped): teams fan out below.
    const siblings = program?.showDivisions ? program.divisions : [division];
    return (
      <FocusLayout
        strip={
          program?.showDivisions
            ? siblings.map((d) => (
                <NodeCard
                  key={d.id}
                  small
                  title={d.name}
                  active={d.id === division.id}
                  vt={`vt-d-${d.id}`}
                  onClick={() => navigate({ p: program.id, d: d.id, t: null, hl: null })}
                />
              ))
            : undefined
        }
        center={
          <div
            className="rounded-2xl border border-red-500 bg-red-600/10 px-5 py-3 text-center"
            style={{ viewTransitionName: `vt-d-${division.id}` } as React.CSSProperties}
          >
            <p className="text-lg font-black tracking-tight text-white">
              {program?.showDivisions ? division.name : (program?.name ?? division.name)}
            </p>
            <p className="text-[11px] text-zinc-400">
              {division.teamCount} teams · {division.playerCount} players
            </p>
          </div>
        }
      >
        <TeamFan division={division} program={program} navigate={navigate} />
      </FocusLayout>
    );
  }

  // ROOT: org header, then the first VISIBLE layer laid out below
  // (progressive disclosure — programs only when there are several).
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2">
        {data.owner && (
          <PlayerCard
            size="wide"
            player={{
              name: data.owner.name,
              points: 0,
              photoUrl: photoSrc(data.owner.userId, data.owner.photoUrl),
            }}
            team={{ name: data.org.name }}
          />
        )}
        <div className="w-full rounded-2xl border border-red-600/30 bg-red-600/10 px-4 py-3 text-center">
          <p className="text-lg font-black tracking-tight text-white">{data.org.name}</p>
          <p className="text-[11px] text-zinc-400">
            {data.totals.teamCount} teams · {data.totals.playerCount} players
          </p>
        </div>
      </div>

      {data.showPrograms ? (
        <div className="grid grid-cols-2 gap-2">
          {data.programs.map((p) => (
            <NodeCard
              key={p.id}
              title={p.name}
              counts={`${p.teamCount} teams · ${p.playerCount} players`}
              vt={`vt-p-${p.id}`}
              onClick={() => navigate({ p: p.id, d: null, t: null, hl: null })}
            />
          ))}
        </div>
      ) : data.programs[0]?.showDivisions ? (
        <div className="grid grid-cols-2 gap-2">
          {data.programs[0].divisions.map((d) => (
            <NodeCard
              key={d.id}
              title={d.name}
              counts={`${d.teamCount} teams · ${d.playerCount} players`}
              vt={`vt-d-${d.id}`}
              onClick={() =>
                navigate({ p: data.programs[0].id, d: d.id, t: null, hl: null })
              }
            />
          ))}
        </div>
      ) : (
        data.programs[0] && (
          <TeamFan
            division={data.programs[0].divisions[0]}
            program={data.programs[0]}
            navigate={navigate}
          />
        )
      )}
    </div>
  );
}

// Focused-node layout: sibling strip above, node center, children below.
function FocusLayout({
  strip,
  center,
  children,
}: {
  strip?: React.ReactNode[];
  center: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {strip && strip.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">{strip}</div>
      )}
      {center}
      {children}
    </div>
  );
}

function TeamFan({
  division,
  program,
  navigate,
}: {
  division: OrgViewDivision | undefined;
  program: OrgViewProgram | null;
  navigate: (focus: Focus) => void;
}) {
  if (!division) return null;
  return (
    <Rail>
      {division.teams.map((t: OrgViewTeam) => (
        <NodeCard
          key={t.id}
          title={t.name}
          counts={`${t.staff.length} staff · ${t.playerCount} players`}
          vt={`vt-t-${t.id}`}
          onClick={() =>
            navigate({ p: program?.id ?? null, d: division.id, t: t.id, hl: null })
          }
        />
      ))}
    </Rail>
  );
}
