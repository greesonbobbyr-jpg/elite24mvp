"use client";

import { useState } from "react";
import { regenerateJoinCode } from "./actions";

// Shows the team join code with a copy button and a Regenerate action. Copy is
// client-side; regenerate is the server action (form).
export function JoinCodeCard({ code }: { code: string | null }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  return (
    <section className="e24-surface rounded-2xl p-5">
      <div className="relative z-10">
        <p className="e24-eyebrow">Team join code</p>
        <p className="mt-1 text-xs text-muted">
          Players use this code to join your team.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="rounded-lg border border-line-strong bg-field px-4 py-2 font-mono text-2xl font-black tracking-[0.2em] text-ink">
            {code ?? "——————"}
          </span>
          <button
            type="button"
            onClick={copy}
            disabled={!code}
            className="rounded-full border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-field-line active:scale-95 disabled:opacity-50"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <form action={regenerateJoinCode}>
            <button
              type="submit"
              className="rounded-full border border-field-line px-3 py-1.5 text-xs font-semibold text-brand-2 transition hover:border-accent-edge active:scale-95"
            >
              Regenerate
            </button>
          </form>
        </div>
        <p className="mt-2 text-[11px] text-subtle">
          Regenerating makes the old code stop working.
        </p>
      </div>
    </section>
  );
}
