import { notFound } from "next/navigation";
import { Button } from "@/app/components/ui/Button";
import { Banner } from "@/app/components/ui/Banner";
import { Card, rowNested, rowOnPage, stripAccent } from "@/app/components/ui/Card";
import { checkClass, fieldClass, labelClass } from "@/app/components/ui/Field";
import { chipClass, iconTile, pillClass } from "@/app/components/ui/Pill";
import { StarIcon, StatTile } from "@/app/components/ui/StatTile";

// STYLE GUIDE — every shared building block in one place, in whichever mode
// the phone (or the ☰ Appearance switch) is in. The light-mode revamp's
// reference (owner, 2026-10-06) and a pixel baseline: scripts/shoot-cards.ts
// --style-guide shoots it in light and dark, so a token change that shifts
// the look shows up. Static content only — no data, no dates. DEV-ONLY:
// production builds 404.
export default function StyleGuidePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-8">
      <header>
        <p className="e24-eyebrow">Style guide</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">Building blocks</h1>
        <p className="mt-1 text-sm text-muted">
          One solid accent, an edge on every surface. Build screens from these.
        </p>
      </header>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Check in</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="danger">Remove</Button>
          <Button variant="ghost">Skip</Button>
          <Button disabled>Saving…</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section title="Tabs and pills">
        <div className="flex flex-wrap gap-2">
          <span className={pillClass(true)}>All-time</span>
          <span className={pillClass(false)}>This week</span>
          <span className={pillClass(true, "sm")}>Yes</span>
          <span className={pillClass(false, "sm")}>Partly</span>
        </div>
      </Section>

      <Section title="Chips">
        <div className="flex flex-wrap gap-2">
          <span className={chipClass("accent")}>Head coach</span>
          <span className={chipClass("good")}>✓ Checked in · +10</span>
          <span className={chipClass("warn")}>Pending</span>
          <span className={chipClass("gold")}>Shooting reps +15</span>
          <span className={chipClass("neutral")}>JC</span>
        </div>
      </Section>

      <Section title="Cards">
        <div className="flex flex-col gap-3">
          <Card variant="material">
            <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-accent" />
            <div className="relative z-10">
              <p className="e24-eyebrow">My Dream</p>
              <p className="mt-1 text-xl font-bold leading-snug text-ink">Play Division I basketball.</p>
            </div>
          </Card>
          <Card>
            <h3 className="text-lg font-semibold text-ink">A plain card</h3>
            <p className="mt-1 text-sm text-muted">White on the page, with a gray edge.</p>
            <div className={`${rowNested} mt-3 p-3 text-sm text-ink-soft`}>A row nested inside a card.</div>
          </Card>
          <Card variant="accent">
            <p className="e24-eyebrow">Pro Review</p>
            <p className="mt-1 text-sm text-ink-soft">An accent-marked card: a solid bar, never a tint.</p>
          </Card>
          <section className={`${stripAccent} flex items-center gap-3 px-4 py-3`}>
            <span aria-hidden>🏀</span>
            <span className="e24-eyebrow">1-Minute Mindset</span>
            <span className="min-w-0 flex-1 truncate font-semibold text-ink">A one-line strip</span>
          </section>
        </div>
      </Section>

      <Section title="Stat tiles and icons">
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Day streak">
            <p className="text-xl font-black leading-none text-ink">🔥 3</p>
          </StatTile>
          <StatTile label="915 pts to 2★" ariaLabel="1-star Prospect, 915 points to 2 stars">
            <span className="flex text-gold-solid">
              <StarIcon className="h-3.5 w-3.5" />
            </span>
            <span className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-ink">Prospect</span>
          </StatTile>
          <StatTile label="Team rank">
            <p className="text-xl font-black leading-none text-ink">#1</p>
          </StatTile>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className={iconTile} aria-hidden>◎</span>
          <span className="text-sm text-muted">A quest icon tile</span>
        </div>
      </Section>

      <Section title="Rows on the page">
        <ul className="flex flex-col gap-2">
          {["Great hustle on Saturday", "Bring a water bottle every session"].map((title) => (
            <li key={title} className={`${rowOnPage} flex items-center gap-3 px-4 py-3`}>
              <span className={`${chipClass("good")} px-1.5`}>✓</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{title}</span>
              <span className="text-xs text-subtle">Sep 27</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Banners">
        <div className="flex flex-col gap-2">
          <Banner tone="warn">Not checked in yet</Banner>
          <Banner tone="good">Checked in at 7:42 AM</Banner>
          <Banner tone="info">Reminders are on</Banner>
          <Banner tone="accent">Send as TIME OUT</Banner>
        </div>
      </Section>

      <Section title="Fields">
        <label className={labelClass} htmlFor="sg-name">Your name</label>
        <input id="sg-name" className={fieldClass} placeholder="Coach name" />
        <label className={`${labelClass} mt-3`} htmlFor="sg-note">Note</label>
        <textarea id="sg-note" rows={2} className={fieldClass} defaultValue="100 free throws, then left hand." />
        <label className={`${labelClass} mt-3`} htmlFor="sg-select">Reminder</label>
        <select id="sg-select" className={fieldClass} defaultValue="off">
          <option value="off">Off</option>
        </select>
        <label className="mt-3 flex items-center gap-2 text-sm text-ink-mid">
          <input type="checkbox" className={checkClass} defaultChecked />
          Send as TIME OUT
        </label>
      </Section>

      <Section title="Team Circle">
        <div className="flex flex-col gap-2">
          <div className="e24-bubble max-w-[80%] self-start rounded-2xl rounded-bl-md px-3.5 py-2.5">
            <p className="relative z-10 text-sm text-bubble-ink">Let&apos;s get after it. LFG team 🏀</p>
          </div>
          <div className="max-w-[80%] self-end rounded-2xl rounded-br-md bg-bubble-mine px-3.5 py-2.5">
            <p className="text-sm text-bubble-mine-ink">Well deserved, Tyler 🔒</p>
          </div>
        </div>
      </Section>

      <Section title="Text">
        <p className="text-ink">Ink — headings and body</p>
        <p className="text-ink-mid">Ink mid — secondary body</p>
        <p className="text-muted">Muted — supporting text</p>
        <p className="text-subtle">Subtle — dates, hints</p>
        <p className="font-semibold text-brand">Accent text — links, eyebrows</p>
        <p className="font-semibold text-good">Good</p>
        <p className="font-semibold text-warn">Warn</p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-subtle">{title}</h2>
      {children}
    </section>
  );
}
