// Team Circle skeleton — chat bubbles shimmer while messages load.
export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-6 py-6">
      <div className="h-14 animate-pulse rounded-xl border border-line bg-panel" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`h-12 w-3/5 animate-pulse rounded-2xl border border-line bg-panel ${
            i % 3 === 2 ? "self-end" : "self-start"
          }`}
        />
      ))}
      <div className="mt-auto h-12 animate-pulse rounded-2xl border border-line bg-panel" />
    </main>
  );
}
