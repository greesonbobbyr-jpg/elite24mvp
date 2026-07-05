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
  const field =
    "w-full rounded-lg border border-red-600/25 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-red-500";

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
                  ? "border-green-500 bg-green-600/20 text-green-300"
                  : "border-red-500 bg-red-600/20 text-red-300"
                : "border-white/15 text-zinc-400 hover:border-white/30"
            }`}
          >
            {d === "add" ? "Add" : "Remove"}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          name="amount"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="Amount"
          className={`${field} w-28 shrink-0`}
        />
        <input
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={removing ? "Reason (required)" : "Reason (optional)"}
          className={field}
        />
      </div>

      {state.error && <p className="text-sm text-red-500">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-400">Points updated.</p>}

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
