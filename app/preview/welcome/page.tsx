"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonClass } from "@/app/components/ui/Button";
import { cardDefault } from "@/app/components/ui/Card";
import { fieldClass } from "@/app/components/ui/Field";
import { chipClass } from "@/app/components/ui/Pill";
import { AuthFrame, MockNote } from "../MockShell";

// STEP 2 — "What brings you here?" The owner's three paths (2026-10-09).
type Path = "org" | "team" | "personal";

const PATHS: { key: Path; icon: string; title: string; line: string }[] = [
  { key: "org", icon: "🏢", title: "Start an Organization", line: "Run a club, school or program. You'll need the organization code Elite24 gave you." },
  { key: "team", icon: "🏀", title: "Joining a Team", line: "Your coach or organization gave you a code. Players and coaches both join here." },
  { key: "personal", icon: "📈", title: "Personal Player Development", line: "Train on your own: daily check-in, quests, points and your journal. Join a team anytime." },
];

// What a typed code turns into (sample data).
const SAMPLE_CODES: Record<string, string> = {
  MUSTJV: "Mustang JV — you'll join as a Player.",
  "K7QD-M2PX": "14U Mustang Black — you'll join as Assistant Coach (invited by Coach Gary).",
};

export default function PreviewWelcome() {
  const [open, setOpen] = useState<Path | null>(null);
  const [code, setCode] = useState("");
  const found = SAMPLE_CODES[code.trim().toUpperCase()];

  return (
    <AuthFrame subtitle="Welcome, Andre! What brings you here?">
      <ul className="flex flex-col gap-3">
        {PATHS.map((p) => {
          const isOpen = open === p.key;
          return (
            <li key={p.key}>
              <button
                type="button"
                onClick={() => {
                  setOpen(isOpen ? null : p.key);
                  setCode("");
                }}
                aria-expanded={isOpen}
                className={`${cardDefault} flex w-full items-start gap-3 p-4 text-left transition ${isOpen ? "border-accent-edge ring-1 ring-accent-edge" : "hover:border-field-line"}`}
              >
                <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-xl">
                  {p.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-ink">{p.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{p.line}</span>
                </span>
              </button>

              {isOpen && p.key === "org" && (
                <div className="e24-reveal mt-2 flex flex-col gap-2 px-1">
                  <input className={`${fieldClass} font-mono uppercase tracking-widest`} placeholder="Organization code" defaultValue="ORG-7Q2K-M8" />
                  <Link href="/preview/org-setup" className={`${buttonClass("primary")} w-full`}>Continue</Link>
                  <p className="text-xs text-subtle">Don&apos;t have one? Organization codes come from Elite24 — reach out to get started.</p>
                </div>
              )}

              {isOpen && p.key === "team" && (
                <div className="e24-reveal mt-2 flex flex-col gap-2 px-1">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className={`${fieldClass} font-mono uppercase tracking-widest`}
                    placeholder="Team or invite code"
                  />
                  {found ? (
                    <p className={`${chipClass("good")} w-fit`}>✓ {found}</p>
                  ) : (
                    <p className="text-xs text-subtle">Try MUSTJV (a team code) or K7QD-M2PX (a coach invite).</p>
                  )}
                  <button type="button" disabled={!found} className={`${buttonClass("primary")} w-full`}>Join</button>
                </div>
              )}

              {isOpen && p.key === "personal" && (
                <div className="e24-reveal mt-2 flex flex-col gap-2 px-1">
                  <p className="text-sm text-ink-mid">
                    You&apos;ll get the Elite24 daily quests, check-ins, points and your journal. No team, no
                    team chat — just your own work. Enter a team code any time to join one.
                  </p>
                  <span className={`${buttonClass("primary")} w-full`}>Set up my player profile</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <MockNote>A code is the only way onto a team. Coaches join with an invite code; nobody can find you until you&apos;re on a team.</MockNote>
    </AuthFrame>
  );
}
