import { formatDate } from "@/lib/format";

type LedgerRow = {
  id: number;
  amount: number;
  reason: string;
  createdAt: Date;
};

// Expandable points total. The summary shows the total; tapping it reveals the
// player's points history (newest first). Server component — native <details>,
// no client JS. Player-private: the caller passes only this player's ledger.
export function PointsHistory({
  total,
  entries,
}: {
  total: number;
  entries: LedgerRow[];
}) {
  return (
    <details className="rounded-xl border border-zinc-200 dark:border-zinc-800">
      <summary className="flex cursor-pointer list-none select-none items-center justify-between rounded-xl px-5 py-3">
        <span className="text-sm font-medium text-zinc-500">Points</span>
        <span className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{total}</span>
          <span className="text-xs font-normal text-zinc-400">history ▾</span>
        </span>
      </summary>
      <div className="border-t border-zinc-200 px-5 py-1 dark:border-zinc-800">
        {entries.length === 0 ? (
          <p className="py-3 text-sm text-zinc-500">
            No points yet — check in today to earn your first 10.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span>
                  <span className="font-semibold text-emerald-700">
                    +{entry.amount}
                  </span>{" "}
                  <span className="text-zinc-600 dark:text-zinc-300">
                    {entry.reason}
                  </span>
                </span>
                <span className="text-xs text-zinc-400">
                  {formatDate(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
