// Team Circle skeleton — chat bubbles shimmer while messages load.
export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-6 py-6">
      <div className="h-14 animate-pulse rounded-xl bg-zinc-900/60" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`h-12 w-3/5 animate-pulse rounded-2xl bg-zinc-900/50 ${
            i % 3 === 2 ? "self-end" : "self-start"
          }`}
        />
      ))}
      <div className="mt-auto h-12 animate-pulse rounded-2xl bg-zinc-900/60" />
    </main>
  );
}
