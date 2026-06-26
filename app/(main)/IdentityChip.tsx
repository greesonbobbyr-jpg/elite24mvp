import Link from "next/link";

// The header identity chip: ONE compact card (brand "material" — subtle dark
// gradient + thin red glow ring) with an initials avatar + the user's name.
// For a PLAYER the whole chip links to their OWN Brand page (the only new link).
// For a coach (no brand page) it's a non-link. The avatar shows INITIALS only —
// a placeholder slot; photo upload is deliberately NOT built here.
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

const chipClass =
  "flex max-w-[58vw] items-center gap-2.5 rounded-full border border-red-600/30 bg-gradient-to-br from-zinc-900 to-black py-1.5 pl-1.5 pr-3 shadow-[0_0_0_1px_rgba(220,38,38,0.12),0_4px_14px_-6px_rgba(0,0,0,0.7)]";

export function IdentityChip({
  user,
}: {
  user: { id: number; name: string; role: string };
}) {
  const isPlayer = user.role === "PLAYER";

  const inner = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-700 to-red-950 text-xs font-bold text-white ring-2 ring-red-500/70">
        {initials(user.name)}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold text-white">
          {user.name}
        </span>
        {isPlayer ? (
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-red-400">
            Your Card →
          </span>
        ) : (
          <span className="block text-[10px] uppercase tracking-wide text-zinc-500">
            Coach
          </span>
        )}
      </span>
    </>
  );

  if (isPlayer) {
    return (
      <Link
        href={`/brand/${user.id}`}
        className={`${chipClass} transition hover:border-red-500/60 active:scale-[0.98]`}
      >
        {inner}
      </Link>
    );
  }
  return <div className={chipClass}>{inner}</div>;
}
