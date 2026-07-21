// Leaderboard skeleton — podium + rows shimmer.
export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="h-16 animate-pulse rounded-xl bg-zinc-900/60" />
      <div className="flex items-end justify-center gap-6">
        <div className="h-24 w-20 animate-pulse rounded-2xl bg-zinc-900/60" />
        <div className="h-32 w-24 animate-pulse rounded-2xl bg-zinc-900/70" />
        <div className="h-24 w-20 animate-pulse rounded-2xl bg-zinc-900/60" />
      </div>
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[72px] animate-pulse rounded-xl bg-zinc-900/50" />
        ))}
      </div>
    </main>
  );
}
