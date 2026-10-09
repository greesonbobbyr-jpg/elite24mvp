"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, buttonClass } from "@/app/components/ui/Button";
import { cardDefault, rowNested } from "@/app/components/ui/Card";
import { fieldClass, labelClass } from "@/app/components/ui/Field";
import { chipClass, pillClass } from "@/app/components/ui/Pill";
import { MockNote, MockShell } from "../MockShell";

// ORGANIZATION VIEW (the ☰ item renamed from "Organization"): everything an
// org admin runs, in tabs. A Group Admin sees the same screens limited to
// their branch; the CEO can open any org's (with a banner saying so).
const TABS = ["Tree", "Structure", "People", "Invites", "Announcements", "Activity"] as const;
type Tab = (typeof TABS)[number];

type G = { name: string; kind: string; admin?: string; children?: G[]; teams?: string[] };
const STRUCTURE: G[] = [
  {
    name: "Boys",
    kind: "Program",
    children: [
      { name: "16U", kind: "Age group", teams: ["16U Boys Black", "16U Boys Red"] },
      { name: "17U", kind: "Age group", teams: ["17U Boys Black (Varsity)", "17U Boys Red"] },
    ],
  },
  {
    name: "Girls",
    kind: "Program",
    admin: "Dana Brooks · Group Admin",
    children: [
      { name: "15U", kind: "Age group", teams: ["15U Girls Black"] },
      { name: "16U", kind: "Age group", teams: ["16U Girls Black"] },
    ],
  },
];

