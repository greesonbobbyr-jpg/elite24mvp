"use client";

// The quoted parent shown dimmed behind a reply. Clicking it smoothly scrolls to
// the original message (by its `#msg-<id>` anchor) and briefly pulses it so the
// user can spot it. If the original was removed (soft-deleted → not in the list)
// it's shown but not clickable.
export function QuotedMessage({
  parentId,
  authorName,
  snippet,
  align,
  removed,
}: {
  parentId: number;
  authorName: string;
  snippet: string;
  align: "left" | "right";
  removed: boolean;
}) {
  const jump = () => {
    if (removed) return;
    const el = document.getElementById(`msg-${parentId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const target =
      (el.querySelector("[data-msg-bubble]") as HTMLElement | null) ?? el;
    // Restart the animation if it's already mid-pulse.
    target.classList.remove("msg-pulse");
    void target.offsetWidth;
    target.classList.add("msg-pulse");
    window.setTimeout(() => target.classList.remove("msg-pulse"), 2600);
  };

  return (
    <button
      type="button"
      onClick={jump}
      disabled={removed}
      title={removed ? undefined : "Jump to the original message"}
      className={`-mb-2 block max-w-[15rem] text-left opacity-60 transition ${
        align === "right" ? "self-end" : "self-start"
      } ${removed ? "cursor-default" : "hover:opacity-90"}`}
    >
      <div className="rounded-xl border border-white/10 bg-black/40 px-2.5 pb-3 pt-1">
        <p className="truncate text-[10px] font-semibold text-zinc-300">
          {authorName}
        </p>
        <p className="truncate text-[11px] text-zinc-400">{snippet}</p>
      </div>
    </button>
  );
}
