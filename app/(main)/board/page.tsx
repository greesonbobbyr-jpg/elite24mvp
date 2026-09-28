import { redirect } from "next/navigation";
import Link from "next/link";
import { actingScope, getCurrentContext } from "@/lib/context";
import { can } from "@/lib/authz";
import {
  listTeamMessages,
  BOARD_PAGE_SIZE,
  BOARD_MAX_LIMIT,
} from "@/lib/board";
import { formatDateTime, roleLabel } from "@/lib/format";
import { deleteMessage } from "./actions";
import { MessageComposer } from "./MessageComposer";
import { MessageReactions } from "./MessageReactions";
import { QuotedMessage } from "./QuotedMessage";
import { ReplyProvider } from "./ReplyProvider";
import { BoardScroller } from "./BoardScroller";
import { getGif } from "@/lib/gifs";
import { PlayerCard } from "@/app/components/PlayerCard";
import { cutoutSrc, photoSrc } from "@/lib/photoUrl";
import { StaffCard } from "@/app/components/StaffCard";

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
  "text-xs font-semibold uppercase tracking-[0.15em] text-subtle";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ spotlight?: string; days?: string; limit?: string }>;
}) {
  const ctx = await getCurrentContext();
  const user = ctx?.user;
  if (!ctx || !user) redirect("/");
  // Re-home (4f): a player with no roster spot this season has no team board —
  // Home shows the join card. (Legacy fallback only for pre-backfill logins.)
  if (user.role === "PLAYER" && ctx.profile && !ctx.membership) redirect("/");

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
  // Moderation (delete anyone's message) — the matrix check deleteMessage
  // uses; legacy role check only for pre-backfill logins (dies at Stage 6).
  const scope = actingScope(ctx);
  const mayModerate = scope ? can(ctx, "moderate_board", scope) : user.role === "COACH";
  const logoUrl = user.team.logoUrl;
  const latestId = messages.length ? messages[messages.length - 1].id : 0;

  return (
    // Fixed chat shell: spans from under the app header to above the tab bar, so
    // only the message list scrolls — the header + composer stay put. The offsets
    // are tuned to the current app-header (~64px, plus the status-bar inset it
    // grows by when installed to the home screen — 69px in a browser tab) and
    // player/coach tab-bar heights; z-0 keeps it under the tab bar (z-40) and
    // TIME OUT takeover (z-50).
    <main className="fixed inset-x-0 top-[calc(59px+max(0.625rem,env(safe-area-inset-top)))] bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-0 flex justify-center">
      <ReplyProvider>
        <div className="flex h-full w-full max-w-2xl flex-col">
          {/* TOP — fixed board header */}
          <header className="flex shrink-0 items-start justify-between gap-4 px-6 pb-2 pt-4">
            <div className="min-w-0">
              <p className={kicker}>Team Circle</p>
              <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-ink">
                {user.team.name}
              </h1>
            </div>
            {logoUrl ? (
              // Plain <img>: team-controlled arbitrary URL (avoid next/image
              // domain allowlist). No logo → render nothing. Black tile so
              // logos drawn for the black brand still show in light mode.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={`${user.team.name} logo`}
                className="h-14 w-14 shrink-0 rounded-xl bg-black object-contain p-1"
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
                  <p className="mt-2 text-sm text-muted">
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
                    className="inline-block rounded-full border border-ink/15 px-4 py-1.5 text-xs font-semibold text-muted transition hover:border-ink/30 hover:text-ink-soft"
                  >
                    Show earlier messages
                  </Link>
                </div>
              )}
              <ol className="flex flex-col">
            {messages.map((message, i) => {
              const isMine = message.author.id === user.id;
              // Same rule the server enforces (deleteMessage): your own
              // message, or moderate_board (head coach / org admin — not
              // assistants or GMs, who used to see a Delete that did nothing).
              const canDelete = mayModerate || isMine;
              // Staff badge from the role SNAPSHOT taken at write time
              // ("Head Coach" stays "Head Coach" even after a role change);
              // legacy fallback for unstamped rows.
              const authorBadge =
                roleLabel(message.authorRole) ??
                (message.author.role === "COACH" ? "Coach" : null);
              const authorName = message.authorProfile?.name ?? message.author.name;

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
                          {authorBadge ? (
                            <StaffCard
                              size="avatar"
                              person={{
                                name: authorName,
                                role: authorBadge,
                                photoUrl: photoSrc(message.author.id, message.author.photoUrl ?? message.authorProfile?.photoUrl),
                                cutoutUrl: cutoutSrc(
                                  message.author.id,
                                  message.author.photoCutoutUrl ?? message.authorProfile?.photoCutoutUrl,
                                ),
                                photoMeta: message.author.photoMeta ?? message.authorProfile?.photoMeta,
                              }}
                            />
                          ) : (
                            // The author's mini card: their level, number and cutout.
                            <PlayerCard
                              size="avatar"
                              player={{
                                name: authorName,
                                photoUrl: photoSrc(
                                  message.author.id,
                                  message.authorProfile?.photoUrl ?? message.author.profile?.photoUrl,
                                ),
                                cutoutUrl: cutoutSrc(
                                  message.author.id,
                                  message.authorProfile?.photoCutoutUrl ?? message.author.profile?.photoCutoutUrl,
                                ),
                                photoMeta: message.authorProfile?.photoMeta ?? message.author.profile?.photoMeta,
                                jerseyNumber: message.authorProfile?.jerseyNumber ?? message.author.profile?.jerseyNumber ?? null,
                                points: message.authorProfile?.careerPoints ?? message.author.profile?.points ?? 0,
                              }}
                              team={user.team}
                            />
                          )}
                        </div>
                      ) : (
                        <span className="w-10 shrink-0" aria-hidden />
                      ))}

                    <div
                      className={`flex min-w-0 flex-col ${
                        isMine ? "items-end" : "items-start"
                      }`}
                    >
                      {/* name + staff tag — OTHERS, once per group */}
                      {!isMine && isFirstOfGroup && (
                        <div className="mb-1 flex items-center gap-1.5 px-1">
                          <span className="text-xs font-semibold text-ink-mid">
                            {authorName}
                          </span>
                          {authorBadge && (
                            <span className="rounded bg-red-600/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-2">
                              {authorBadge}
                            </span>
                          )}
                        </div>
                      )}

                      {/* quoted parent — dimmed BEHIND the reply; click to jump */}
                      {parent && (
                        <QuotedMessage
                          parentId={parent.id}
                          authorName={parent.authorProfile?.name ?? parent.author.name}
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
                        authorName={authorName}
                        snippet={snippetOf(message.body, message.gifId)}
                        time={formatDateTime(message.createdAt)}
                      >
                        <div
                          data-msg-bubble
                          className={`relative z-10 rounded-2xl px-3.5 py-2.5 ${
                            isMine
                              ? `bg-bubble-mine text-bubble-mine-ink shadow-[0_4px_14px_-6px_rgba(0,0,0,0.5)] ${
                                  isLastOfGroup ? "rounded-br-md" : ""
                                }`
                              : `e24-bubble text-bubble-ink ${
                                  isLastOfGroup ? "rounded-bl-md" : ""
                                }`
                          }`}
                        >
                          <div className="relative z-10">
                            {message.body.trim() !== "" && (
                              <p
                                className={`whitespace-pre-wrap text-sm ${
                                  isMine ? "text-bubble-mine-ink" : "text-bubble-ink"
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
                            className="text-[10px] text-subtle transition hover:text-brand hover:underline"
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
          <div className="shrink-0 border-t border-red-600/20 bg-field px-6 py-3">
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
