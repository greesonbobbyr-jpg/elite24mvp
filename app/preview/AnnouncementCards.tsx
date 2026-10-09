import type { ReactNode } from "react";
import { Button } from "@/app/components/ui/Button";

// The three kinds of message in Notifications, each with its own weight
// (owner, 2026-10-09):
//   Elite24 (from the CEO)  — the black brand frame with a gold edge: the
//                             heaviest, it speaks for the whole app.
//   Organization            — a white card in the org's own color and logo.
//   Coach alert             — unchanged: the accent bar.

export function ExpiryChip({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2 py-0.5 text-[11px] font-semibold text-muted">
      <span aria-hidden>⏱</span>
      {text}
    </span>
  );
}

/** A motivational poster, standing in for an uploaded picture. */
export function Poster({ line, sub }: { line: string; sub?: string }) {
  return (
    <div
      className="relative flex aspect-[4/5] w-full flex-col items-center justify-end overflow-hidden rounded-xl bg-frame p-5 text-center"
      style={{ backgroundImage: "url(/card/finishes/gold/field.webp)", backgroundSize: "cover", backgroundPosition: "center 40%" }}
    >
      <span className="absolute inset-0" style={{ background: "linear-gradient(transparent 35%, rgba(0,0,0,.85))" }} aria-hidden />
      <span className="relative text-3xl font-black uppercase italic leading-none text-on-accent" style={{ fontFamily: "var(--font-barlow)" }}>
        {line}
      </span>
      {sub && <span className="relative mt-2 text-xs font-bold uppercase tracking-[0.2em] text-gold-solid">{sub}</span>}
    </div>
  );
}

export function Elite24Announcement({
  title,
  body,
  media,
  expires,
  unread = true,
  action = true,
}: {
  title: string;
  body: string;
  media?: ReactNode;
  expires?: string;
  unread?: boolean;
  action?: boolean;
}) {
  return (
    <article className="theme-dark overflow-hidden rounded-2xl border-2 border-gold-solid bg-frame shadow-lg shadow-shade">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <span className="flex items-center gap-2">
          <span className="font-black italic leading-none text-ink" style={{ fontFamily: "var(--font-barlow)", fontSize: "1.05rem" }}>
            Elite<span className="text-logo">24</span>MVP
          </span>
          <span className="rounded-full bg-gold-solid px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-on-gold">Announcement</span>
        </span>
        {unread && <span className="h-2.5 w-2.5 rounded-full bg-gold-solid" aria-label="Unread" />}
      </div>
      <div className="flex flex-col gap-3 p-4">
        {media}
        <div>
          <h3 className="text-lg font-black text-ink">{title}</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{body}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-subtle">From Gary Harper · CEO</span>
          {expires && <ExpiryChip text={expires} />}
        </div>
        {action && <Button size="sm" className="self-start">Got it</Button>}
      </div>
    </article>
  );
}

export function OrgAnnouncement({
  org,
  color,
  logo,
  to,
  title,
  body,
  media,
  expires,
  unread = true,
}: {
  org: string;
  color: string;
  logo: string;
  to: string;
  title: string;
  body: string;
  media?: ReactNode;
  expires?: string;
  unread?: boolean;
}) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-line bg-panel shadow-sm shadow-shade">
      {/* The org's own color — its one brand slot (CLAUDE.md §9). */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: color }} />
      <div className="flex flex-col gap-3 p-4 pl-6">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" className="h-9 w-9 shrink-0 rounded-lg bg-frame object-contain p-0.5" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-bold text-ink">{org}</p>
            <p className="text-[11px] text-subtle">To {to}</p>
          </div>
          {unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-label="Unread" />}
        </div>
        {media}
        <div>
          <h3 className="font-bold text-ink">{title}</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{body}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button size="sm">Got it</Button>
          {expires && <ExpiryChip text={expires} />}
        </div>
      </div>
    </article>
  );
}

export function CoachAlert({ title, body }: { title: string; body: string }) {
  return (
    <article className="e24-surface overflow-hidden rounded-2xl">
      <div className="flex">
        <div className="w-1.5 shrink-0 bg-accent" />
        <div className="relative z-10 flex-1 p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">CG</span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold text-ink">Coach Gary <span className="font-normal text-muted">· Head Coach</span></p>
              <p className="text-[11px] text-subtle">Today, 3:12 PM</p>
            </div>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-label="Unread" />
          </div>
          <h3 className="mt-3 font-bold text-ink">{title}</h3>
          <p className="mt-1 text-sm text-ink-soft">{body}</p>
          <Button size="sm" className="mt-3">I&apos;ve read this</Button>
        </div>
      </div>
    </article>
  );
}
