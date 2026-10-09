"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, buttonClass } from "@/app/components/ui/Button";
import { cardDefault, rowNested } from "@/app/components/ui/Card";
import { fieldClass, labelClass } from "@/app/components/ui/Field";
import { chipClass, pillClass } from "@/app/components/ui/Pill";
import { StatTile } from "@/app/components/ui/StatTile";
import { MockNote, MockShell } from "../MockShell";

// CEO VIEW — Gary Harper's view above every organization (the ☰ item
// "CEO View"). Sees all organizations, groups, teams, coaches and players;
// players' journals and reflections stay private to the player. Everything
// he opens or changes is logged.
const TABS = ["Overview", "Organizations", "People", "Org codes", "Announcements", "Activity"] as const;
type Tab = (typeof TABS)[number];

const ORGS = [
  { name: "Mustang Basketball Club", teams: 8, players: 96, logo: "/mustang-logo.png" },
  { name: "OKC Thunder", teams: 1, players: 4, logo: "/logo.png" },
  { name: "Lincoln School District", teams: 12, players: 140, logo: "/logo.png" },
];

export default function PreviewCeo() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [issued, setIssued] = useState(false);
  const [person, setPerson] = useState(false);

  return (
    <MockShell badge={0} initials="GH" wide>
      <header>
        <p className="e24-eyebrow">CEO View</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">Elite24MVP</h1>
        <p className="mt-1 text-sm text-muted">Gary Harper · CEO</p>
      </header>
      <nav className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="CEO View">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`${pillClass(tab === t, "sm")} shrink-0`}>{t}</button>
        ))}
      </nav>

      {tab === "Overview" && (
        <section className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="Organizations"><p className="text-xl font-black text-ink">3</p></StatTile>
            <StatTile label="Teams"><p className="text-xl font-black text-ink">21</p></StatTile>
            <StatTile label="Players"><p className="text-xl font-black text-ink">240</p></StatTile>
            <StatTile label="Coaches & staff"><p className="text-xl font-black text-ink">31</p></StatTile>
            <StatTile label="Checked in today"><p className="text-xl font-black text-ink">118</p></StatTile>
            <StatTile label="Personal players"><p className="text-xl font-black text-ink">17</p></StatTile>
          </div>
          <div className={`${cardDefault} flex items-center gap-3 p-4`}>
            <span className={chipClass("warn")}>23</span>
            <span className="flex-1 text-sm text-ink-mid">accounts still need to add an email</span>
            <span className="text-xs font-semibold text-brand">Review</span>
          </div>
          <Link href="/preview/compose" className={`${buttonClass("primary")} self-start`}>Send an announcement</Link>
        </section>
      )}

      {tab === "Organizations" && (
        <section className="flex flex-col gap-2">
          <input className={fieldClass} placeholder="Search organizations" />
          {ORGS.map((o) => (
            <Link key={o.name} href="/preview/org-view" className={`${cardDefault} flex items-center gap-3 p-3`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.logo} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-frame object-contain p-1" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{o.name}</span>
                <span className="block text-xs text-subtle">{o.teams} teams · {o.players} players</span>
              </span>
              <span className="text-xs font-semibold text-brand">Open →</span>
            </Link>
          ))}
        </section>
      )}

      {tab === "People" && (
        <section className="flex flex-col gap-2">
          <input className={fieldClass} defaultValue="malik" placeholder="Search by name or email" />
          <button type="button" onClick={() => setPerson(!person)} className={`${cardDefault} flex items-center gap-3 p-3 text-left`}>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">Malik Johnson</span>
              <span className="block text-xs text-subtle">malik.j@… · Player · Mustang 17U Boys Black</span>
            </span>
            <span className="text-xs font-semibold text-brand">{person ? "Close" : "Open"}</span>
          </button>
          {person && (
            <div className={`${cardDefault} e24-reveal flex flex-col gap-2`}>
              <p className="text-sm text-ink"><span className="font-semibold">Teams:</span> Mustang 17U Boys Black (Player, #21)</p>
              <p className="text-sm text-ink"><span className="font-semibold">Card:</span> 4-star Prospect · 24,010 pts · Forward · 6&apos;2&quot;</p>
              <p className="text-sm text-ink"><span className="font-semibold">This week:</span> 5 check-ins · 7 quests · Pro Review done today</p>
              <div className={`${rowNested} px-3 py-2 text-sm text-muted`}>🔒 Journal and reflections are private to the player — not even the CEO sees them.</div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary">Reset password</Button>
                <Button size="sm" variant="secondary">Set email</Button>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "Org codes" && (
        <section className="flex flex-col gap-2">
          <div className={`${cardDefault} flex flex-col gap-2`}>
            <label className={labelClass} htmlFor="pv-for">Who is it for?</label>
            <input id="pv-for" className={fieldClass} defaultValue="Westside Hoops Academy" />
            {issued ? (
              <div className="e24-reveal flex flex-col items-center gap-1 py-2">
                <p className="rounded-xl border border-line-strong bg-sunken px-4 py-2 font-mono text-2xl font-black tracking-[0.15em] text-ink">ORG-W3TX-9K</p>
                <p className="text-xs text-subtle">One use · expires in 30 days · Share or copy it like a staff invite</p>
              </div>
            ) : (
              <Button size="sm" className="self-start" onClick={() => setIssued(true)}>Create organization code</Button>
            )}
          </div>
          {[
            ["ORG-7Q2K-…", "Mustang Basketball Club", "Used", "good"],
            ["ORG-M4ZD-…", "Lincoln School District", "Used", "good"],
            ["ORG-P8LA-…", "Eastside Elite", "Not used yet", "neutral"],
          ].map(([c, who, s, tone]) => (
            <div key={c} className={`${cardDefault} flex items-center gap-3 p-3`}>
              <span className="font-mono text-sm font-bold text-ink">{c}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-muted">{who}</span>
              <span className={chipClass(tone as "good" | "neutral")}>{s}</span>
            </div>
          ))}
        </section>
      )}

      {tab === "Announcements" && (
        <section className="flex flex-col gap-2">
          <Link href="/preview/compose" className={`${buttonClass("primary", "sm")} self-start`}>+ New announcement</Link>
          {[
            ["See it. Say it. Sketch it. Feel it.", "Everyone", "Seen by 160 of 271 · disappears in 23h"],
            ["New: Pro Review is live", "Coaches & staff", "Seen by 28 of 31"],
          ].map(([t, to, seen]) => (
            <div key={t} className={`${cardDefault} p-3`}>
              <p className="font-semibold text-ink">{t}</p>
              <p className="text-xs text-subtle">To {to} · {seen}</p>
            </div>
          ))}
        </section>
      )}

      {tab === "Activity" && (
        <ul className={`${cardDefault} flex flex-col divide-y divide-line p-0`}>
          {[
            ["Today 3:40 PM", "You opened Mustang · 17U Boys Black roster"],
            ["Today 9:12 AM", "You created an organization code for Westside Hoops Academy"],
            ["Yesterday", "You reset the password for Tyler Nguyen (Mustang)"],
          ].map(([when, what]) => (
            <li key={what} className="px-4 py-3">
              <p className="text-sm text-ink">{what}</p>
              <p className="text-xs text-subtle">{when}</p>
            </li>
          ))}
        </ul>
      )}

      <MockNote>
        Only Gary has CEO View. He can open any organization in its Organization View and act there; each organization sees what
        he did in its own Activity. Journals and reflections stay private to each player.
      </MockNote>
    </MockShell>
  );
}
