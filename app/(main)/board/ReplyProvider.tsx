"use client";

import { createContext, useContext, useState } from "react";

// Which message the composer is currently replying to. `snippet` is a short,
// already-truncated preview (body / "GIF" / "Photo") shown in the compose bar.
export type ReplyTarget = {
  id: number;
  authorName: string;
  snippet: string;
};

type ReplyCtx = {
  replyingTo: ReplyTarget | null;
  setReplyingTo: (t: ReplyTarget) => void;
  clear: () => void;
};

const Ctx = createContext<ReplyCtx | null>(null);

// Shares the "replying to" target between a message's Reply action (in the
// long-press/hover popover) and the composer. Client-only, no data/fetch — the
// actual post is the existing server action with a hidden replyToId.
export function ReplyProvider({ children }: { children: React.ReactNode }) {
  const [replyingTo, setReplying] = useState<ReplyTarget | null>(null);
  return (
    <Ctx.Provider
      value={{
        replyingTo,
        setReplyingTo: setReplying,
        clear: () => setReplying(null),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useReply(): ReplyCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useReply must be used within ReplyProvider");
  return ctx;
}
