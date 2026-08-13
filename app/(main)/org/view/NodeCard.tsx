import type { CSSProperties, ReactNode } from "react";

// A tappable structure node (program / division / team) with rollup counts.
// `vt` sets a stable view-transition-name so the browser can morph the node
// between layout states on mobile (center ↔ sibling strip).
export function NodeCard({
  title,
  counts,
  active,
  small,
  vt,
  onClick,
}: {
  title: string;
  counts?: string;
  active?: boolean;
  small?: boolean;
  vt?: string;
  onClick: () => void;
}) {
  const style: CSSProperties | undefined = vt
    ? ({ viewTransitionName: vt } as CSSProperties)
    : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={`shrink-0 rounded-2xl border text-left transition active:scale-[0.98] ${
        active
          ? "border-red-500 bg-red-600/15 shadow-[0_0_18px_rgba(220,38,38,0.25)]"
          : "border-white/10 bg-white/[0.03] hover:border-white/25"
      } ${small ? "px-3 py-1.5" : "px-4 py-3"}`}
    >
      <p className={`font-black tracking-tight text-white ${small ? "text-xs" : "text-base"}`}>
        {title}
      </p>
      {!small && counts && (
        <p className="mt-0.5 text-[11px] font-medium text-zinc-500">{counts}</p>
      )}
    </button>
  );
}

// Horizontal rail (desktop rows + mobile sibling strip / fan rows).
export function Rail({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div>
      {label && <p className="e24-eyebrow mb-1.5">{label}</p>}
      <div className="flex gap-2 overflow-x-auto pb-1.5">{children}</div>
    </div>
  );
}
