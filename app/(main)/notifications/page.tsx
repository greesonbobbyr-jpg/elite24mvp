import { redirect } from "next/navigation";
import { actingScope, actingTeamId, getCurrentContext } from "@/lib/context";
import { can } from "@/lib/authz";
import { listPlayerNotifications, getTeamReadStatus } from "@/lib/notifications";
import { formatDate, formatDateTime } from "@/lib/format";
import { confirmRead } from "../actions";
import { NotificationComposer } from "./NotificationComposer";
import { PushToggle } from "./PushToggle";
import { WhistleIcon } from "@/app/components/WhistleIcon";
import { Button } from "@/app/components/ui/Button";

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
  // Re-home (4f): no roster spot → no team notifications.
  if (user.role === "PLAYER" && ctx.profile && !ctx.membership) redirect("/");

  // ----- Coach: compose + per-message read receipts for their own team -----
  if (user.role === "COACH") {
    const items = await getTeamReadStatus(actingTeamId(ctx));
    // The TIME OUT toggle is hidden from staff without send_timeout (the
    // server also enforces it; matrix: HEAD_COACH / ORG_ADMIN only).
    const scope = actingScope(ctx);
    const canSendTimeout = scope
      ? can(ctx, "send_timeout", scope)
      : user.role === "COACH";
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
        <header>
          <p className="e24-eyebrow">Notifications</p>
          <p className="mt-1 text-sm text-subtle">
            Post to your team · read receipts
          </p>
        </header>

        <NotificationComposer canSendTimeout={canSendTimeout} />

        {items.length === 0 ? (
          <EmptyCard line="No notifications yet. Post one above." />
        ) : (
          <ol className="flex flex-col gap-4">
            {items.map((n) => (
              <li
                key={n.id}
                className={`e24-surface rounded-2xl border p-5 ${
                  n.isTimeout
                    ? "border-red-500/60 shadow-[0_0_22px_rgba(220,38,38,0.3)]"
                    : "border-red-600/25"
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
                  <div className="mt-4 border-t border-ink/10 pt-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="e24-eyebrow">
                        Read by {n.readCount} of {n.totalPlayers}
                      </p>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400"
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
    actingTeamId(ctx),
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

      {unread.length + read.length === 0 ? (
        <EmptyCard line="No notifications from your coach yet." />
      ) : (
        <>
          {unread.length > 0 && (
            <ol className="flex flex-col gap-4">
              {unread.map((n) => (
                <li
                  key={n.id}
                  className={`e24-surface overflow-hidden rounded-2xl border ${
                    n.isTimeout
                      ? "border-red-500/70 shadow-[0_0_24px_rgba(220,38,38,0.4)]"
                      : "border-red-600/30"
                  }`}
                >
                  {/* red left accent bar */}
                  <div className="flex">
                    <div
                      className={`w-1 shrink-0 ${
                        n.isTimeout ? "bg-red-500" : "bg-red-600"
                      }`}
                    />
                    <div
                      className={`relative z-10 flex-1 p-5 ${
                        n.isTimeout ? "bg-red-600/10" : ""
                      }`}
                    >
                      {/* author identity row — name + role snapshot (4c) */}
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-700 to-red-950 text-xs font-bold text-white ring-2 ring-red-500/60">
                          {initials(n.authorName)}
                        </span>
                        <div className="min-w-0 flex-1 leading-tight">
                          <p className="truncate text-sm font-semibold text-ink">
                            {n.authorName}
                            {n.authorRoleLabel && (
                              <span className="font-normal text-muted">
                                {" "}· {n.authorRoleLabel}
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-subtle">
                            {formatDateTime(n.createdAt)}
                          </p>
                        </div>
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                          aria-label="Unread"
                        />
                      </div>

                      <h2 className="mt-3 font-bold text-ink">
                        {n.isTimeout && <TimeoutBadge />}
                        {n.title}
                      </h2>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">
                        {n.body}
                      </p>

                      {/* Acknowledge — unchanged behavior */}
                      <form action={confirmRead} className="mt-4">
                        <input
                          type="hidden"
                          name="notificationId"
                          value={n.id}
                        />
                        <Button type="submit" size="sm">
                          I&apos;ve read this
                        </Button>
                      </form>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {read.length > 0 && (
            <section>
              <p className="e24-eyebrow mb-2">Earlier</p>
              <ul className="flex flex-col gap-1.5">
                {read.map((n) => (
                  <li
                    key={n.id}
                    className="flex items-center gap-2.5 rounded-xl border border-ink/5 bg-ink/[0.02] px-3 py-2.5"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-600/20 text-[11px] font-bold text-good">
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

// A material empty-state card.
function EmptyCard({ line }: { line: string }) {
  return (
    <section className="e24-surface rounded-2xl border border-red-600/25 p-6">
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
      ? "bg-green-600/15 text-good-2 ring-1 ring-green-500/30"
      : "bg-ink/5 text-muted ring-1 ring-ink/10";
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

// Small red badge marking a notification as an urgent TIME OUT.
function TimeoutBadge() {
  return (
    <span className="mr-2 inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-white">
      <WhistleIcon className="h-3 w-3" />
      Time Out
    </span>
  );
}
