import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listTeamMessages } from "@/lib/board";
import { formatDateTime } from "@/lib/format";
import { deleteMessage, deleteComment } from "./actions";
import { MessageComposer } from "./MessageComposer";
import { CommentForm } from "./CommentForm";
import { CommentsDisclosure } from "./CommentsDisclosure";
import { MessageReactions } from "./MessageReactions";
import { getGif } from "@/lib/gifs";

// The team's message board — a Messenger-style chat. Team-private: only the
// current user's own team is queried and posted to (CLAUDE.md section 3.2).
// Anyone on the team can post/react/comment; the coach can delete any message.
// Every message renders as a plain bubble (the DB `type` is kept but no longer
// tinted). "Me" is the code's existing check: message.author.id === user.id.

// First two initials of a name (mirrors IdentityChip's placeholder avatar).
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function BoardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const messages = await listTeamMessages(user.teamId);
  const logoUrl = user.team.logoUrl;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="e24-eyebrow">Team Circle</p>
          <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-white">
            {user.team.name}
          </h1>
        </div>
        {logoUrl ? (
          // Plain <img>: team-controlled arbitrary URL (avoid next/image domain
          // allowlist). No logo → render nothing.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={`${user.team.name} logo`}
            className="h-14 w-14 shrink-0 object-contain"
          />
        ) : null}
      </header>

      {messages.length === 0 ? (
        <section className="e24-surface rounded-2xl border border-red-600/25 p-6">
          <div className="relative z-10">
            <p className="e24-eyebrow">Team Circle</p>
            <p className="mt-2 text-sm text-zinc-400">
              No messages yet. Start the conversation below.
            </p>
          </div>
        </section>
      ) : (
        <ol className="flex flex-col gap-4">
          {messages.map((message) => {
            const isMine = message.author.id === user.id;
            const canDelete = user.role === "COACH" || isMine;
            const isCoachAuthor = message.author.role === "COACH";

            // Per-type counts + this user's own pick (one per message).
            const counts: Record<string, number> = {};
            for (const r of message.reactions) {
              counts[r.reactionType] = (counts[r.reactionType] ?? 0) + 1;
            }
            const myType =
              message.reactions.find((r) => r.userId === user.id)?.reactionType ??
              null;

            const gif = getGif(message.gifId);

            return (
              <li
                key={message.id}
                className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
              >
                <div
                  className={`flex max-w-[85%] gap-2 ${
                    isMine ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {/* avatar — only for OTHER people's messages */}
                  {!isMine && (
                    <span
                      className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-700 to-red-950 text-[11px] font-bold text-white ring-1 ring-red-500/40"
                      aria-hidden
                    >
                      {initials(message.author.name)}
                    </span>
                  )}

                  <div className={isMine ? "items-end" : "items-start"}>
                    {/* name + coach tag (others only) */}
                    {!isMine && (
                      <div className="mb-1 flex items-center gap-1.5 px-1">
                        <span className="text-xs font-semibold text-zinc-300">
                          {message.author.name}
                        </span>
                        {isCoachAuthor && (
                          <span className="rounded bg-red-600/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-400">
                            Coach
                          </span>
                        )}
                      </div>
                    )}

                    {/* the bubble */}
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 ${
                        isMine
                          ? "rounded-br-md bg-gradient-to-br from-red-600 to-red-700 text-white shadow-[0_4px_14px_-6px_rgba(220,38,38,0.6)]"
                          : "e24-surface rounded-bl-md border border-red-600/20"
                      }`}
                    >
                      <div className="relative z-10">
                        {message.body.trim() !== "" && (
                          <p
                            className={`whitespace-pre-wrap text-sm ${
                              isMine ? "text-white" : "text-zinc-100"
                            }`}
                          >
                            {message.body}
                          </p>
                        )}
                        {gif && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={gif.file}
                            alt={gif.label}
                            className="mt-2 max-h-48 rounded-lg border border-black/30"
                          />
                        )}
                        <p
                          className={`mt-1 text-[10px] ${
                            isMine ? "text-red-100/70" : "text-zinc-500"
                          }`}
                        >
                          {formatDateTime(message.createdAt)}
                        </p>
                      </div>
                    </div>

                    {/* reactions */}
                    <div className="mt-1.5 px-1">
                      <MessageReactions
                        messageId={message.id}
                        counts={counts}
                        myType={myType}
                        align={isMine ? "right" : "left"}
                      />
                    </div>

                    {/* comments + delete */}
                    <div
                      className={`mt-1 flex items-center gap-3 px-1 ${
                        isMine ? "justify-end" : ""
                      }`}
                    >
                      <CommentsDisclosure count={message.comments.length}>
                        <div className="mt-2 flex flex-col gap-2 border-l-2 border-red-600/20 pl-3">
                          {message.comments.map((comment) => {
                            const canDeleteComment =
                              user.role === "COACH" ||
                              comment.author.id === user.id;
                            return (
                              <div key={comment.id}>
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="text-xs font-semibold text-zinc-300">
                                    {comment.author.name}
                                    {comment.author.role === "COACH" && (
                                      <span className="ml-1 text-[10px] font-medium uppercase text-red-400/80">
                                        coach
                                      </span>
                                    )}
                                  </span>
                                  <span className="shrink-0 text-[10px] text-zinc-500">
                                    {formatDateTime(comment.createdAt)}
                                  </span>
                                </div>
                                <p className="whitespace-pre-wrap text-xs text-zinc-300">
                                  {comment.body}
                                </p>
                                {canDeleteComment && (
                                  <form action={deleteComment} className="mt-0.5">
                                    <input
                                      type="hidden"
                                      name="commentId"
                                      value={comment.id}
                                    />
                                    <button
                                      type="submit"
                                      className="text-[10px] text-zinc-500 transition hover:text-red-500 hover:underline"
                                    >
                                      Delete
                                    </button>
                                  </form>
                                )}
                              </div>
                            );
                          })}
                          <CommentForm messageId={message.id} />
                        </div>
                      </CommentsDisclosure>

                      {canDelete && (
                        <form action={deleteMessage}>
                          <input
                            type="hidden"
                            name="messageId"
                            value={message.id}
                          />
                          <button
                            type="submit"
                            className="text-xs text-zinc-600 transition hover:text-red-500 hover:underline"
                          >
                            Delete
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <MessageComposer />
    </main>
  );
}
