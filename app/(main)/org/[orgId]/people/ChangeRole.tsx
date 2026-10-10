"use client";

import { useActionState, useState } from "react";
import { changeMemberRole, type RoleState } from "./actions";
import { Button } from "@/app/components/ui/Button";
import { checkClass, fieldBase, labelClass } from "@/app/components/ui/Field";

const ROLE_LABEL = {
  PLAYER: "Player",
  HEAD_COACH: "Head Coach",
  ASSISTANT_COACH: "Assistant Coach",
  GENERAL_MANAGER: "General Manager",
} as const;
type Role = keyof typeof ROLE_LABEL;

const field = `${fieldBase} w-full min-w-0 px-2.5 py-1.5 text-sm`;

/** "Change role" for one person, on the teams the viewer may change. */
export function ChangeRole({
  orgId,
  firstName,
  memberships,
}: {
  orgId: number;
  firstName: string;
  memberships: { id: number; team: string; role: Role }[];
}) {
  const [state, action, pending] = useActionState<RoleState, FormData>(changeMemberRole, {});
  const [mid, setMid] = useState(memberships[0].id);
  const current = memberships.find((m) => m.id === mid)!;
  const [role, setRole] = useState<Role>(current.role);
  const promoting = current.role === "PLAYER" && role !== "PLAYER";

  return (
    <details className="mt-2">
      <summary className="cursor-pointer list-none text-xs font-semibold text-brand">Change role</summary>
      <form action={action} className="mt-2 flex flex-col gap-2 rounded-lg border border-line bg-sunken p-3">
        <input type="hidden" name="orgId" value={orgId} />
        {memberships.length > 1 ? (
          <div>
            <label className={labelClass} htmlFor={`cr-team-${mid}`}>Team</label>
            <select
              id={`cr-team-${mid}`}
              name="membershipId"
              value={mid}
              onChange={(e) => {
                const next = memberships.find((m) => m.id === Number(e.target.value))!;
                setMid(next.id);
                setRole(next.role);
              }}
              className={field}
            >
              {memberships.map((m) => (
                <option key={m.id} value={m.id}>{m.team}</option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="membershipId" value={mid} />
        )}
        <div>
          <label className={labelClass} htmlFor={`cr-role-${mid}`}>New role on {current.team}</label>
          <select id={`cr-role-${mid}`} name="role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={field}>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
        </div>
        {promoting && (
          <label className="flex items-start gap-2 text-sm text-ink-mid">
            <input type="checkbox" name="adult" className={`${checkClass} mt-0.5`} />
            <span>
              {`I confirm ${firstName} is an adult (18+). Staff can see players' emergency contacts.`}
            </span>
          </label>
        )}
        {state.error && <p className="text-sm font-semibold text-brand">{state.error}</p>}
        {state.ok && <p className="text-sm font-semibold text-good">Saved ✓</p>}
        <Button type="submit" size="sm" disabled={pending || role === current.role} className="self-start">
          {pending ? "Saving…" : "Save role"}
        </Button>
      </form>
    </details>
  );
}
