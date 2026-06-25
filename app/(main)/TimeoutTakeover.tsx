import { confirmRead } from "./actions";
import { WhistleIcon } from "@/app/components/WhistleIcon";

// Full-screen, unmissable takeover for an unacknowledged TIME OUT. Rendered by
// the (main) layout on EVERY route for a player with an active TIME OUT, so it
// appears on any page and immediately on load/login. Server-rendered (the only
// exit is the acknowledge form, which reuses confirmRead) — no client JS, so it
// is present on first paint with no flash of usable app. The fixed backdrop dims
// and blurs the app behind it and intercepts all interaction.
export function TimeoutTakeover({
  notification,
}: {
  notification: { id: number; title: string; body: string; author: { name: string } };
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm">
      <div className="w-[70%] max-w-lg rounded-2xl border-2 border-red-600 bg-black p-7 text-center shadow-2xl shadow-red-900/40">
        <p className="flex items-center justify-center gap-2 text-3xl font-black uppercase tracking-tight text-red-500">
          <WhistleIcon className="h-9 w-9 text-white" />
          Time Out!
        </p>
        <h2 className="mt-4 text-xl font-bold text-white">{notification.title}</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-200">
          {notification.body}
        </p>
        <p className="mt-4 text-xs text-zinc-500">From {notification.author.name}</p>

        <form action={confirmRead} className="mt-6">
          <input type="hidden" name="notificationId" value={notification.id} />
          <button
            type="submit"
            className="w-full rounded-full bg-red-600 px-6 py-3 text-base font-bold text-white hover:bg-red-700"
          >
            Got it — I&apos;ve read this
          </button>
        </form>

        <p className="mt-5 text-[10px] uppercase tracking-wide text-zinc-600">
          Powered by{" "}
          <span className="font-semibold text-red-500">Elite 24 MVP</span>
        </p>
      </div>
    </div>
  );
}
