"use client";

import { useActionState, useState } from "react";
import {
  createProgram,
  createDivision,
  createTeamInDivision,
  renameProgram,
  renameDivision,
  type StructureState,
} from "./actions";
import { Button } from "@/app/components/ui/Button";

const initial: StructureState = {};
const fieldClass =
  "rounded-lg border border-red-600/25 bg-black/40 px-3 py-1.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-red-500";

// Quiet "+ Add …" affordance that expands into a one-field create form.
export function AddForm({
  kind,
  parentField,
  parentId,
}: {
  kind: "program" | "division" | "team";
  parentField?: "programId" | "divisionId";
  parentId?: number;
}) {
  const action =
    kind === "program" ? createProgram : kind === "division" ? createDivision : createTeamInDivision;
  const [state, formAction, pending] = useActionState(action, initial);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-fit text-xs font-semibold text-zinc-500 transition hover:text-zinc-300"
      >
        + Add {kind}
      </button>
    );
  }
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      {parentField && parentId != null && (
        <input type="hidden" name={parentField} value={parentId} />
      )}
      <input name="name" placeholder={`New ${kind} name`} autoFocus className={fieldClass} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs font-semibold text-zinc-500 hover:text-zinc-300"
      >
        Cancel
      </button>
      {state.error && <p className="w-full text-xs text-red-500">{state.error}</p>}
    </form>
  );
}

// Tap the name to rename in place (programs + divisions).
export function RenameableName({
  kind,
  id,
  name,
  className,
}: {
  kind: "program" | "division";
  id: number;
  name: string;
  className?: string;
}) {
  const action = kind === "program" ? renameProgram : renameDivision;
  const [state, formAction, pending] = useActionState(action, initial);
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title={`Rename ${kind}`}
        className={`text-left transition hover:text-red-400 ${className ?? ""}`}
      >
        {name}
      </button>
    );
  }
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name={`${kind}Id`} value={id} />
      <input name="name" defaultValue={name} autoFocus className={fieldClass} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "…" : "Save"}
      </Button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs font-semibold text-zinc-500 hover:text-zinc-300"
      >
        Cancel
      </button>
      {state.error && <p className="text-xs text-red-500">{state.error}</p>}
    </form>
  );
}
