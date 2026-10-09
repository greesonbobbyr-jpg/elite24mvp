import { notFound } from "next/navigation";
import { getCurrentContext } from "@/lib/context";
import { CeoTabs } from "./CeoTabs";

// CEO VIEW — the ☰ item only the CEO has (owner, 2026-10-09). Every
// organization, team, coach and player, read-only for now; players' journals
// and reflections are never shown (lib/data/ceo). Anyone else gets a 404 —
// the pages don't admit they exist. This check only shapes the frame: each
// page gets its own CEO pass (./gate) before reading anything.
export default async function CeoLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentContext();
  if (ctx?.platformRole !== "CEO") notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6 pb-12">
      <header>
        <p className="e24-eyebrow">CEO View</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">Elite24MVP</h1>
        <p className="mt-1 text-sm text-muted">{ctx.user.name} · CEO</p>
      </header>
      <CeoTabs />
      {children}
    </main>
  );
}