function StructureTree({ nodes, depth = 0 }: { nodes: G[]; depth?: number }) {
  return (
    <ul className={depth ? "ml-3 mt-1 border-l border-line pl-3" : "flex flex-col gap-2"}>
      {nodes.map((n) => (
        <li key={n.name} className={depth ? "py-1" : `${rowNested} p-3`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{n.name}</span>
            <span className={chipClass("neutral")}>{n.kind}</span>
            {n.admin && <span className={chipClass("accent")}>{n.admin}</span>}
            <span className="ml-auto text-xs font-semibold text-brand">Rename · Move</span>
          </div>
          {n.children && <StructureTree nodes={n.children} depth={depth + 1} />}
          {n.teams && (
            <ul className="ml-3 mt-1 border-l border-line pl-3">
              {n.teams.map((t) => (
                <li key={t} className="py-0.5 text-sm text-muted">🏀 {t}</li>
              ))}
              <li className="py-0.5 text-sm font-semibold text-brand">+ Add team</li>
            </ul>
          )}
        </li>
      ))}
      {depth === 0 && <li className="px-1 text-sm font-semibold text-brand">+ Add a group (Program, Age group, Level, School…)</li>}
    </ul>
  );
}

const PEOPLE = [
  { name: "Gary Harper", team: "Whole organization", role: "Org Admin" },
  { name: "Dana Brooks", team: "Girls program", role: "Group Admin" },
  { name: "Coach Jamie", team: "16U Boys Black", role: "Head Coach" },
  { name: "Malik Johnson", team: "17U Boys Black (Varsity)", role: "Player" },
  { name: "Casey Rivers", team: "17U Boys Black · 16U Boys Black", role: "Player" },
];

export default function PreviewOrgView() {
  const [tab, setTab] = useState<Tab>("Structure");
  const [promote, setPromote] = useState<string | null>(null);
  const [adult, setAdult] = useState(false);

  return (
    <MockShell badge={1} initials="GH" wide>
      <header>
        <p className="e24-eyebrow">Organization View</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">Mustang Basketball Club</h1>
        <p className="mt-1 text-sm text-muted">8 teams · 96 players · 14 staff</p>
      </header>
      <nav className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Organization View">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`${pillClass(tab === t, "sm")} shrink-0`}>{t}</button>
        ))}
      </nav>

      {tab === "Tree" && (
        <section className={`${cardDefault} flex flex-col gap-2`}>
          <p className="text-sm text-muted">The org tree you approved — owner, groups, head coaches, players — built from this structure.</p>
          <Link href="/org/view" className={buttonClass("secondary", "sm")}>Open the real tree (seeded demo)</Link>
        </section>
      )}

      {tab === "Structure" && <StructureTree nodes={STRUCTURE} />}

      {tab === "People" && (
        <section className="flex flex-col gap-2">
          <div className="flex gap-1.5">
            {["All", "Players", "Coaches & staff", "Admins"].map((f, i) => (
              <span key={f} className={pillClass(i === 0, "sm")}>{f}</span>
            ))}
          </div>
          <ul className="flex flex-col gap-2">
            {PEOPLE.map((p) => (
              <li key={p.name} className={`${cardDefault} p-3`}>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{p.name}</p>
                    <p className="truncate text-xs text-subtle">{p.team}</p>
                  </div>
                  <span className={chipClass(p.role === "Player" ? "neutral" : "accent")}>{p.role}</span>
                  {p.role === "Player" && (
                    <button type="button" onClick={() => { setPromote(promote === p.name ? null : p.name); setAdult(false); }} className="text-xs font-semibold text-brand">
                      Change role
                    </button>
                  )}
                </div>
                {promote === p.name && (
                  <div className="e24-reveal mt-3 flex flex-col gap-2 border-t border-line pt-3">
                    <label className={labelClass} htmlFor="pv-newrole">New role on {p.team.split(" · ")[0]}</label>
                    <select id="pv-newrole" className={fieldClass} defaultValue="ac">
                      <option value="ac">Assistant Coach</option>
                      <option value="gm">General Manager</option>
                      <option value="hc">Head Coach</option>
                    </select>
                    <label className="flex items-start gap-2 text-sm text-ink-mid">
                      <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-0.5 h-4 w-4 accent-accent" />
                      <span>I confirm {`${p.name.split(" ")[0]} is an adult (18+).`} Staff can see players&apos; emergency contacts.</span>
                    </label>
                    <Button size="sm" disabled={!adult} className="self-start">Save role</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "Invites" && (
        <section className="flex flex-col gap-2">
          <Link href="/preview/invite" className={`${buttonClass("primary", "sm")} self-start`}>+ New invite</Link>
          {[
            ["K7QD-…", "Assistant Coach · 14U Mustang Black", "Expires in 6 days", "neutral"],
            ["P3MV-…", "Head Coach · 15U Girls Black", "Used by Coach Tanya", "good"],
            ["X9RT-…", "General Manager · 17U Boys Red", "Expired", "warn"],
          ].map(([code, what, status, tone]) => (
            <div key={code} className={`${cardDefault} flex items-center gap-3 p-3`}>
              <span className="font-mono text-sm font-bold text-ink">{code}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-muted">{what}</span>
              <span className={chipClass(tone as "neutral" | "good" | "warn")}>{status}</span>
            </div>
          ))}
        </section>
      )}

      {tab === "Announcements" && (
        <section className="flex flex-col gap-2">
          <Link href="/preview/compose" className={`${buttonClass("primary", "sm")} self-start`}>+ New announcement</Link>
          {[
            ["Spring tryouts — Saturday 9 AM", "Boys · 16U and 17U", "Seen by 31 of 40"],
            ["Uniform pickup this week", "Whole organization", "Seen by 77 of 110"],
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
            ["Today 3:40 PM", "Gary Harper (CEO) opened the 17U Boys Black roster"],
            ["Today 1:05 PM", "Dana Brooks invited an Assistant Coach to 15U Girls Black"],
            ["Yesterday", "Gary Harper (Org Admin) changed Chris Thompson to Assistant Coach (adult confirmed)"],
          ].map(([when, what]) => (
            <li key={what} className="px-4 py-3">
              <p className="text-sm text-ink">{what}</p>
              <p className="text-xs text-subtle">{when}</p>
            </li>
          ))}
        </ul>
      )}

      <MockNote>
        Only an organization can turn a player into a coach (Change role). Group admins — like a Girls Director — see these same
        tabs for their part only. Everything the CEO does in your org shows up under Activity.
      </MockNote>
    </MockShell>
  );
}
