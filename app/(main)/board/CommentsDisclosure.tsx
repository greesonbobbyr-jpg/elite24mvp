"use client";

import { useState } from "react";

// A compact "N replies" toggle that expands to the flat comment thread (passed
// as children — the existing comments list + CommentForm, whose post/soft-delete
// behavior and permissions are unchanged). Expansion uses .e24-reveal, which the
// globals reduced-motion guard neutralizes.
export function CommentsDisclosure({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const label =
    count > 0 ? `${count} ${count === 1 ? "reply" : "replies"}` : "Reply";

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-medium text-zinc-500 transition hover:text-zinc-300"
        aria-expanded={open}
      >
        💬 {label}
      </button>
      {open && <div className="e24-reveal">{children}</div>}
    </div>
  );
}
