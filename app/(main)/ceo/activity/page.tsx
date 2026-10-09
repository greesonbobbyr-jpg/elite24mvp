import { getCurrentContext } from "@/lib/context";
import { listAudit } from "@/lib/data/ceo";
import { cardDefault } from "@/app/components/ui/Card";

const VERB: Record<string, string> = {
  "ceo.view_org": "Opened organization",
  "ceo.view_team": "Opened team",
  "ceo.view_person": "Opened person",
  "platform.grant": "CEO access granted",
};

// CEO View · Activity — everything the CEO opened, newest first. The same
// records will show in each organization's own Activity.
export default async function CeoActivityPage() {
  const ctx = await getCurrentContext();
  const events = ctx?.profile ? await listAudit(ctx.profile.id) : [];
  if (events.length === 0) {
    return <p className="px-1 py-4 text-sm text-muted">Nothing yet. What you open in CEO View is listed here.</p>;
  }
  return (
    <ul className={`${cardDefault} flex flex-col divide-y divide-line p-0`}>
      {events.map((e) => (
        <li key={e.id} className="px-4 py-3">
          <p className="text-sm text-ink">
            {VERB[e.action] ?? e.action}
            {e.detail ? <span className="font-semibold"> · {e.detail}</span> : null}
          </p>
          <p className="text-xs text-subtle">
            {e.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
        </li>
      ))}
    </ul>
  );
}
