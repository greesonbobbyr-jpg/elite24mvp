import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import {
  listTeamMessages,
  BOARD_PAGE_SIZE,
  BOARD_MAX_LIMIT,
} from "@/lib/board";
import { formatDateTime } from "@/lib/format";
import { deleteMessage } from "./actions";
import { MessageComposer } from "./MessageComposer";
import { MessageReactions } from "./MessageReactions";
import { QuotedMessage } from "./QuotedMessage";
import { ReplyProvider } from "./ReplyProvider";
import { BoardScroller } from "./BoardScroller";
import { getGif } from "@/lib/gifs";
import { PlayerCard } from "@/app/components/PlayerCard";
import { photoSrc } from "@/lib/photoUrl";

// The team's message board — a Messenger-style chat. Team-private: only the
// current user's own team is queried and posted to (CLAUDE.md section 3.2).
// Anyone on the team can post/react/reply; the coach can delete any message.
// Every message renders as a plain bubble (the DB `type` is kept but no longer
// tinted). "Me" is the code's existing check: message.author.id === user.id.
//
// The CURRENT user speaks in a clean white bubble (right); everyone else speaks
// in the red ".e24-bubble" material (left) with their team avatar card + name.
// Consecutive messages from one author are grouped. A reply carries the quoted
// original, rendered dimmed behind the reply bubble.

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

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ spotlight?: string; days?: string; limit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  // Coach arriving from a "Give a shoutout →" streak-milestone link: prefill a
  // SPOTLIGHT draft (fully editable — the coach writes/sends, never the app).
  const { spotlight, days, limit: limitParam } = await searchParams;
  const spotlightDraft =
    user.role === "COACH" && spotlight
      ? `Coach's Spotlight: ${spotlight} is on a ${Number.parseInt(days ?? "", 10) || "hot"}-day check-in streak 🔥 That's how pros are built. Keep leading.`
      : null;

  // Newest N messages; "Show earlier" steps the cap (server-first pagination).
  const limit = Math.min(
    Number.parseInt(limitParam ?? "", 10) || BOARD_PAGE_SIZE,
    BOARD_MAX_LIMIT,
  );
  const messages = await listTeamMessages(user.teamId, limit);
  const hasEarlier = messages.length >= limit && limit < BOARD_MAX_LIMIT;
  const logoUrl = user.team.logoUrl;
  const latestId = messages.length ? messages[messages.length - 1].id : 0;

  return (
    // Fixed chat shell: spans from under the app header to above the tab bar, so
    // only the message list scrolls — the header + composer stay put. The offsets
    // are tuned to the current app-header (~64px) and player/coach tab-bar
    // heights; z-0 keeps it under the tab bar (z-40) and TIME OUT takeover (z-50).
    <main className="fixed inset-x-0 top-[69px] bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-0 flex justify-center">
      <ReplyProvider>
        <div className="flex h-full w-full max-w-2xl flex-col">
          {/* TOP — fixed board header */}
          <header className="flex shrink-0 items-start justify-between gap-4 px-6 pb-2 pt-4">
            <div className="min-w-0">
              <p className={kicker}>Team Circle</p>
              <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-white">
                {user.team.name}
              </h1>
            </div>
            {logoUrl ? (
              // Plain <img>: team-controlled arbitrary URL (avoid next/image
              // domain allowlist). No logo → render nothing.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={`${user.team.name} logo`}
                className="h-14 w-14 shrink-0 object-contain"
              />
            ) : null}
          </header>

          {/* MIDDLE — the ONLY scrolling region */}
          <BoardScroller
            latestId={latestId}
            className="min-h-0 flex-1 overflow-y-auto px-6 pb-2"
          >
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
              <>
              {hasEarlier && (
                <div className="pb-2 text-center">
                  <Link
                    href={`/board?limit=${limit + BOARD_PAGE_SIZE}`}
                    className="inline-block rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold text-zinc-400 transition hover:border-white/30 hover:text-zinc-200"
                  >
                    Show earlier messages
                  </Link>
                </div>
              )}
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
                        <div className="mt-6 shrink-0" aria-hidden>
                          <PlayerCard
                            size="avatar"
                            player={{
                              name: message.author.name,
                              photoUrl: photoSrc(
                                message.author.id,
                                message.author.profile?.photoUrl,
                              ),
                              points: 0,
                            }}
                            team={user.team}
                          />
                        </div>
                      ) : (
                        <span className="w-10 shrink-0" aria-hidden />
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
              </>
            )}
          </BoardScroller>

          {/* BOTTOM — pinned composer (always visible) */}
          <div className="shrink-0 border-t border-red-600/20 bg-black/40 px-6 py-3">
            <MessageComposer
              initialBody={spotlightDraft ?? undefined}
              initialType={spotlightDraft ? "SPOTLIGHT" : undefined}
            />
          </div>
        </div>
      </ReplyProvider>
    </main>
  );
}
