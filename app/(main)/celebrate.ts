// Client-only quest-completion VISUALS (no sound). Two effects, both built from
// the Web Animations API with NO dependencies, rendered into a detached overlay
// on document.body so they survive the tile/total re-rendering underneath:
//   - celebrate(badge, points): the "Tile Pop" — a "+N" float + particle burst.
//   - flurry(el): a small celebratory burst at the points total when it ticks up.
// Both are called from client handlers (real interactions only), wrapped so they
// can never break anything, and skipped under prefers-reduced-motion.

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

const COLORS = ["#d4af37", "#e8c766", "#ef4444"]; // metallic gold, highlight gold, brand red

function makeLayer(): HTMLDivElement {
  const layer = document.createElement("div");
  layer.style.cssText =
    "position:fixed;inset:0;z-index:50;pointer-events:none;overflow:hidden;";
  document.body.appendChild(layer);
  return layer;
}

function spawnParticles(
  layer: HTMLElement,
  cx: number,
  cy: number,
  count: number,
  spread: number,
): void {
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;width:6px;height:6px;border-radius:9999px;background:${COLORS[i % COLORS.length]};`;
    layer.appendChild(p);
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = spread + Math.random() * spread * 0.6;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    p.animate(
      [
        { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
        {
          transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(0.3)`,
          opacity: 0,
        },
      ],
      {
        duration: 600 + Math.random() * 220,
        easing: "cubic-bezier(0.15,0.6,0.3,1)",
        fill: "forwards",
      },
    );
  }
}

// Tile "pop": a gold "+N" floats up off the badge + a particle burst.
export function celebrate(anchor: HTMLElement | null, points: number): void {
  if (typeof window === "undefined" || !anchor || prefersReducedMotion()) return;
  try {
    const r = anchor.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const layer = makeLayer();

    const label = document.createElement("div");
    label.textContent = `+${points}`;
    label.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;transform:translate(-50%,-50%);color:#e8c766;font-weight:800;font-size:18px;text-shadow:0 0 10px rgba(212,175,55,0.7);`;
    layer.appendChild(label);
    label.animate(
      [
        { transform: "translate(-50%,-50%) translateY(0)", opacity: 1 },
        { transform: "translate(-50%,-50%) translateY(-42px)", opacity: 0 },
      ],
      { duration: 800, easing: "cubic-bezier(0.2,0.7,0.3,1)", fill: "forwards" },
    );

    spawnParticles(layer, cx, cy, 12, 45);
    window.setTimeout(() => layer.remove(), 1000);
  } catch {
    /* never let the celebration break anything */
  }
}

// A small gold-heavy flurry centered on an element (used on the points total
// when it ticks up from a completion).
export function flurry(anchor: HTMLElement | null): void {
  if (typeof window === "undefined" || !anchor || prefersReducedMotion()) return;
  try {
    const r = anchor.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const layer = makeLayer();
    spawnParticles(layer, cx, cy, 14, 38);
    window.setTimeout(() => layer.remove(), 1000);
  } catch {
    /* ignore */
  }
}
