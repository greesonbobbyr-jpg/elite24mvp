import { redirect } from "next/navigation";
import { actingScope, actingTeamId, getCurrentContext } from "@/lib/context";
import { isStaffSide, personaOf } from "@/lib/persona";
import { can } from "@/lib/authz";
import { listPlayerNotifications, getTeamReadStatus } from "@/lib/notifications";
import { formatDate, formatDateTime } from "@/lib/format";
import { NotificationComposer } from "./NotificationComposer";
import { PushToggle } from "./PushToggle";
import { WhistleIcon } from "@/app/components/WhistleIcon";
import { TimeoutBadge, UnreadAlerts } from "./UnreadAlerts";
import { GotIt } from "./GotIt";
import { inboxFor, type InboxItem } from "@/lib/announcements";
import { announcementView } from "@/lib/announcement-view";
import { AnnouncementCard } from "@/app/components/AnnouncementCard";

// Notifications history/list. STRICTLY the current user's own team — the player
// reads their team's notifications, the coach posts to + sees receipts for their
// own team (server-enforced in the queries + actions). Styling/display only: the
// create/acknowledge actions, read-receipt data, team-scoping, and the separate
// TimeoutTakeover are all unchanged.

// First two initials of a name (mirrors IdentityChip's placeholder avatar).
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function NotificationsPage() {
  const ctx = await getCurrentContext();
  const user = ctx?.user;
  if (!ctx || !user) redirect("/");
  // Announcements (Elite24 and the organization) are for everyone; coach
  // alerts need a team. The ACTING team throughout — the same one the TIME
  // OUT takeover and the menu badge use.
  const announcements = await inboxFor(ctx);
  const teamId = actingTeamId(ctx);
  if (teamId == null) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
        <header>
          <p className="e24-eyebrow">Notifications</p>
          <p className="mt-1 text-sm text-subtle">Announcements from Elite24 and your organization</p>
        </header>
        {announcements.length === 0 ? (
          <EmptyCard line="Nothing right now. Announcements show up here." />
        ) : (
          <Announcements items={announcements} />
        )}
      </main>
    );
  }
  const staff = isStaffSide(personaOf(ctx));

  // ----- Staff: compose + per-message read receipts for their own team -----
  if (staff) {
    const items = await getTeamReadStatus(teamId);
    // The TIME OUT toggle is hidden from staff without send_timeout (the
    // server also enforces it; matrix: HEAD_COACH / ORG_ADMIN only).
    const scope = actingScope(ctx);
    const canSendTimeout = scope != null && can(ctx, "send_timeout", scope);
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
        <header>
          <p className="e24-eyebrow">Notifications</p>
          <p className="mt-1 text-sm text-subtle">
            Post to your team · read receipts
          </p>
        </header>

        <Announcements items={announcements} />

        <NotificationComposer canSendTimeout={canSendTimeout} />

        {items.length === 0 ? (
          <EmptyCard line="No notifications yet. Post one above." />
        ) : (
          <ol className="flex flex-col gap-4">
            {items.map((n) => (
              <li
                key={n.id}
                className={`e24-surface rounded-2xl p-5 ${
                  n.isTimeout ? "border-2 border-accent-edge" : ""
                }`}
              >
                <div className="relative z-10">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-bold text-ink">
                      {n.isTimeout && <TimeoutBadge />}
                      {n.title}
                    </h2>
                    <span className="shrink-0 text-xs text-subtle">
                      {formatDate(n.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-mid">
                    {n.body}
                  </p>

                  {/* Per-message read receipt */}
                  <div className="mt-4 border-t border-line pt-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="e24-eyebrow">
                        Read by {n.readCount} of {n.totalPlayers}
                      </p>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-raised-2">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{
                          width: `${
                            n.totalPlayers
                              ? (n.readCount / n.totalPlayers) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <ReceiptGroup label="Read" names={n.read} tone="read" />
                      <ReceiptGroup
                        label="Waiting"
                        names={n.notYet}
                        tone="waiting"
                      />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </main>
    );
  }

  // ----- Player: read team notifications + acknowledge -----
  // Acting team + alerts since joining it — the same set the TIME OUT
  // takeover and the menu badge use. Prominent unread cards up top (ALL of
  // them, so the badge can always be cleared), dimmed read rows under "EARLIER".
  const { unread, read } = await listPlayerNotifications(
    user.id,
    teamId,
    ctx.membership?.startedAt ?? null,
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <header>
        <p className="e24-eyebrow">Notifications</p>
        <p className="mt-1 text-sm text-subtle">Messages from your coach</p>
      </header>

      {/* Web Push opt-in — permission prompt only fires on the player's tap. */}
      <PushToggle />

      <Announcements items={announcements} />

      {unread.length + read.length === 0 ? (
        <EmptyCard line="No notifications from your coach yet." />
      ) : (
        <>
          {/* Always mounted, so its "marked as read" message survives the
              refresh that moves the last unread alert to "Earlier". */}
          <UnreadAlerts
            items={unread.map((n) => ({
              id: n.id,
              initials: initials(n.authorName),
              authorName: n.authorName,
              authorRoleLabel: n.authorRoleLabel,
              when: formatDateTime(n.createdAt),
              title: n.title,
              body: n.body,
              isTimeout: n.isTimeout,
            }))}
          />

          {read.length > 0 && (
            <section>
              <p className="e24-eyebrow mb-2">Earlier</p>
              <ul className="flex flex-col gap-1.5">
                {read.map((n) => (
                  <li
                    key={n.id}
                    className="flex items-center gap-2.5 rounded-xl border border-line bg-panel px-3 py-2.5 shadow-sm shadow-shade"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-good-solid text-[11px] font-bold text-on-accent">
                      ✓
                    </span>
                    {n.isTimeout && (
                      <WhistleIcon className="h-3.5 w-3.5 shrink-0 text-subtle" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm text-muted">
                      {n.title}
                    </span>
                    <span className="shrink-0 text-[11px] text-subtle">
                      {formatDate(n.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}

// Announcements from Elite24 and the organization, above the coach's
// alerts: new ones first, each with "Got it".
function Announcements({ items }: { items: InboxItem[] }) {
  if (items.length === 0) return null;
  const now = new Date();
  const fresh = items.filter((a) => a.countsUnread);
  const rest = items.filter((a) => !a.countsUnread);
  return (
    <section className="flex flex-col gap-3" aria-label="Announcements">
      <h2 className="e24-eyebrow">{fresh.length > 0 ? `Announcements · ${fresh.length} new` : "Announcements"}</h2>
      {[...fresh, ...rest].map((a) => (
        <AnnouncementCard
          key={a.id}
          a={announcementView(a, a.countsUnread, now)}
          action={a.countsUnread ? <GotIt id={a.id} /> : undefined}
        />
      ))}
    </section>
  );
}

// A material empty-state card.
function EmptyCard({ line }: { line: string }) {
  return (
    <section className="e24-surface rounded-2xl p-6">
      <div className="relative z-10">
        <p className="e24-eyebrow">Notifications</p>
        <p className="mt-2 text-sm text-muted">{line}</p>
      </div>
    </section>
  );
}

// A coach read-receipt group: a labelled row of initials chips (placeholders).
function ReceiptGroup({
  label,
  names,
  tone,
}: {
  label: string;
  names: string[];
  tone: "read" | "waiting";
}) {
  const chip =
    tone === "read"
      ? "bg-good-solid text-on-accent"
      : "bg-panel text-muted ring-1 ring-line-strong";
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-subtle">
        {label}
      </p>
      {names.length === 0 ? (
        <p className="mt-1 text-xs text-subtle">
          {tone === "read" ? "—" : "All caught up"}
        </p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {names.map((name) => (
            <span
              key={name}
              title={name}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${chip}`}
            >
              {initials(name)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
