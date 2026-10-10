"use client";

import Link from "next/link";
import { useActionState, useCallback, useMemo, useState } from "react";
import { startOrganization, type OrgState } from "@/app/welcome/actions";
import { InviteCard } from "@/app/components/InviteCard";
import { ShapeFields } from "@/app/components/ShapeFields";
import { Button } from "@/app/components/ui/Button";
import { checkClass, fieldClass, labelClass } from "@/app/components/ui/Field";
import { templateGroups, templatePlaces, type TemplateChoice } from "@/lib/structure-templates";

// START AN ORGANIZATION — three short steps: its name, its shape (Boys/Girls
// → ages, a school, a district, or one team), and its first team. Everything
// can be changed later in Organization View. With an org code (from the CEO)
// the creator runs it; the CEO can set one up for someone else and hand them
// an Org Admin invite. The server re-checks every field.

export function OrgWizard({ code, token, ceo }: { code?: string; token?: string; ceo: boolean }) {
  const [state, action, pending] = useActionState<OrgState, FormData>(startOrganization, {});
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [choice, setChoice] = useState<TemplateChoice>({ template: "club", genders: ["Boys", "Girls"], ages: [12, 13, 14, 15, 16, 17] });
  const onShape = useCallback((c: TemplateChoice) => setChoice(c), []);
  const shape = useMemo(() => templateGroups(choice), [choice]);
  const places = shape.ok ? templatePlaces(shape.groups) : [];

  if (state.made) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-ink">Organization created. Send this to whoever will run it:</p>
        <InviteCard {...state.made} />
        <Link href={`/org/${state.orgId}`} className="text-sm font-semibold text-brand">Open its Organization View →</Link>
      </div>
    );
  }

  const steps = ["Name", "Shape", "First team"];
  return (
    <form action={action} className="flex flex-col gap-4">
      {code && <input type="hidden" name="code" value={code} />}
      {token && <input type="hidden" name="token" value={token} />}
      <ol className="flex gap-2 text-[11px] font-bold uppercase tracking-wide">
        {steps.map((s, i) => (
          <li key={s} className={i === step ? "text-brand" : "text-subtle"}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <div hidden={step !== 0} className="flex flex-col gap-3">
        <div>
          <label htmlFor="orgName" className={labelClass}>Organization name</label>
          <input id="orgName" name="orgName" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Westside Hoops Academy" className={fieldClass} />
        </div>
        <Button type="button" className="self-start" disabled={name.trim().length < 2} onClick={() => setStep(1)}>
          Next: its shape
        </Button>
      </div>

      <div hidden={step !== 1} className="flex flex-col gap-3">
        <p className="text-sm text-muted">How your teams are grouped. You can rename, move or add groups any time.</p>
        <ShapeFields initial="club" onChange={onShape} />
        {shape.ok && shape.groups.length > 0 && (
          <p className="text-xs text-subtle">
            {places.length} groups: {places.slice(0, 6).map((p) => p.label).join(", ")}
            {places.length > 6 ? "…" : ""}
          </p>
        )}
        {!shape.ok && <p className="text-xs font-semibold text-brand">{shape.error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => setStep(0)}>Back</Button>
          <Button type="button" disabled={!shape.ok} onClick={() => setStep(2)}>Next: first team</Button>
        </div>
      </div>

      <div hidden={step !== 2} className="flex flex-col gap-3">
        <div>
          <label htmlFor="teamName" className={labelClass}>
            First team {choice.template !== "one-team" && <span className="text-subtle">(optional — add more later)</span>}
          </label>
          <input id="teamName" name="teamName" maxLength={40} placeholder="e.g. 14U Black" className={fieldClass} />
        </div>
        {places.length > 0 && (
          <div>
            <label htmlFor="place" className={labelClass}>It goes in</label>
            <select id="place" name="place" defaultValue={places.at(-1)?.path ?? ""} className={fieldClass}>
              <option value="">The organization (no group)</option>
              {places.map((p) => (
                <option key={p.path} value={p.path}>{p.label}</option>
              ))}
            </select>
          </div>
        )}
        {ceo ? (
          <div>
            <label htmlFor="adminFor" className={labelClass}>
              Who will run it? <span className="text-subtle">(optional — you&apos;ll get an Org Admin invite to send them)</span>
            </label>
            <input id="adminFor" name="adminFor" maxLength={60} placeholder="e.g. Dana Brooks" className={fieldClass} />
          </div>
        ) : (
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="coach" className={checkClass} /> I&apos;ll coach this team (head coach)
          </label>
        )}
        {state.error && <p className="text-sm font-semibold text-brand">{state.error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => setStep(1)}>Back</Button>
          <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create organization"}</Button>
        </div>
      </div>
    </form>
  );
}
