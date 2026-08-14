"use client";

import { isPortraitMetaV2 } from "@/lib/portrait/normalize";
import { APP_RED } from "@/lib/cardTheme";
import { CARD_ASPECT } from "@/lib/cardGeometry";
import { chamferClip, headCropStyle } from "@/app/components/card/chrome";

// THE STAFF CARD FAMILY (§42–43) — same design family as the Player Card,
// deliberately QUIETER: dark premium metal, circular portrait, clean type.
// No stars, points, rank, jersey, giant number, or foil progression — staff
// authority reads through restraint, not spectacle.

export type StaffPerson = {
  name: string;
  /** Display role label ("Head Coach", "Organization Owner", …). */
  role: string;
  teamName?: string | null;
  orgName?: string | null;
  photoUrl?: string | null;
  cutoutUrl?: string | null;
  photoMeta?: unknown;
  initials?: string | null;
};

export type StaffCardSize = "full" | "compact";

// One fixed quiet-steel colorway — staff cards do not progress.
const STEEL = ["#1c1f24", "#3c434c", "#8a939e", "#c7ced6", "#5a626c", "#1c1f24"];
const STEEL_HIGHLIGHT = "#d7dde4";
const BG = { top: "#15171b", mid: "#0c0e11", bottom: "#060708" };

function makeInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function withA(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function StaffCard({
  size,
  person,
  verified,
}: {
  size: StaffCardSize;
  person: StaffPerson;
  /** FUTURE slot (reference shows a verified mark) — renders nothing today. */
  verified?: React.ReactNode;
}) {
  void verified; // accepted, intentionally unrendered until the feature exists
  if (size === "compact") return <CompactStaff person={person} />;
  return <FullStaff person={person} />;
}

/** Circular steel-ring portrait shared by both sizes. */
function StaffPortrait({ person, disc }: { person: StaffPerson; disc: number }) {
  const meta = isPortraitMetaV2(person.photoMeta) ? person.photoMeta : null;
  const src = person.cutoutUrl ?? person.photoUrl ?? null;
  const initials = person.initials || makeInitials(person.name);
  return (
    <div
      className="relative inline-flex items-center justify-center rounded-full"
      style={{
        width: disc + 6,
        height: disc + 6,
        padding: 3,
        background: `conic-gradient(from 130deg, ${STEEL.join(", ")}, ${STEEL[0]})`,
        boxShadow: "0 3px 10px rgba(0,0,0,0.5)",
      }}
    >
      <div
        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full"
        style={{
          background: `radial-gradient(120% 120% at 50% 20%, ${BG.mid} 0%, ${BG.bottom} 100%)`,
        }}
      >
        {src && person.cutoutUrl && meta ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={person.name} style={headCropStyle(meta, disc)} />
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={person.name} className="h-full w-full object-cover object-top" />
        ) : (
          <span
            className="font-black uppercase italic text-white/90"
            style={{ fontFamily: "var(--font-barlow)", fontSize: disc * 0.34 }}
          >
            {initials}
          </span>
        )}
      </div>
    </div>
  );
}

function FullStaff({ person }: { person: StaffPerson }) {
  const W = 300;
  const words = person.name.trim().split(/\s+/);
  const surname = words.length > 1 ? words[words.length - 1] : words[0];
  const firstName = words.length > 1 ? words.slice(0, -1).join(" ") : null;
  const orgLine = [person.teamName, person.orgName].filter(Boolean).join(" · ");

  return (
    <div
      className="relative"
      style={{
        width: W,
        aspectRatio: `${CARD_ASPECT}`,
        filter: "drop-shadow(0 16px 24px rgba(0,0,0,0.5))",
      }}
    >
      {/* quiet steel frame */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          clipPath: chamferClip(0, 0.09),
          background: `conic-gradient(from 128deg at 50% 46%, ${STEEL.join(", ")}, ${STEEL[0]})`,
        }}
      />
      {/* face */}
      <div className="absolute inset-0" style={{ clipPath: chamferClip(0.025, 0.075) }}>
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              `radial-gradient(100% 55% at 50% -6%, ${withA(STEEL_HIGHLIGHT, 0.08)} 0%, transparent 60%),` +
              `linear-gradient(168deg, ${BG.top} 0%, ${BG.mid} 52%, ${BG.bottom} 100%)`,
          }}
        />

        <div className="relative flex h-full flex-col items-center px-5 pb-[10%] pt-[12%] text-center">
          <StaffPortrait person={person} disc={W * 0.42} />

          <div className="mt-[9%]">
            {firstName && (
              <p
                className="text-[11px] font-semibold uppercase leading-none text-white/70"
                style={{ letterSpacing: "0.16em" }}
              >
                {firstName}
              </p>
            )}
            <p
              className="mt-1.5 font-black uppercase italic leading-none text-white"
              style={{
                fontFamily: "var(--font-barlow)",
                fontSize: surname.length > 9 ? 30 : 36,
                textShadow: "0 2px 8px rgba(0,0,0,0.6)",
              }}
            >
              {surname}
            </p>
          </div>

          {/* role label — the card's one metallic accent */}
          <p
            className="mt-3 rounded-full px-4 py-1 text-[10px] font-bold uppercase"
            style={{
              letterSpacing: "0.24em",
              color: STEEL_HIGHLIGHT,
              background: "rgba(0,0,0,0.45)",
              boxShadow: `inset 0 0 0 1px ${withA(STEEL_HIGHLIGHT, 0.25)}`,
            }}
          >
            {person.role}
          </p>

          {orgLine && (
            <p
              className="mt-2 max-w-full truncate text-[10px] font-semibold uppercase text-white/55"
              style={{ letterSpacing: "0.14em" }}
            >
              {orgLine}
            </p>
          )}

          {/* footer maker's mark */}
          <div
            className="mt-auto flex items-center justify-center rounded-t-md px-5 py-1.5"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.4))",
              boxShadow: `inset 0 1px 0 ${withA(STEEL_HIGHLIGHT, 0.18)}, inset 0 0 0 1px rgba(0,0,0,0.4)`,
            }}
          >
            <span
              className="text-[11px] font-black italic uppercase leading-none text-white"
              style={{ fontFamily: "var(--font-barlow)" }}
            >
              Elite<span style={{ color: APP_RED }}>24</span>MVP
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompactStaff({ person }: { person: StaffPerson }) {
  const orgLine = [person.teamName, person.orgName].filter(Boolean).join(" · ");
  return (
    <div className="relative h-16 w-full">
      <span
        aria-hidden
        className="absolute inset-0 rounded-xl"
        style={{
          background: `linear-gradient(120deg, ${BG.top} 0%, ${BG.mid} 55%, ${BG.bottom} 100%)`,
          boxShadow: `inset 0 0 0 1px ${withA(STEEL_HIGHLIGHT, 0.22)}, inset 0 1px 0 ${withA(
            STEEL_HIGHLIGHT,
            0.1,
          )}, 0 4px 12px -6px rgba(0,0,0,0.6)`,
        }}
      />
      <div className="relative flex h-full items-center gap-3 px-3">
        <StaffPortrait person={person} disc={40} />
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-black italic uppercase leading-none text-white"
            style={{ fontFamily: "var(--font-barlow)" }}
          >
            {person.name}
          </p>
          <p
            className="mt-1 truncate text-[9px] font-bold uppercase text-white/60"
            style={{ letterSpacing: "0.18em" }}
          >
            {person.role}
            {orgLine ? ` · ${orgLine}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
