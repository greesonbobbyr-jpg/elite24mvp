import type { CSSProperties, ReactNode } from "react";
import { FRAME_SLICE } from "@/lib/cardAssets";

// THE MINI CARD'S CHROME, shared by the player and staff mini cards: a 2:3
// card that fills its container's width, its face cut to sit inside the
// frame's chamfered corners, the level's nine-slice frame on top, and the
// name band at its foot. Sized in container units (cqw), so one card works
// from a phone's podium to a desktop org tree.

/** Frame and face insets as a share of the card's width (the frame art's
 * nine-slice border is 1/16 of the width). */
const BORDER = 6.25; // cqw
const INSET = 2.8; // cqw
const CHAMFER = `${INSET * 1.6}cqw`;

/** The card's own box: put it on the root element. */
export const MINI_CARD: CSSProperties = { aspectRatio: "2 / 3", containerType: "inline-size" };

/** The card face, inside the frame; `style` adds its background. */
export function MiniFace({ style, children }: { style?: CSSProperties; children: ReactNode }) {
  return (
    <div
      className="absolute overflow-hidden"
      style={{
        inset: `${INSET}cqw`,
        clipPath: `polygon(${CHAMFER} 0, calc(100% - ${CHAMFER}) 0, 100% ${CHAMFER}, 100% calc(100% - ${CHAMFER}), calc(100% - ${CHAMFER}) 100%, ${CHAMFER} 100%, 0 calc(100% - ${CHAMFER}), 0 ${CHAMFER})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** The level's frame art (miniArt(...).frame, or STAFF_ART.frame). */
export function MiniBorder({ frame }: { frame: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        borderStyle: "solid",
        borderWidth: `${BORDER}cqw`,
        borderColor: "transparent",
        borderImageSource: `url(${frame})`,
        borderImageSlice: FRAME_SLICE,
        borderImageWidth: `${BORDER}cqw`,
        borderImageRepeat: "stretch",
      }}
    />
  );
}

/** First name in the accent, surname big, then `children` (stars, role…), on
 * darkness at the foot of the face. */
export function MiniNameBand({ name, accent, children }: { name: string; accent: string; children?: ReactNode }) {
  const words = name.trim().split(/\s+/);
  const surname = words.length > 1 ? words[words.length - 1] : words[0];
  const firstName = words.length > 1 ? words.slice(0, -1).join(" ") : null;
  return (
    <span
      className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center"
      style={{ padding: "0 5cqw 9cqw", background: "linear-gradient(transparent, rgba(0,0,0,.72) 30%, #000)" }}
    >
      {firstName && (
        <span className="block w-full truncate font-bold uppercase leading-none" style={{ marginTop: "12cqw", fontSize: "9.4cqw", letterSpacing: "0.14em", color: accent }}>
          {firstName}
        </span>
      )}
      <span className="block w-full truncate font-black uppercase italic leading-none text-white" style={{ marginTop: firstName ? "1.5cqw" : "12cqw", fontSize: "13.5cqw", fontFamily: "var(--font-barlow)" }}>
        {surname}
      </span>
      {children}
    </span>
  );
}
