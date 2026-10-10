import { listAudit } from "@/lib/data/ceo";
import { requireCeo } from "../gate";
import { cardDefault } from "@/app/components/ui/Card";

const VERB: Record<string, string> = {
  "ceo.view_org": "Opened organization",
  "ceo.view_team": "Opened team",
  "ceo.view_person": "Opened person",
  "platform.grant": "CEO access granted",
  "ceo.org_code.created": "Made an organization code for",
  "ceo.org_code.revoked": "Cancelled the organization code for",
  "ceo.org.created": "Started an organization:",
  "ceo.invite.created": "Made an invite:",
  "ceo.org.change_role": "Changed a role:",
  "ceo.org.add_group": "Added a group:",
  "ceo.org.edit_group": "Changed a group:",
  "ceo.org.move_group": "Moved a group:",
  "ceo.org.delete_group": "Deleted a group:",
  "ceo.org.add_team": "Added a team:",
  "ceo.org.move_team": "Moved a team:",
  "ceo.org.apply_template": "Started a structure from the shape:",
  "ceo.org.add_group_admin": "Made a group admin:",
  "ceo.org.remove_group_admin": "Removed a group admin:",
  "ceo.announcement.sent": "Sent an announcement:",
  "ceo.announcement.deleted": "Deleted an announcement:",
};

// CEO View · Activity — everything the CEO opened, newest first. The same
// records will show in each organization's own Activity.
export default async function CeoActivityPage() {
  const events = await listAudit(await requireCeo());
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
