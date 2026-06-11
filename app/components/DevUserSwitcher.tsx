import { switchUser, clearUser } from "@/app/dev/switch-user";

type Role = "COACH" | "PLAYER";

type SwitcherTeam = {
  id: number;
  name: string;
  users: { id: number; name: string; role: Role }[];
};

// Dev-only widget (rendered only when NODE_ENV !== "production"; see layout).
// Lets the owner instantly view the app as any seeded coach or player without
// logging in. Server component — each entry posts to a server action.
export function DevUserSwitcher({
  teams,
  currentUserId,
}: {
  teams: SwitcherTeam[];
  currentUserId: number | null;
}) {
  const hasUsers = teams.some((team) => team.users.length > 0);

  return (
    <details className="fixed bottom-4 left-4 z-50 w-64 rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
      <summary className="cursor-pointer list-none select-none rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wide text-red-500">
        Dev: switch user
      </summary>
      <div className="max-h-80 overflow-y-auto border-t border-zinc-200 p-2 dark:border-zinc-700">
        {!hasUsers && (
          <p className="px-2 py-3 text-xs text-zinc-500">
            No seeded users found. Run <code>npm run seed</code>.
          </p>
        )}

        {teams.map((team) => (
          <div key={team.id} className="mb-2">
            <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
              {team.name}
            </p>
            {team.users.map((user) => {
              const active = user.id === currentUserId;
              return (
                <form key={user.id} action={switchUser}>
                  <input type="hidden" name="userId" value={user.id} />
                  <button
                    type="submit"
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                      active
                        ? "bg-red-600/20 font-semibold"
                        : ""
                    }`}
                  >
                    <span>{user.name}</span>
                    <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                      {user.role === "COACH" ? "Coach" : "Player"}
                    </span>
                  </button>
                </form>
              );
            })}
          </div>
        ))}

        {currentUserId !== null && (
          <form
            action={clearUser}
            className="border-t border-zinc-200 pt-2 dark:border-zinc-700"
          >
            <button
              type="submit"
              className="w-full rounded-md px-2 py-1.5 text-left text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Sign out (clear selection)
            </button>
          </form>
        )}
      </div>
    </details>
  );
}
