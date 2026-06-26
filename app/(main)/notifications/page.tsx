import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import {
  listTeamNotifications,
  getTeamReadStatus,
  getReadNotificationIds,
} from "@/lib/notifications";
import { formatDate } from "@/lib/format";
import { confirmRead } from "../actions";
import { NotificationComposer } from "./NotificationComposer";
import { WhistleIcon } from "@/app/components/WhistleIcon";
import { Button } from "@/app/components/ui/Button";
import { cardDefault } from "@/app/components/ui/Card";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const header = (
    <header className="flex items-center justify-between">
      <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
      <Link href="/" className="text-sm font-medium text-red-500 hover:underline">
        ← Home
      </Link>
    </header>
  );

  // ----- Coach: compose + read-status for their own team -----
  if (user.role === "COACH") {
    const items = await getTeamReadStatus(user.teamId);
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
        {header}
        <NotificationComposer />
        {items.length === 0 ? (
          <p className="text-sm text-zinc-500">No notifications yet. Post one above.</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {items.map((n) => (
              <li key={n.id} className={cardDefault}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-semibold">
                    {n.isTimeout && <TimeoutBadge />}
                    {n.title}
                  </h2>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {formatDate(n.createdAt)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">
                  {n.body}
                </p>
                <div className="mt-3 border-t border-zinc-800 pt-3">
                  <p className="text-xs font-semibold text-red-500">
                    Read by {n.readCount} of {n.totalPlayers}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-zinc-400">Read</p>
                      <p className="text-zinc-500">
                        {n.read.length ? n.read.join(", ") : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-400">Not yet</p>
                      <p className="text-zinc-500">
                        {n.notYet.length ? n.notYet.join(", ") : "—"}
                      </p>
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

  // ----- Player: read team notifications + confirm -----
  const [notifications, readIds] = await Promise.all([
    listTeamNotifications(user.teamId),
    getReadNotificationIds(user.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      {header}
      {notifications.length === 0 ? (
        <p className="text-sm text-zinc-500">No notifications from your coach yet.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {notifications.map((n) => {
            const isRead = readIds.has(n.id);
            return (
              <li key={n.id} className={cardDefault}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-semibold">
                    {n.isTimeout && <TimeoutBadge />}
                    {n.title}
                  </h2>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {formatDate(n.createdAt)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">
                  {n.body}
                </p>
                <p className="mt-2 text-xs text-zinc-500">From {n.author.name}</p>
                <div className="mt-3">
                  {isRead ? (
                    <span className="text-xs font-semibold text-zinc-400">
                      ✓ Read
                    </span>
                  ) : (
                    <form action={confirmRead}>
                      <input type="hidden" name="notificationId" value={n.id} />
                      <Button type="submit" size="sm">
                        I&apos;ve read this
                      </Button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </main>
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
