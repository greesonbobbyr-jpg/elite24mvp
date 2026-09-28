"use client";

import { isPortraitMetaV2 } from "@/lib/portrait/normalize";
import { STAFF_FINISH } from "@/lib/cardTheme";
import { FRAME_SLICE, STAFF_ART } from "@/lib/cardAssets";
import { STAT_COLUMNS, STAT_PANELS, STAT_RAIL, u } from "@/lib/cardGeometry";
import { PortraitDisc } from "@/app/components/card/PortraitDisc";
import { CardCompositor } from "@/app/components/card/CardCompositor";
import { AssetLayer } from "@/app/components/card/AssetLayer";
import { FooterMark, NameBlock } from "@/app/components/card/DynamicLayers";

// THE STAFF CARD FAMILY (§42–43) — the Player Card's frame, deliberately
// QUIETER: the same authored plate in graphite (STAFF_LOOK), no energy,
// number, stars or points; staff authority reads through restraint. The
// stat panels carry role, team and organization.

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

export type StaffCardSize = "full" | "compact" | "avatar";

const FONT = "var(--font-barlow), sans-serif";
/** The full staff card's width in CSS px (its layout is in card units). */
const FULL_WIDTH = 300;

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
  if (size === "avatar") return <StaffPortrait person={person} px={40} />;
  if (size === "compact") return <CompactStaff person={person} />;
  return <FullStaff person={person} />;
}

/** The staff portrait: photo (or initials) on the graphite card face, inside
 * the graphite ring cut from the staff plate. */
export function StaffPortrait({ person, px }: { person: StaffPerson; px: number }) {
  const meta = isPortraitMetaV2(person.photoMeta) ? person.photoMeta : null;
  const initials = person.initials || makeInitials(person.name);
  // ring.webp's band spans radii 78–95 of 96 px; the disc tucks just under it.
  const inset = px * 0.09;
  const disc = px - inset * 2;
  return (
    <div
      className="relative inline-flex shrink-0"
      style={{ width: px, height: px, filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.5))" }}
    >
      <div
        className="absolute flex items-center justify-center overflow-hidden rounded-full"
        style={{ inset, background: `#050607 url(${STAFF_ART.plate.file}) 50% 32% / 600% auto` }}
      >
        <PortraitDisc name={person.name} initials={initials} cutout={person.cutoutUrl ?? null} photo={person.photoUrl ?? null}
          meta={meta} disc={disc} />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={STAFF_ART.ring} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}

/** A panel value on one line, or two when long (split at the middle space). */
function panelLines(value: string): string[] {
  const text = value.toUpperCase();
  if (text.length <= 11 || !text.includes(" ")) return [text];
  const spaces = [...text.matchAll(/ /g)].map((m) => m.index ?? 0);
  const cut = spaces.reduce((best, i) => (Math.abs(i - text.length / 2) < Math.abs(best - text.length / 2) ? i : best));
  return [text.slice(0, cut), text.slice(cut + 1)];
}

/** Role, team and organization in the plate's three stat panels. */
function StaffRail({ person }: { person: StaffPerson }) {
  const { palette } = STAFF_FINISH;
  const cells: [string, string][] = [
    ["ROLE", person.role],
    ["TEAM", person.teamName || "—"],
    ["ORG", person.orgName || "—"],
  ];
  return <>
    {STAT_COLUMNS.map((col, i) => {
      const [label, value] = cells[i];
      const lines = panelLines(value);
      const longest = Math.max(...lines.map((line) => line.length));
      const size = Math.min(40, (col.w - 28) / (longest * 0.58));
      return (
        <svg key={label} data-layer={`staff-${label.toLowerCase()}`} className="pointer-events-none absolute overflow-visible"
          style={{ left: u(col.x), top: u(STAT_RAIL.y), width: u(col.w), height: u(STAT_RAIL.h) }} viewBox={`0 0 ${col.w} ${STAT_RAIL.h}`}>
          <text x={col.w / 2} y="45" textAnchor="middle" fontFamily={FONT} fontWeight="600" fontSize={STAT_PANELS.headerFontSize}
            letterSpacing="2" fill={palette.statHeader}>
            {label}
          </text>
          {lines.map((line, j) => (
            <text key={j} x={col.w / 2} y={lines.length === 1 ? 118 : 100 + j * (size + 6)} textAnchor="middle" fontFamily={FONT}
              fontWeight="800" fontSize={size} fill="#e9edf2">
              {line}
            </text>
          ))}
        </svg>
      );
    })}
  </>;
}

function FullStaff({ person }: { person: StaffPerson }) {
  const words = person.name.trim().split(/\s+/);
  const surname = words.length > 1 ? words[words.length - 1] : words[0];
  const firstName = words.length > 1 ? words.slice(0, -1).join(" ") : null;
  const portraitUnits = 560;

  return (
    <CardCompositor width={FULL_WIDTH} data-staff style={{ filter: `drop-shadow(0 ${u(30)} ${u(40)} rgba(0,0,0,0.55))` }}>
      <AssetLayer spec={STAFF_ART.plate} />
      <div className="absolute flex justify-center" style={{ left: 0, right: 0, top: u(300) }}>
        <StaffPortrait person={person} px={(portraitUnits * FULL_WIDTH) / 1000} />
      </div>
      <NameBlock firstName={firstName} surname={surname} finish={STAFF_FINISH} />
      <StaffRail person={person} />
      <FooterMark />
    </CardCompositor>
  );
}

/** The row's face, cut to sit inside the mini frame's chamfered corners. */
const ROW_FACE_CLIP =
  "polygon(7px 0, calc(100% - 7px) 0, 100% 7px, 100% calc(100% - 7px), calc(100% - 7px) 100%, 7px 100%, 0 calc(100% - 7px), 0 7px)";

function CompactStaff({ person }: { person: StaffPerson }) {
  const orgLine = [person.teamName, person.orgName].filter(Boolean).join(" · ");
  return (
    <div className="relative h-[72px] w-full" data-staff>
      <div
        aria-hidden
        className="absolute"
        style={{ inset: 3, clipPath: ROW_FACE_CLIP, background: `#040506 url(${STAFF_ART.plate.file}) 50% 30% / 140% auto` }}
      >
        <span className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(0,0,0,.35), rgba(0,0,0,.1) 45%, rgba(0,0,0,.5))" }} />
      </div>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          borderStyle: "solid",
          borderWidth: 10,
          borderColor: "transparent",
          borderImageSource: `url(${STAFF_ART.frame})`,
          borderImageSlice: FRAME_SLICE,
          borderImageWidth: "10px",
          borderImageRepeat: "stretch",
        }}
      />
      <div className="relative flex h-full items-center gap-3 pl-3.5 pr-4">
        <StaffPortrait person={person} px={48} />
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-black italic uppercase leading-none text-white"
            style={{ fontFamily: "var(--font-barlow)" }}
          >
            {person.name}
          </p>
          <p className="mt-1 truncate text-[9px] font-bold uppercase text-white/70" style={{ letterSpacing: "0.18em" }}>
            <span style={{ color: STAFF_FINISH.palette.accent }}>{person.role}</span>
            {orgLine ? ` · ${orgLine}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
