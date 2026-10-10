import type { ReactNode } from "react";

// An announcement as people see it (person-first plan Phase 5; looks
// approved by the owner on the Phase 0 mockup, 2026-10-09):
//   elite24  from the CEO — the black brand frame with a gold edge, the
//            heaviest card: it speaks for the whole app.
//   org      from an organization — a white card with the org's own color
//            and logo, its one brand slot (CLAUDE.md §9).
// Coach alerts keep their own look. Pictures load through /api/media, which
// checks the viewer first; the video link opens the site, never embedded.

export type AnnouncementView = {
  id: number;
  look: "elite24" | "org";
  title: string;
  body: string;
  linkUrl: string | null;
  pictures: { id: string; width: number | null; height: number | null }[];
  org: { name: string; color: string | null; logoUrl: string | null } | null;
  to: string; // "Players · 17U Boys Black"
  from: string; // "Gary Harper · CEO"
  when: string;
  expires: string | null; // "Disappears in 5h"
  unread: boolean;
};

export function ExpiryChip({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2 py-0.5 text-[11px] font-semibold text-muted">
      <span aria-hidden>⏱</span>
      {text}
    </span>
  );
}

function Pictures({ pictures }: { pictures: AnnouncementView["pictures"] }) {
  if (pictures.length === 0) return null;
  if (pictures.length === 1) {
    const p = pictures[0];
    return (
      // eslint-disable-next-line @next/next/no-img-element -- private, session-checked bytes; not for the image optimizer
      <img
        src={`/api/media/${p.id}`}
        alt=""
        loading="lazy"
        width={p.width ?? undefined}
        height={p.height ?? undefined}
        className="max-h-[28rem] w-full rounded-xl bg-sunken object-contain"
      />
    );
  }
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {pictures.map((p) => (
        // eslint-disable-next-line @next/next/no-img-element -- see above
        <img key={p.id} src={`/api/media/${p.id}`} alt="" loading="lazy" className="aspect-square w-full rounded-lg bg-sunken object-cover" />
      ))}
    </div>
  );
}

const LINK_SITE: Record<string, string> = { "youtu.be": "YouTube", "youtube.com": "YouTube", "vimeo.com": "Vimeo", "hudl.com": "Hudl" };

function VideoLink({ url }: { url: string }) {
  // Sent links are already checked; the composer's preview passes whatever
  // is being typed, so a half-typed address shows nothing.
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^(www|m)\./, "");
  } catch {
    return null;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-line-strong bg-sunken px-3 py-2.5 text-sm font-semibold text-ink hover:border-field-line"
    >
      <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
        ▶
      </span>
      <span className="min-w-0 flex-1 truncate">Watch on {LINK_SITE[host] ?? host}</span>
      <span aria-hidden className="text-muted">↗</span>
    </a>
  );
}

export function AnnouncementCard({ a, action }: { a: AnnouncementView; action?: ReactNode }) {
  const content = (
    <>
      <Pictures pictures={a.pictures} />
      <div>
        <h3 className={a.look === "elite24" ? "text-lg font-black text-ink" : "font-bold text-ink"}>{a.title}</h3>
        {a.body && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-soft">{a.body}</p>}
      </div>
      {a.linkUrl && <VideoLink url={a.linkUrl} />}
    </>
  );

  if (a.look === "elite24") {
    return (
      <article className="theme-dark overflow-hidden rounded-2xl border-2 border-gold-solid bg-frame shadow-lg shadow-shade">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <span className="flex min-w-0 items-center gap-2">
            {/* The wordmark is a logo (an image to screen readers), like the header's. */}
            <span role="img" aria-label="Elite24MVP" className="font-black italic leading-none text-ink" style={{ fontFamily: "var(--font-barlow)", fontSize: "1.05rem" }}>
              Elite<span className="text-logo">24</span>MVP
            </span>
            <span className="rounded-full bg-gold-solid px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-on-gold">
              Announcement
            </span>
          </span>
          {a.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gold-solid" aria-label="Unread" />}
        </div>
        <div className="flex flex-col gap-3 p-4">
          {content}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-subtle">
              {a.from} · {a.when}
            </span>
            {a.expires && <ExpiryChip text={a.expires} />}
          </div>
          <p className="text-[11px] text-subtle">To {a.to}</p>
          {action}
        </div>
      </article>
    );
  }

  const color = a.org?.color ?? "var(--accent)";
  return (
    <article className="relative overflow-hidden rounded-2xl border border-line bg-panel shadow-sm shadow-shade">
      {/* The org's own color — its one brand slot (CLAUDE.md §9). */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: color }} />
      <div className="flex flex-col gap-3 p-4 pl-6">
        <div className="flex items-center gap-2.5">
          {a.org?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- team logos are stored data URLs
            <img src={a.org.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg bg-frame object-contain p-0.5" />
          ) : (
            <span aria-hidden className="theme-dark flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-frame text-sm font-black text-ink" style={{ boxShadow: `inset 0 0 0 2px ${color}` }}>
              {(a.org?.name ?? "?").slice(0, 1)}
            </span>
          )}
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-bold text-ink">{a.org?.name}</p>
            <p className="truncate text-[11px] text-subtle">To {a.to}</p>
          </div>
          {a.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-label="Unread" />}
        </div>
        {content}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-subtle">
            {a.from} · {a.when}
          </span>
          {a.expires && <ExpiryChip text={a.expires} />}
        </div>
        {action}
      </div>
    </article>
  );
}
