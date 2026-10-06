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
import { fieldBase } from "@/app/components/ui/Field";

const initial: StructureState = {};
// A compact inline field (auto width, slimmer padding).
const inlineFieldClass = `${fieldBase} px-3 py-1.5 text-sm`;

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
        className="w-fit text-xs font-semibold text-subtle transition hover:text-ink-mid"
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
      <input name="name" placeholder={`New ${kind} name`} autoFocus className={inlineFieldClass} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs font-semibold text-subtle hover:text-ink-mid"
      >
        Cancel
      </button>
      {state.error && <p className="w-full text-xs text-brand">{state.error}</p>}
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
        className={`text-left transition hover:text-brand-2 ${className ?? ""}`}
      >
        {name}
      </button>
    );
  }
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name={`${kind}Id`} value={id} />
      <input name="name" defaultValue={name} autoFocus className={inlineFieldClass} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "…" : "Save"}
      </Button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs font-semibold text-subtle hover:text-ink-mid"
      >
        Cancel
      </button>
      {state.error && <p className="text-xs text-brand">{state.error}</p>}
    </form>
  );
}
