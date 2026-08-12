import { setActingTeam } from "./team-switch-actions";
import { roleLabel } from "@/lib/format";

type SwitcherMembership = {
  id: number;
  role: string;
  team: { name: string };
};

// Rendered (by the main layout) ONLY when the person has 2+ active
// memberships — today's single-team users never see it. A slim bar under the
// header: "Playing for <team> ▾" with one tap per other team.
export function TeamSwitcher({
  memberships,
  actingMembershipId,
}: {
  memberships: SwitcherMembership[];
  actingMembershipId: number | null;
}) {
  const acting = memberships.find((m) => m.id === actingMembershipId);

  return (
    <details className="border-b border-zinc-900 bg-zinc-950/60 px-4 py-1.5 text-sm">
      <summary className="cursor-pointer list-none select-none">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Playing for{" "}
        </span>
        <span className="font-bold text-white">{acting?.team.name ?? "—"}</span>
        <span className="ml-1 text-zinc-500">▾</span>
      </summary>
      <div className="flex flex-col gap-1 py-2">
        {memberships.map((m) => (
          <form action={setActingTeam} key={m.id}>
            <input type="hidden" name="membershipId" value={m.id} />
            <button
              type="submit"
              className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left transition hover:bg-white/5 ${
                m.id === actingMembershipId ? "bg-red-600/15 font-semibold" : ""
              }`}
            >
              <span>{m.team.name}</span>
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                {roleLabel(m.role) ?? "Player"}
              </span>
            </button>
          </form>
        ))}
      </div>
    </details>
  );
}
