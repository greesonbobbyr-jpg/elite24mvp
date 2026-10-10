"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import type { GroupKind } from "@prisma/client";
import { Button } from "@/app/components/ui/Button";
import { checkClass, fieldBase, labelClass } from "@/app/components/ui/Field";
import { pillClass } from "@/app/components/ui/Pill";
import {
  addGroup,
  addGroupAdmin,
  addTeam,
  applyTemplate,
  deleteGroup,
  editGroup,
  moveGroup,
  moveTeam,
  removeGroupAdmin,
  type ShapeState,
} from "../actions";

// The Structure tab's controls. Each is a small form posting to one of
// ../actions (which re-checks everything on the server); errors show beside
// the control that caused them.

type Action = (prev: ShapeState, formData: FormData) => Promise<ShapeState>;
type Option = { value: string; label: string };

const inline = `${fieldBase} px-2.5 py-1.5 text-sm`;
const quiet = "text-xs font-semibold text-brand transition hover:text-brand-2";

function ShapeForm({
  action,
  orgId,
  hidden,
  children,
  className = "flex flex-wrap items-center gap-2",
  onOk,
}: {
  action: Action;
  orgId: number;
  hidden?: Record<string, string | number>;
  children: ReactNode;
  className?: string;
  onOk?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  useEffect(() => {
    if (state.ok) onOk?.();
  }, [state, onOk]);
  return (
    <form action={formAction} className={className}>
      <input type="hidden" name="orgId" value={orgId} />
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state.error && <p className="w-full text-xs font-semibold text-brand">{state.error}</p>}
    </form>
  );
}

function KindSelect({ kinds, value }: { kinds: Option[]; value?: GroupKind }) {
  return (
    <select name="kind" defaultValue={value ?? "CUSTOM"} aria-label="Kind of group" className={inline}>
      {kinds.map((k) => (
        <option key={k.value} value={k.value}>{k.label}</option>
      ))}
    </select>
  );
}

/** "+ Add group" → name + kind. */
export function AddGroup({ orgId, parentId, kinds, label }: { orgId: number; parentId: number | null; kinds: Option[]; label: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className={quiet}>+ {label}</button>;
  }
  return (
    <ShapeForm action={addGroup} orgId={orgId} hidden={parentId == null ? {} : { parentId }} onOk={() => setOpen(false)}>
      <input name="name" placeholder="Name, e.g. Girls or 15U" aria-label="Group name" autoFocus className={inline} />
      <KindSelect kinds={kinds} />
      <Button type="submit" size="sm">Add</Button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-subtle">Cancel</button>
    </ShapeForm>
  );
}

/** "+ Add team" → name. Gets its own join code. */
export function AddTeam({ orgId, groupId }: { orgId: number; groupId: number | null }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className={quiet}>+ Add team</button>;
  }
  return (
    <ShapeForm action={addTeam} orgId={orgId} hidden={groupId == null ? {} : { groupId }} onOk={() => setOpen(false)}>
      <input name="name" placeholder="Team name" aria-label="Team name" autoFocus className={inline} />
      <Button type="submit" size="sm">Add</Button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-subtle">Cancel</button>
    </ShapeForm>
  );
}

/** Edit a group: name + kind, where it sits, its group admin (org-wide
 * shapers only), delete when empty. */
