import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listTeamMessages } from "@/lib/board";
import { formatDateTime } from "@/lib/format";
import { deleteMessage } from "./actions";
import { MessageComposer } from "./MessageComposer";

// The team's message board. Team-private: only the current user's own team is
// queried and posted to (CLAUDE.md section 3.2). Anyone on the team can post;
// the coach can delete any message, a player only their own.
export default async function BoardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const messages = await listTeamMessages(user.teamId);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team board</h1>
          <p className="text-sm text-zinc-500">{user.team.name}</p>
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-red-500 hover:underline"
        >
          ← Home
        </Link>
      </header>

      {messages.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No messages yet. Start the conversation below.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {messages.map((message) => {
            const isMine = message.author.id === user.id;
            const canDelete = user.role === "COACH" || isMine;
            return (
              <li
                key={message.id}
                className="rounded-xl border border-zinc-800 p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold">
                    {message.author.name}
                    {message.author.role === "COACH" ? (
                      <span className="ml-2 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-300">
                        Coach
                      </span>
                    ) : isMine ? (
                      <span className="ml-2 text-xs font-normal text-zinc-500">
                        you
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {formatDateTime(message.createdAt)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">
                  {message.body}
                </p>
                {canDelete && (
                  <form action={deleteMessage} className="mt-2">
                    <input type="hidden" name="messageId" value={message.id} />
                    <button
                      type="submit"
                      className="text-xs text-zinc-500 hover:text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <MessageComposer />
    </main>
  );
}
