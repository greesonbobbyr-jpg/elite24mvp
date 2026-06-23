import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listTeamMessages } from "@/lib/board";
import { formatDateTime } from "@/lib/format";
import { deleteMessage, toggleReaction, deleteComment } from "./actions";
import { MessageComposer } from "./MessageComposer";
import { CommentForm } from "./CommentForm";
import { TYPE_META, type MessageType } from "./message-types";
import { getGif } from "@/lib/gifs";

// The team's message board. Team-private: only the current user's own team is
// queried and posted to (CLAUDE.md section 3.2). Anyone on the team can post and
// react; the coach can delete any message and use the colored special types.
export default async function BoardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const messages = await listTeamMessages(user.teamId);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Circle</h1>
          <p className="text-sm text-zinc-500">{user.team.name}</p>
        </div>
        <Link href="/" className="text-sm font-medium text-red-500 hover:underline">
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
            const meta = TYPE_META[message.type as MessageType];
            const thumbs = message.reactions.filter(
              (r) => r.reactionType === "THUMBS_UP",
            );
            const hearts = message.reactions.filter(
              (r) => r.reactionType === "HEART",
            );
            const myThumb = thumbs.some((r) => r.userId === user.id);
            const myHeart = hearts.some((r) => r.userId === user.id);

            return (
              <li key={message.id} className={`rounded-xl border p-4 ${meta.card}`}>
                {meta.label && (
                  <span
                    className={`mb-2 inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.badge}`}
                  >
                    {meta.label}
                  </span>
                )}
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
                {message.body.trim() !== "" && (
                  <p className={`mt-1 whitespace-pre-wrap text-sm ${meta.text}`}>
                    {message.body}
                  </p>
                )}
                {(() => {
                  // Only renders a GIF that still exists in the curated registry.
                  const gif = getGif(message.gifId);
                  return gif ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={gif.file}
                      alt={gif.label}
                      className="mt-2 max-h-48 rounded-lg border border-zinc-800"
                    />
                  ) : null;
                })()}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ReactionButton
                    messageId={message.id}
                    reactionType="THUMBS_UP"
                    emoji="👍"
                    count={thumbs.length}
                    active={myThumb}
                  />
                  <ReactionButton
                    messageId={message.id}
                    reactionType="HEART"
                    emoji="❤️"
                    count={hearts.length}
                    active={myHeart}
                  />
                  {canDelete && (
                    <form action={deleteMessage} className="ml-auto">
                      <input type="hidden" name="messageId" value={message.id} />
                      <button
                        type="submit"
                        className="text-xs text-zinc-500 hover:text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    </form>
                  )}
                </div>

                <details className="mt-3 border-t border-zinc-800/70 pt-2">
                  <summary className="cursor-pointer select-none text-xs font-medium text-zinc-400 hover:text-zinc-200">
                    💬{" "}
                    {message.comments.length > 0
                      ? `${message.comments.length} comment${
                          message.comments.length === 1 ? "" : "s"
                        }`
                      : "Add a comment"}
                  </summary>
                  <div className="mt-2 flex flex-col gap-2 border-l-2 border-zinc-800 pl-3">
                    {message.comments.map((comment) => {
                      const canDeleteComment =
                        user.role === "COACH" || comment.author.id === user.id;
                      return (
                        <div key={comment.id}>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs font-semibold text-zinc-300">
                              {comment.author.name}
                              {comment.author.role === "COACH" && (
                                <span className="ml-1 text-[10px] font-medium uppercase text-zinc-500">
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
                                className="text-[10px] text-zinc-500 hover:text-red-500 hover:underline"
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
                </details>
              </li>
            );
          })}
        </ol>
      )}

      <MessageComposer isCoach={user.role === "COACH"} />
    </main>
  );
}

function ReactionButton({
  messageId,
  reactionType,
  emoji,
  count,
  active,
}: {
  messageId: number;
  reactionType: "THUMBS_UP" | "HEART";
  emoji: string;
  count: number;
  active: boolean;
}) {
  return (
    <form action={toggleReaction}>
      <input type="hidden" name="messageId" value={messageId} />
      <input type="hidden" name="reactionType" value={reactionType} />
      <button
        type="submit"
        className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
          active
            ? "border-red-500 bg-red-600/20 text-white"
            : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
        }`}
      >
        <span>{emoji}</span>
        {count > 0 && <span className="tabular-nums">{count}</span>}
      </button>
    </form>
  );
}
