"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { postMessage, type BoardState } from "./actions";
import { useReply } from "./ReplyProvider";
import { TRAY_EMOJIS } from "./reactions";
import { GIFS, getGif } from "@/lib/gifs";

const initialState: BoardState = {};

// A slender, single-row Messenger-style composer: left icon buttons (emoji tray
// toggle, curated GIF picker toggle, a DISABLED photo placeholder), a growing
// single-line input, and a compact send icon on the right. Popovers (emoji tray,
// GIF picker, selected-GIF chip, error) sit above the bar. All behavior is
// unchanged — curated GIFs only (no GIPHY, no upload), server-validated post.
// `initialBody`/`initialType` prefill a draft (e.g. the coach's streak-shoutout
// link) — always editable before sending; the server re-enforces that special
// types are coach-only.
export function MessageComposer({
  initialBody,
  initialType,
}: {
  initialBody?: string;
  initialType?: "DISCUSSION" | "CHALLENGE" | "SPOTLIGHT";
} = {}) {
  const [state, formAction, pending] = useActionState(postMessage, initialState);
  const [body, setBody] = useState(initialBody ?? "");
  const [gifId, setGifId] = useState<string | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const { replyingTo, clear } = useReply();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Clear the composer (and any reply target) after a successful post.
  useEffect(() => {
    if (state.ok) {
      setBody("");
      setGifId(null);
      setShowGifPicker(false);
      setShowEmoji(false);
      clear();
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Starting a reply (from a message far up the thread) brings the composer into
  // view and focuses it, so you never have to scroll back down to type. Scroll
  // the whole page to the very bottom — the composer is the last element and the
  // body reserves pb-16 for the tab bar, so this lands it fully in view. rAF lets
  // the reply-preview bar expand first so the measured height is correct.
  useEffect(() => {
    if (!replyingTo) return;
    inputRef.current?.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth",
      });
    });
  }, [replyingTo]);

  const selectedGif = getGif(gifId);
  const iconBtn =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition active:scale-95";

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="gifId" value={gifId ?? ""} />
      <input type="hidden" name="replyToId" value={replyingTo?.id ?? ""} />
      {initialType && <input type="hidden" name="type" value={initialType} />}
      {initialType === "SPOTLIGHT" && (
        <p className="rounded-full bg-red-500/15 px-3 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-red-400">
          Coach&apos;s Spotlight draft — edit it, then send
        </p>
      )}

      {/* Reply preview — who/what you're replying to, with a cancel. */}
      {replyingTo && (
        <div className="e24-reveal flex items-center gap-2 rounded-lg border-l-2 border-red-500 bg-black/40 py-1.5 pl-2 pr-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-red-400">
              Replying to {replyingTo.authorName}
            </p>
            <p className="truncate text-xs text-zinc-400">{replyingTo.snippet}</p>
          </div>
          <button
            type="button"
            onClick={clear}
            aria-label="Cancel reply"
            className="shrink-0 text-zinc-500 hover:text-red-500"
          >
            ✕
          </button>
        </div>
      )}

      {/* Selected-GIF chip (above the bar). */}
      {selectedGif && (
        <div className="flex items-center gap-2 rounded-lg border border-red-600/25 bg-black/40 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedGif.file}
            alt={selectedGif.label}
            className="h-12 w-12 rounded object-cover"
          />
          <span className="text-xs text-zinc-400">{selectedGif.label}</span>
          <button
            type="button"
            onClick={() => setGifId(null)}
            className="ml-auto text-xs text-zinc-500 hover:text-red-500"
          >
            ✕ remove
          </button>
        </div>
      )}

      {/* Emoji tray — revealed only after tapping 😊. */}
      {showEmoji && (
        <div className="e24-reveal flex flex-wrap items-center gap-1 rounded-lg border border-red-600/20 bg-black/40 p-2">
          {TRAY_EMOJIS.map((e) => (
            <button
              key={e.char}
              type="button"
              aria-label={`Add ${e.char}`}
              onClick={() => setBody((b) => b + e.char)}
              className="rounded-md p-1 leading-none hover:bg-white/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={e.svg} alt={e.char} className="h-6 w-6" />
            </button>
          ))}
        </div>
      )}

      {/* Curated GIF picker (above the bar) — registry only, no search/upload. */}
      {showGifPicker && (
        <div className="e24-reveal rounded-lg border border-red-600/20 bg-black/40 p-3">
          {GIFS.length === 0 ? (
            <p className="text-xs text-zinc-500">No GIFs available yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {GIFS.map((gif) => {
                const active = gif.id === gifId;
                return (
                  <button
                    key={gif.id}
                    type="button"
                    onClick={() => setGifId(active ? null : gif.id)}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 ${
                      active
                        ? "border-red-500 bg-red-600/10"
                        : "border-white/15 hover:border-white/30"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={gif.file}
                      alt={gif.label}
                      className="h-16 w-full rounded object-cover"
                    />
                    <span className="w-full truncate text-center text-[10px] text-zinc-400">
                      {gif.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {state.error && <p className="text-sm text-red-500">{state.error}</p>}

      {/* The slender bar */}
      <div className="flex items-end gap-1 rounded-2xl border border-red-600/25 bg-black/40 px-2 py-1.5">
        {/* emoji toggle */}
        <button
          type="button"
          aria-label="Emoji"
          aria-expanded={showEmoji}
          onClick={() => setShowEmoji((s) => !s)}
          className={`${iconBtn} text-base leading-none ${
            showEmoji
              ? "border-red-500 text-red-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          😊
        </button>

        {/* GIF toggle */}
        <button
          type="button"
          aria-label="GIF"
          aria-expanded={showGifPicker}
          onClick={() => setShowGifPicker((s) => !s)}
          className={`${iconBtn} text-[10px] font-bold ${
            showGifPicker
              ? "border-red-500 text-red-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          GIF
        </button>

        {/* photo — disabled placeholder for the future child-safety-gated feature */}
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Photo — coming soon"
          className={`${iconBtn} cursor-not-allowed border-transparent text-zinc-600 opacity-60`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
            <path d="M4,4H7L9,2H15L17,4H20A2,2 0 0,1 22,6V18A2,2 0 0,1 20,20H4A2,2 0 0,1 2,18V6A2,2 0 0,1 4,4M12,7A5,5 0 0,0 7,12A5,5 0 0,0 12,17A5,5 0 0,0 17,12A5,5 0 0,0 12,7M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9Z" />
          </svg>
        </button>

        {/* growing single-line input */}
        <textarea
          ref={inputRef}
          name="body"
          rows={1}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message your team…"
          className="max-h-32 min-w-0 flex-1 resize-none self-center bg-transparent px-2 py-1.5 text-sm text-white placeholder:text-zinc-500 outline-none [field-sizing:content]"
        />

        {/* compact send button */}
        <button
          type="submit"
          disabled={pending}
          aria-label="Send"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-sm transition hover:bg-red-500 active:scale-95 disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z" />
          </svg>
        </button>
      </div>
    </form>
  );
}
