"use client";

import { useActionState, useEffect, useState } from "react";
import { adjustPoints, type CoachActionState } from "../../actions";
import { Button } from "@/app/components/ui/Button";

const initialState: CoachActionState = {};

// Coach control to add or remove a player's points. Add may omit a reason; a
// removal REQUIRES one (server-enforced too). Submits the existing adjustPoints
// server action — ledger row + cached total updated in one transaction.
export function AdjustPointsForm({ playerId }: { playerId: number }) {
  const [state, formAction, pending] = useActionState(adjustPoints, initialState);
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (state.ok) {
      setAmount("");
      setReason("");
    }
  }, [state]);

  const removing = direction === "remove";
  // No `w-full` here — width is set per field below. (It used to live in this
  // shared string, which made the reason input 100% wide INSIDE a flex row next
  // to the amount box, pushing it off the right edge of the card — invisible on
  // a phone, so a coach couldn't type the reason a removal requires.)
  const field =
    "rounded-lg border border-field-line bg-field px-3 py-2 text-sm text-ink outline-none transition focus:border-accent-edge";
  const label =
    "mb-1 block text-[10px] font-bold uppercase tracking-wide text-subtle";

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-2">
      <input type="hidden" name="playerId" value={playerId} />
      <input type="hidden" name="direction" value={direction} />

      {/* Add / Remove toggle */}
      <div className="flex gap-2">
        {(["add", "remove"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition active:scale-95 ${
              direction === d
                ? d === "add"
                  ? "border-green-500 bg-green-600/20 text-good-2"
                  : "border-accent-edge bg-red-600/20 text-brand-3"
                : "border-line-strong text-muted hover:border-field-line"
            }`}
          >
            {d === "add" ? "Add" : "Remove"}
          </button>
        ))}
      </div>

      {/* Amount */}
      <div>
        <label htmlFor="adj-amount" className={label}>
          {removing ? "Points to remove" : "Points to add"}
        </label>
        <input
          id="adj-amount"
          name="amount"
          inputMode="numeric"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="e.g. 20"
          className={`${field} w-32`}
        />
      </div>

      {/* Reason — full width on its own row so it's always visible. Required
          for a removal (browser-enforced here, server-enforced in adjustPoints)
          so there's a record of why points were taken. */}
      <div>
        <label htmlFor="adj-reason" className={label}>
          Reason{" "}
          {removing ? (
            <span className="text-brand-2">(required)</span>
          ) : (
            <span className="text-subtle">(optional)</span>
          )}
        </label>
        <input
          id="adj-reason"
          name="reason"
          required={removing}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={
            removing
              ? "Why are these points being removed?"
              : "What are these points for?"
          }
          className={`${field} w-full`}
        />
      </div>

      {state.error && <p className="text-sm text-brand">{state.error}</p>}
      {state.ok && <p className="text-sm text-good">Points updated.</p>}

      <Button
        type="submit"
        disabled={pending}
        className="self-start"
        variant={removing ? "secondary" : "primary"}
      >
        {pending
          ? "Saving…"
          : removing
            ? "Remove points"
            : "Add points"}
      </Button>
    </form>
  );
}
