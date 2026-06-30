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
    <details className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900/60 to-zinc-950 shadow-lg shadow-black/30">
      <summary className="flex cursor-pointer list-none select-none items-center justify-between rounded-2xl px-5 py-3.5 transition hover:bg-white/[0.03]">
        <span className="e24-eyebrow">Points</span>
        <span className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white">{total}</span>
          <span className="text-xs font-normal text-zinc-400">history ▾</span>
        </span>
      </summary>
      <div className="border-t border-zinc-800 px-5 py-1">
        {entries.length === 0 ? (
          <p className="py-3 text-sm text-zinc-500">
            No points yet — check in today to earn your first 10.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span>
                  <span className="font-semibold text-red-500">
                    +{entry.amount}
                  </span>{" "}
                  <span className="text-zinc-300">{entry.reason}</span>
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