export function GroupEditor({
  orgId,
  group,
  kinds,
  moveTargets,
  empty,
  adminCandidates,
}: {
  orgId: number;
  group: { id: number; name: string; kind: GroupKind; parentId: number | null };
  kinds: Option[];
  moveTargets: Option[];
  empty: boolean;
  adminCandidates?: Option[];
}) {
  return (
    // Sits in the group's header line; opened, it drops to its own full line.
    <details className="open:order-last open:basis-full">
      <summary className={`${quiet} cursor-pointer list-none`}>Edit</summary>
      <div className="mt-2 flex flex-col gap-3 rounded-lg border border-line bg-sunken p-3">
        <ShapeForm action={editGroup} orgId={orgId} hidden={{ groupId: group.id }}>
          <input name="name" defaultValue={group.name} aria-label="Group name" className={inline} />
          <KindSelect kinds={kinds} value={group.kind} />
          <Button type="submit" size="sm">Save</Button>
        </ShapeForm>
        {moveTargets.length > 1 && (
          <ShapeForm action={moveGroup} orgId={orgId} hidden={{ groupId: group.id }}>
            <label className="text-xs font-semibold text-muted" htmlFor={`move-g-${group.id}`}>Sits under</label>
            <select id={`move-g-${group.id}`} name="parentId" defaultValue={group.parentId ?? ""} className={inline}>
              {moveTargets.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <Button type="submit" size="sm" variant="secondary">Move</Button>
          </ShapeForm>
        )}
        {adminCandidates && adminCandidates.length > 0 && (
          <ShapeForm action={addGroupAdmin} orgId={orgId} hidden={{ groupId: group.id }}>
            <label className="text-xs font-semibold text-muted" htmlFor={`admin-g-${group.id}`}>Group admin</label>
            <select id={`admin-g-${group.id}`} name="profileId" defaultValue="" className={inline}>
              <option value="" disabled>Pick a coach or staff member</option>
              {adminCandidates.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <Button type="submit" size="sm" variant="secondary">Make group admin</Button>
          </ShapeForm>
        )}
        {empty ? (
          <ShapeForm action={deleteGroup} orgId={orgId} hidden={{ groupId: group.id }}>
            <Button type="submit" size="sm" variant="secondary">Delete this group</Button>
          </ShapeForm>
        ) : (
          <p className="text-xs text-subtle">To delete it, move or delete what&apos;s inside first.</p>
        )}
      </div>
    </details>
  );
}

/** A team's place: which group it sits in. */
/** A team's place: "Move" opens a picker of the groups in reach. */
export function TeamMover({ orgId, teamId, current, targets }: { orgId: number; teamId: number; current: number | null; targets: Option[] }) {
  return (
    <details className="open:basis-full">
      <summary className={`${quiet} cursor-pointer list-none`}>Move</summary>
      <ShapeForm action={moveTeam} orgId={orgId} hidden={{ teamId }} className="mt-2 flex flex-wrap items-center gap-2">
        <select name="groupId" defaultValue={current ?? ""} aria-label="Move team to" className={inline}>
          {targets.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="secondary">Move here</Button>
      </ShapeForm>
    </details>
  );
}

export function GroupAdminRemove({ orgId, grantId, name }: { orgId: number; grantId: number; name: string }) {
  return (
    <ShapeForm action={removeGroupAdmin} orgId={orgId} hidden={{ grantId }} className="inline-flex">
      <button type="submit" aria-label={`Remove ${name} as group admin`} className="ml-1 text-xs font-bold text-on-accent">
        ×
      </button>
    </ShapeForm>
  );
}

const SHAPES = [
  { key: "club", label: "Club", sub: "Boys / Girls → age groups" },
  { key: "school", label: "School", sub: "Junior High · High School" },
  { key: "district", label: "District", sub: "Schools → their levels" },
] as const;
const AGES = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

/** Start from a shape — shown only while the org has no groups. */
export function TemplatePicker({ orgId }: { orgId: number }) {
  const [shape, setShape] = useState<(typeof SHAPES)[number]["key"]>("club");
  return (
    <ShapeForm action={applyTemplate} orgId={orgId} className="flex flex-col gap-4">
      <input type="hidden" name="template" value={shape} />
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Shape">
        {SHAPES.map((s) => (
          <button key={s.key} type="button" role="radio" aria-checked={shape === s.key} onClick={() => setShape(s.key)} className={pillClass(shape === s.key, "sm")}>
            {s.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-subtle">{SHAPES.find((s) => s.key === shape)!.sub}</p>

      {shape === "club" && (
        <>
          <div className="flex gap-4">
            {(["Boys", "Girls"] as const).map((g) => (
              <label key={g} className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name={g} defaultChecked className={checkClass} /> {g}
              </label>
            ))}
          </div>
          <div>
            <p className={labelClass}>Age groups</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {AGES.map((a) => (
                <label key={a} className="flex items-center gap-1.5 text-sm text-ink">
                  <input type="checkbox" name="age" value={a} defaultChecked={a >= 12} className={checkClass} /> {a}U
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {shape === "district" && (
        <div>
          <label htmlFor="schools" className={labelClass}>Schools, one per line</label>
          <textarea id="schools" name="schools" rows={3} placeholder={"Lincoln High\nLincoln Middle"} className={`${fieldBase} w-full px-3 py-2 text-sm`} />
        </div>
      )}

      {(shape === "school" || shape === "district") && (
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="juniorHigh" defaultChecked className={checkClass} /> Junior High (7th, 8th)
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="highSchool" defaultChecked className={checkClass} /> High School (Freshman, JV, Varsity)
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="splitGenders" className={checkClass} /> Separate Boys and Girls
          </label>
        </div>
      )}

      <Button type="submit" className="self-start">Create these groups</Button>
    </ShapeForm>
  );
}
