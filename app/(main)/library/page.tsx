import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/context";
import { LIBRARY_ENTRIES } from "@/lib/library";
import { PdfViewerLoader } from "./PdfViewerLoader";
import { cardDefault } from "@/app/components/ui/Card";

// The team's reference library. Under (main) so the onboarding gate + footer
// apply; both coaches and players can view (it's the team's shared method).
export default async function LibraryPage() {
  if (!(await getCurrentContext())) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Reference library</h1>
        <p className="text-sm text-muted">
          Your team&apos;s playbook &amp; resources.
        </p>
      </header>

      {LIBRARY_ENTRIES.map((entry) => (
        <section key={entry.slug} className={`flex flex-col gap-3 ${cardDefault}`}>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-brand">
              Team playbook
            </span>
            <h2 className="mt-1 text-lg font-semibold">{entry.title}</h2>
            <p className="mt-1 text-sm text-muted">{entry.description}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={entry.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-on-accent transition hover:bg-accent-hover active:scale-[0.97]"
            >
              Open in new tab
            </a>
            <a
              href={`${entry.href}?download=1`}
              className="rounded-full border border-line-strong px-4 py-1.5 text-xs font-semibold text-ink-soft transition hover:bg-raised-2 active:scale-[0.97]"
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
