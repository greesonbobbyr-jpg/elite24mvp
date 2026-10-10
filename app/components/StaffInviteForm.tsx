"use client";

import { useActionState, useState } from "react";
import { createStaffInvite, type InviteFormState } from "@/app/(main)/invites/actions";
import { Button } from "@/app/components/ui/Button";
import { fieldClass, labelClass } from "@/app/components/ui/Field";
import { InviteCard } from "./InviteCard";

// INVITE STAFF — pick where (a team, or the whole organization as an org
// admin) and the role; get a code, link and QR to send. The roles offered are
// the ones this person may invite (lib/orgaccess); the server checks again.

type Role = "HEAD_COACH" | "ASSISTANT_COACH" | "GENERAL_MANAGER";
const ROLE_LABEL: Record<Role | "ORG_ADMIN", string> = {
  HEAD_COACH: "Head Coach",
  ASSISTANT_COACH: "Assistant Coach",
  GENERAL_MANAGER: "General Manager",
  ORG_ADMIN: "Org Admin (runs the whole organization)",
};

export function StaffInviteForm({
  orgId,
  teams,
  allowOrgAdmin,
}: {
  orgId: number;
  teams: { id: number; name: string; roles: Role[] }[];
  allowOrgAdmin: boolean;
}) {
  const [state, action, pending] = useActionState<InviteFormState, FormData>(createStaffInvite, {});
  const [where, setWhere] = useState<string>(teams[0] ? String(teams[0].id) : "org");
  const [shown, setShown] = useState(0); // which result is on screen (a new one replaces it)
  const team = teams.find((t) => String(t.id) === where);
  const roles: (Role | "ORG_ADMIN")[] = where === "org" ? ["ORG_ADMIN"] : (team?.roles ?? []);

  if (state.made && shown === 0) {
    return (
      <div className="flex flex-col gap-3">
        <InviteCard {...state.made} />
        <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => setShown(1)}>
          Make another invite
        </Button>
      </div>
    );
  }
  return (
    <form action={(fd) => { setShown(0); return action(fd); }} className="flex flex-col gap-3">
      <input type="hidden" name="orgId" value={orgId} />
      {(teams.length > 1 || allowOrgAdmin) && (
        <div>
          <label className={labelClass} htmlFor="invite-where">Where</label>
          <select id="invite-where" name="teamId" value={where} onChange={(e) => setWhere(e.target.value)} className={fieldClass}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
            {allowOrgAdmin && <option value="org">The whole organization (Org Admin)</option>}
          </select>
        </div>
      )}
      {teams.length === 1 && !allowOrgAdmin && <input type="hidden" name="teamId" value={teams[0].id} />}
      <div>
        <label className={labelClass} htmlFor="invite-role">Role</label>
        <select id="invite-role" name="role" key={where} defaultValue={roles[0]} className={fieldClass}>
          {roles.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor="invite-label">
          Who&apos;s it for? <span className="text-subtle">(only staff see this)</span>
        </label>
        <input id="invite-label" name="label" maxLength={60} placeholder="e.g. Coach Marcus" className={fieldClass} />
      </div>
      <p className="text-xs text-subtle">Coaches and staff must be adults (18+). They&apos;ll confirm it when they accept.</p>
      {state.error && <p className="text-sm font-semibold text-brand">{state.error}</p>}
      <Button type="submit" disabled={pending || roles.length === 0} className="self-start">
        {pending ? "Making it…" : "Make invite"}
      </Button>
    </form>
  );
}
