import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listTeamMessages } from "@/lib/board";
import { formatDateTime } from "@/lib/format";
import { deleteMessage } from "./actions";
import { MessageComposer } from "./MessageComposer";
import { MessageReactions } from "./MessageReactions";
import { QuotedMessage } from "./QuotedMessage";
import { ReplyProvider } from "./ReplyProvider";
import { getGif } from "@/lib/gifs";

// The team's message board — a Messenger-style chat. Team-private: only the
// current user's own team is queried and posted to (CLAUDE.md section 3.2).
// Anyone on the team can post/react/reply; the coach can delete any message.
// Every message renders as a plain bubble (the DB `type` is kept but no longer
// tinted). "Me" is the code's existing check: message.author.id === user.id.
//
// The CURRENT user speaks in a clean white bubble (right); everyone else speaks
// in the red ".e24-bubble" material (left) with an initials avatar + name.
// Consecutive messages from one author are grouped. A reply carries the quoted
// original, rendered dimmed behind the reply bubble.

// First two initials of a name (mirrors IdentityChip's placeholder avatar).
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// A short preview of a message for reply quotes / the compose bar.
function snippetOf(body: string, gifId: string | null): string {
  const t = body.trim();
  if (t) return t.length > 60 ? `${t.slice(0, 60)}…` : t;
  if (gifId) return "GIF";
  return "Message";
}

// Muted, neutral section kicker — quieter than the red .e24-eyebrow so the
// bubbles carry the color.
const kicker =
  "text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500";

export default async function BoardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const messages = await listTeamMessages(user.teamId);
  const logoUrl = user.team.logoUrl;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={kicker}>Team Circle</p>
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

      <ReplyProvider>
        {messages.length === 0 ? (
          <section className="e24-surface rounded-2xl border border-red-600/25 p-6">
            <div className="relative z-10">
              <p className={kicker}>Team Circle</p>
              <p className="mt-2 text-sm text-zinc-400">
                No messages yet. Start the conversation below.
              </p>
            </div>
          </section>
        ) : (
          <ol className="flex flex-col">
            {messages.map((message, i) => {
              const isMine = message.author.id === user.id;
              const canDelete = user.role === "COACH" || isMine;
              const isCoachAuthor = message.author.role === "COACH";

              // Group consecutive messages from the same author.
              const prevSame =
                i > 0 && messages[i - 1].author.id === message.author.id;
              const nextSame =
                i < messages.length - 1 &&
                messages[i + 1].author.id === message.author.id;
              const isFirstOfGroup = !prevSame;
              const isLastOfGroup = !nextSame;

              // Per-type counts + this user's own pick (one per message).
              const counts: Record<string, number> = {};
              for (const r of message.reactions) {
                counts[r.reactionType] = (counts[r.reactionType] ?? 0) + 1;
              }
              const myType =
                message.reactions.find((r) => r.userId === user.id)
                  ?.reactionType ?? null;

              const gif = getGif(message.gifId);

              // The quoted parent (if this message is a reply).
              const parent = message.replyTo;
              const parentSnippet = parent
                ? parent.deletedAt
                  ? "Original message removed"
                  : snippetOf(parent.body, parent.gifId)
                : "";

              return (
                <li
                  key={message.id}
                  id={`msg-${message.id}`}
                  className={`flex scroll-mt-24 flex-col ${
                    isMine ? "items-end" : "items-start"
                  } ${i === 0 ? "" : prevSame ? "mt-0.5" : "mt-4"}`}
                >
                  <div
                    className={`flex max-w-[85%] gap-2 ${
                      isMine ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {/* avatar column — OTHERS only, once per group */}
                    {!isMine &&
                      (isFirstOfGroup ? (
                        <span
                          className="mt-6 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-700 to-red-950 text-[11px] font-bold text-white ring-1 ring-red-500/40"
                          aria-hidden
                        >
                          {initials(message.author.name)}
                        </span>
                      ) : (
                        <span className="w-8 shrink-0" aria-hidden />
                      ))}

                    <div
                      className={`flex min-w-0 flex-col ${
                        isMine ? "items-end" : "items-start"
                      }`}
                    >
                      {/* name + coach tag — OTHERS, once per group */}
                      {!isMine && isFirstOfGroup && (
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

                      {/* quoted parent — dimmed BEHIND the reply; click to jump */}
                      {parent && (
                        <QuotedMessage
                          parentId={parent.id}
                          authorName={parent.author.name}
                          snippet={parentSnippet}
                          align={isMine ? "right" : "left"}
                          removed={!!parent.deletedAt}
                        />
                      )}

                      {/* bubble — wrapped by MessageReactions, which renders the
                          corner badge + the hover/long-press picker + Reply */}
                      <MessageReactions
                        messageId={message.id}
                        counts={counts}
                        myType={myType}
                        authorName={message.author.name}
                        snippet={snippetOf(message.body, message.gifId)}
                        time={formatDateTime(message.createdAt)}
                      >
                        <div
                          data-msg-bubble
                          className={`relative z-10 rounded-2xl px-3.5 py-2.5 ${
                            isMine
                              ? `bg-white text-zinc-900 shadow-[0_4px_14px_-6px_rgba(0,0,0,0.5)] ${
                                  isLastOfGroup ? "rounded-br-md" : ""
                                }`
                              : `e24-bubble text-white ${
                                  isLastOfGroup ? "rounded-bl-md" : ""
                                }`
                          }`}
                        >
                          <div className="relative z-10">
                            {message.body.trim() !== "" && (
                              <p
                                className={`whitespace-pre-wrap text-sm ${
                                  isMine ? "text-zinc-900" : "text-white"
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
                                className={`mt-2 max-h-48 rounded-lg border ${
                                  isMine ? "border-black/10" : "border-black/30"
                                }`}
                              />
                            )}
                          </div>
                        </div>
                      </MessageReactions>

                      {/* delete (muted) — coach any / author own */}
                      {canDelete && (
                        <form
                          action={deleteMessage}
                          className={`mt-1 px-1 ${
                            isMine ? "self-end" : "self-start"
                          }`}
                        >
                          <input
                            type="hidden"
                            name="messageId"
                            value={message.id}
                          />
                          <button
                            type="submit"
                            className="text-[10px] text-zinc-600 transition hover:text-red-500 hover:underline"
                          >
                            Delete
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <MessageComposer />
      </ReplyProvider>
    </main>
  );
}
