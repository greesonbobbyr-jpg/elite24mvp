// Route-group loading skeleton (serverless cold starts + a pooled DB make first
// paint noticeably async — a branded shimmer beats a frozen-looking screen).
// Specific routes (leaderboard, board) override with their own shapes.
export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-6 py-8">
      <div className="h-24 animate-pulse rounded-2xl border border-line bg-panel" />
      <div className="grid grid-cols-3 gap-2">
        <div className="h-14 animate-pulse rounded-xl border border-line bg-panel" />
        <div className="h-14 animate-pulse rounded-xl border border-line bg-panel" />
        <div className="h-14 animate-pulse rounded-xl border border-line bg-panel" />
      </div>
      <div className="h-44 animate-pulse rounded-2xl border border-line bg-panel" />
      <div className="h-12 animate-pulse rounded-xl border border-line bg-panel" />
    </main>
  );
}
