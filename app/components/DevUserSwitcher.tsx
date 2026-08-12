import { impersonate, stopImpersonating } from "@/app/dev/actions";

// Dev-only widget (rendered only when NODE_ENV !== "production"; see layout).
// Grouped ORG → TEAM → MEMBER since Stage 5: each entry mints a REAL Auth.js
// session via the dev-only "impersonate" provider AND sets the acting-
// membership cookie, so a two-team athlete can be entered in either team
// context. Org admins without a roster spot sit under the org header.
export type SwitcherEntry = {
  userId: number;
  name: string;
  label: string; // role chip ("Head Coach", "Player", "Org Admin", …)
  membershipId: number | null;
};
export type SwitcherOrg = {
  id: number;
  name: string;
  admins: SwitcherEntry[]; // org-level (no membership set for these entries)
  teams: { id: number; name: string; members: SwitcherEntry[] }[];
};

function EntryButton({
  entry,
  active,
}: {
  entry: SwitcherEntry;
  active: boolean;
}) {
  return (
    <form action={impersonate}>
      <input type="hidden" name="userId" value={entry.userId} />
      {entry.membershipId != null && (
        <input type="hidden" name="membershipId" value={entry.membershipId} />
      )}
      <button
        type="submit"
        className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
          active ? "bg-red-600/20 font-semibold" : ""
        }`}
      >
        <span className="truncate">{entry.name}</span>
        <span className="ml-2 shrink-0 rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
          {entry.label}
        </span>
      </button>
    </form>
  );
}

export function DevUserSwitcher({
  orgs,
  currentUserId,
}: {
  orgs: SwitcherOrg[];
  currentUserId: number | null;
}) {
  const hasUsers = orgs.some(
    (o) => o.admins.length > 0 || o.teams.some((t) => t.members.length > 0),
  );

  return (
    <details className="fixed bottom-4 left-4 z-50 w-72 rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
      <summary className="cursor-pointer list-none select-none rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wide text-red-500">
        Dev: switch user
      </summary>
      <div className="max-h-96 overflow-y-auto border-t border-zinc-200 p-2 dark:border-zinc-700">
        {!hasUsers && (
          <p className="px-2 py-3 text-xs text-zinc-500">
            No seeded users found. Run <code>npm run seed</code>.
          </p>
        )}

        {orgs.map((org) => (
          <div key={org.id} className="mb-3">
            <p className="px-2 pb-0.5 pt-1 text-[10px] font-black uppercase tracking-widest text-red-500/80">
              {org.name}
            </p>
            {org.admins.map((entry) => (
              <EntryButton
                key={`admin-${entry.userId}`}
                entry={entry}
                active={entry.userId === currentUserId}
              />
            ))}
            {org.teams.map((team) => (
              <div key={team.id} className="mt-1">
                <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  {team.name}
                </p>
                {team.members.map((entry) => (
                  <EntryButton
                    key={`${team.id}-${entry.userId}`}
                    entry={entry}
                    active={entry.userId === currentUserId}
                  />
                ))}
              </div>
            ))}
          </div>
        ))}

        {currentUserId !== null && (
          <div className="border-t border-zinc-200 pt-2 dark:border-zinc-700">
            <form action={stopImpersonating}>
              <button
                type="submit"
                className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
    </details>
  );
}
