"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { acceptInviteCode, enterCode, type AcceptState, type CodeState } from "./actions";
import { OrgWizard } from "@/app/components/OrgWizard";
import { Button, buttonClass } from "@/app/components/ui/Button";
import { cardDefault } from "@/app/components/ui/Card";
import { checkClass, fieldClass } from "@/app/components/ui/Field";

// STEP 2 — three paths (owner, 2026-10-09): start an organization, join a
// team with a code, or Personal Player Development.

type Path = "org" | "join" | "solo";

function CodeBox({ initial, placeholder, label }: { initial?: string; placeholder: string; label: string }) {
  return (
    <div className="flex gap-2">
      <label htmlFor={`code-${label}`} className="sr-only">{label}</label>
      <input
        id={`code-${label}`}
        name="code"
        defaultValue={initial}
        placeholder={placeholder}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className={`${fieldClass} font-mono uppercase tracking-widest`}
      />
      <Button type="submit" size="sm">Go</Button>
    </div>
  );
}

export function AcceptStaff({ code, token, what }: { code?: string; token?: string; what: string }) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(acceptInviteCode, {});
  return (
    <form action={action} className="e24-reveal flex flex-col gap-3 rounded-xl border border-line bg-sunken p-4">
      {code && <input type="hidden" name="code" value={code} />}
      {token && <input type="hidden" name="token" value={token} />}
      <p className="text-sm text-ink">
        You&apos;re invited as <span className="font-semibold">{what}</span>.
      </p>
      <label className="flex items-start gap-2 text-sm text-ink-mid">
        <input type="checkbox" name="adult" className={`${checkClass} mt-0.5`} />
        <span>I&apos;m 18 or older. (Coaches and staff can see players&apos; emergency contacts.)</span>
      </label>
      {state.error && <p className="text-sm font-semibold text-brand">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending} className="self-start">{pending ? "Joining…" : "Accept invite"}</Button>
    </form>
  );
}

export function WelcomePaths({ firstName, initialCode, canGoSolo }: { firstName: string; initialCode: string | null; canGoSolo: boolean }) {
  const [path, setPath] = useState<Path | null>(initialCode ? "join" : null);
  const [joinState, joinAction, joining] = useActionState<CodeState, FormData>(enterCode, {});
  const [orgState, orgAction, checking] = useActionState<CodeState, FormData>(enterCode, {});

  const card = (p: Path, icon: string, title: string, sub: string) => (
    <button
      type="button"
      onClick={() => setPath(path === p ? null : p)}
      aria-expanded={path === p}
      className={`${cardDefault} flex w-full items-center gap-4 p-4 text-left transition ${path === p ? "border-accent-edge" : ""}`}
    >
      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sunken text-2xl">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-ink">{title}</span>
        <span className="block text-sm text-muted">{sub}</span>
      </span>
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      <header className="mb-2">
        <p className="e24-eyebrow">Step 2</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">Welcome, {firstName}! What brings you here?</h1>
      </header>

      {card("org", "🏢", "Start an Organization", "A club, school or district. You'll need an organization code from Elite24.")}
      {path === "org" && (
        <div className={`${cardDefault} flex flex-col gap-3`}>
          {orgState.kind === "org" && orgState.code ? (
            <OrgWizard code={orgState.code} ceo={false} />
          ) : (
            <form action={orgAction} className="flex flex-col gap-2">
              <CodeBox placeholder="ORG-XXXX-XXXX" label="Organization code" />
              {checking && <p className="text-xs text-subtle">Checking…</p>}
              {orgState.error && <p className="text-sm font-semibold text-brand">{orgState.error}</p>}
              {orgState.kind === "staff" && <p className="text-sm font-semibold text-brand">That&apos;s a team invite — use “Joining a Team”.</p>}
            </form>
          )}
        </div>
      )}

      {card("join", "🏀", "Joining a Team", "Enter the code your coach or organization gave you.")}
      {path === "join" && (
        <div className={`${cardDefault} flex flex-col gap-3`}>
          <form action={joinAction} className="flex flex-col gap-2">
            <CodeBox initial={initialCode ?? undefined} placeholder="Team or invite code" label="Team or invite code" />
            <p className="text-xs text-subtle">Team codes have 6 characters (like MUSTJV). Coach invites have 8 (like K7QD-M2PX).</p>
            {joining && <p className="text-xs text-subtle">Checking…</p>}
            {joinState.error && <p className="text-sm font-semibold text-brand">{joinState.error}</p>}
            {joinState.kind === "org" && <p className="text-sm font-semibold text-brand">That&apos;s an organization code — use “Start an Organization”.</p>}
          </form>
          {joinState.kind === "staff" && joinState.code && <AcceptStaff code={joinState.code} what={joinState.what ?? ""} />}
        </div>
      )}

      {canGoSolo && card("solo", "📈", "Personal Player Development", "Train on your own: daily check-in, quests, points, journal. Join a team any time later.")}
      {canGoSolo && path === "solo" && (
        <div className={`${cardDefault} flex flex-col gap-3`}>
          <p className="text-sm text-muted">
            First, write your Dream — where you want basketball to take you. Then the daily loop starts. No team needed.
          </p>
          <Link href="/onboarding" className={`${buttonClass("primary", "sm")} self-start`}>Start training</Link>
        </div>
      )}
    </div>
  );
}
