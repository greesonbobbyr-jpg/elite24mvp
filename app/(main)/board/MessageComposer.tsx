"use client";

import { useActionState, useEffect, useState } from "react";
import { postMessage, type BoardState } from "./actions";
import { GIFS, getGif } from "@/lib/gifs";
import { Button } from "@/app/components/ui/Button";

const initialState: BoardState = {};
const EMOJIS = ["🏀", "🔥", "💪", "🐐", "⛹️", "🏆", "👏", "🎯", "💯", "🙌"];

// Composer for a plain team message (all messages are REGULAR now — the colored
// coach "type" tabs were removed). Keeps the emoji inserter and the curated 🎬
// GIF picker (app-controlled registry only — no search, no upload, no GIPHY).
export function MessageComposer() {
  const [state, formAction, pending] = useActionState(postMessage, initialState);
  const [body, setBody] = useState("");
  const [gifId, setGifId] = useState<string | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);

  // Clear the composer after a successful post.
  useEffect(() => {
    if (state.ok) {
      setBody("");
      setGifId(null);
      setShowGifPicker(false);
    }
  }, [state]);

  const selectedGif = getGif(gifId);

  return (
    <form
      action={formAction}
      className="e24-surface flex flex-col gap-2 rounded-2xl border border-red-600/30 p-4"
    >
      <input type="hidden" name="gifId" value={gifId ?? ""} />

      {/* GIF-only posts are allowed, so the textarea is not `required`; the
          server enforces that a message has text and/or a GIF. */}
      <textarea
        name="body"
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Message your team…"
        className="relative z-10 w-full rounded-lg border border-red-600/25 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-red-500"
      />

      {/* Selected-GIF chip with a remove control. */}
      {selectedGif && (
        <div className="relative z-10 flex items-center gap-2 rounded-lg border border-red-600/25 bg-black/40 p-2">
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

      <div className="relative z-10 flex flex-wrap items-center gap-1">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={`Add ${emoji}`}
            onClick={() => setBody((b) => b + emoji)}
            className="rounded-md px-1.5 py-1 text-lg leading-none hover:bg-white/10"
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowGifPicker((s) => !s)}
          className={`ml-1 rounded-md border px-2 py-1 text-xs font-medium transition active:scale-95 ${
            showGifPicker
              ? "border-red-500 text-red-400"
              : "border-white/15 text-zinc-400 hover:border-white/30"
          }`}
        >
          🎬 GIF
        </button>
      </div>

      {/* Curated GIF picker. Reads only from the app-controlled registry — no
          search, no upload. Empty until GIFs are added to lib/gifs.ts. */}
      {showGifPicker && (
        <div className="relative z-10 rounded-lg border border-red-600/20 bg-black/40 p-3">
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

      {state.error && (
        <p className="relative z-10 text-sm text-red-500">{state.error}</p>
      )}
      <Button type="submit" disabled={pending} className="relative z-10 self-end">
        {pending ? "Posting…" : "Post"}
      </Button>
    </form>
  );
}
