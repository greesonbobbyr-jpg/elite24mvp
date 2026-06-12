import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LIBRARY_ENTRIES } from "@/lib/library";
import { PdfViewerLoader } from "./PdfViewerLoader";

// The team's reference library. Under (main) so the onboarding gate + footer
// apply; both coaches and players can view (it's the team's shared method).
export default async function LibraryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reference library</h1>
          <p className="text-sm text-zinc-400">
            Your team&apos;s playbook &amp; resources.
          </p>
        </div>
        <Link href="/" className="text-sm font-medium text-red-500 hover:underline">
          ← Home
        </Link>
      </header>

      {LIBRARY_ENTRIES.map((entry) => (
        <section
          key={entry.slug}
          className="flex flex-col gap-3 rounded-xl border border-zinc-800 p-5"
        >
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-red-500">
              Team playbook
            </span>
            <h2 className="mt-1 text-lg font-semibold">{entry.title}</h2>
            <p className="mt-1 text-sm text-zinc-400">{entry.description}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={entry.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Open in new tab
            </a>
            <a
              href={`${entry.href}?download=1`}
              className="rounded-full border border-zinc-700 px-4 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
            >
              Download
            </a>
          </div>

          {/* Inline in-app viewer, rendered with PDF.js so it always displays
              on the page (never a download). */}
          <PdfViewerLoader src={entry.href} />
        </section>
      ))}
    </main>
  );
}
