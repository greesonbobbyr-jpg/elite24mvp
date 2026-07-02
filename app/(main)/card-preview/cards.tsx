import Image from "next/image";

// TEMPORARY preview components — two player-card designs for in-browser
// iteration. Not wired to real profiles: everything is presentational and driven
// by the passed-in `demo`. Delete with the route once a direction is picked.

// The card material: a bright, cohesive Mustang-red — a soft warm glow from the
// top over a saturated red that deepens to maroon at the bottom (no muddy black
// corner). Applied inline; the dark stat/badge panels keep their own translucent
// black so white text stays readable.
const cardBg =
  "radial-gradient(135% 105% at 50% -5%, rgba(250,84,99,0.55) 0%, rgba(201,30,52,0.30) 40%, rgba(201,30,52,0) 72%)," +
  "linear-gradient(162deg, #d11731 0%, #a51126 48%, #470a15 100%)";

// Depth without a heavy border: a soft outer drop shadow, a hairline light ring,
// a subtle top highlight, and a gentle bottom vignette — all inset so the ghost
// "24" (absolute) still clips to the rounded card.
const cardShadow =
  "0 24px 48px -20px rgba(0,0,0,0.6)," +
  "0 0 0 1px rgba(255,255,255,0.08)," +
  "inset 0 1px 0 rgba(255,255,255,0.16)," +
  "inset 0 -90px 90px -60px rgba(0,0,0,0.45)";

const cardShell = "relative overflow-hidden rounded-3xl";

export type CardData = {
  name: string;
  number: string;
  position: string;
  team: string;
  tier: string;
  height: string;
  weight: string;
  leaderboardRank: string;
  initials: string;
  logo: string;
};

// --- Shared bits ---------------------------------------------------------

// The Mustang mark placed DIRECTLY on the card — the PNG is transparent (no white
// box), so no plate. A soft drop shadow lifts it off the red.
function LogoMark({
  logo,
  team,
  size = 46,
}: {
  logo: string;
  team: string;
  size?: number;
}) {
  return (
    <Image
      src={logo}
      alt={`${team} logo`}
      width={size}
      height={size}
      className="object-contain drop-shadow-[0_2px_5px_rgba(0,0,0,0.45)]"
      style={{ width: size, height: size }}
    />
  );
}

// The player-photo placeholder: a framed initials disc/square with a "PHOTO GOES
// HERE" pill riding its bottom edge. No upload (child-safe / deferred).
function PhotoFrame({
  initials,
  shape,
  size,
}: {
  initials: string;
  shape: "circle" | "square";
  size: number;
}) {
  const radius = shape === "circle" ? "rounded-full" : "rounded-3xl";
  return (
    <div className="relative inline-block" style={{ width: size }}>
      <div
        className={`flex items-center justify-center ${radius} font-black uppercase tracking-tight text-white`}
        style={{
          width: size,
          height: size,
          fontSize: size * 0.34,
          background:
            "radial-gradient(120% 120% at 50% 25%, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.45) 100%)",
          boxShadow:
            "inset 0 0 0 2px rgba(255,255,255,0.28), inset 0 0 0 7px rgba(0,0,0,0.18), inset 0 8px 24px rgba(0,0,0,0.35)",
          textShadow: "0 2px 8px rgba(0,0,0,0.45)",
        }}
      >
        {initials}
      </div>
      <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-2.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] text-white/85 ring-1 ring-white/10">
        Photo goes here
      </span>
    </div>
  );
}

// The tier badge placeholder — a clean dark pill; real badge art comes later.
function BadgeSlot({ tier }: { tier: string }) {
  return (
    <span className="inline-flex flex-col items-center rounded-lg bg-black/35 px-3 py-1 text-center ring-1 ring-white/15">
      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white">
        {tier}
      </span>
      <span className="text-[7px] uppercase tracking-[0.1em] text-white/45">
        badge coming
      </span>
    </span>
  );
}

// One divided stat cell: bold value over a tiny uppercase label.
function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-2 py-3 text-center">
      <span className="text-lg font-black leading-none tabular-nums text-white">
        {value}
      </span>
      <span className="mt-1 text-[8.5px] font-bold uppercase leading-tight tracking-[0.12em] text-white/60">
        {label}
      </span>
    </div>
  );
}

// The bottom stat panel (shared): three divided cells on a dark translucent bar.
function StatPanel({ demo }: { demo: CardData }) {
  return (
    <div className="flex items-stretch divide-x divide-white/10 rounded-2xl bg-black/30 ring-1 ring-white/10">
      <StatCell label="Height" value={demo.height} />
      <StatCell label="Weight" value={demo.weight} />
      <StatCell label="Leaderboard" value={demo.leaderboardRank} />
    </div>
  );
}

// Bold condensed-feel name + "POSITION · TEAM" subline. `center` for the portrait
// card, left-aligned for the landscape one.
function NameBlock({
  demo,
  center,
  size = "text-3xl",
}: {
  demo: CardData;
  center?: boolean;
  size?: string;
}) {
  return (
    <div className={center ? "text-center" : "text-left"}>
      <h2
        className={`${size} font-black uppercase leading-[0.95] tracking-tight text-white`}
        style={{ textShadow: "0 2px 10px rgba(0,0,0,0.35)" }}
      >
        {demo.name}
      </h2>
      <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/75">
        {demo.position} · {demo.team}
      </p>
    </div>
  );
}

// --- CARD 1: Vertical (portrait) ----------------------------------------

export function VerticalCard({ demo }: { demo: CardData }) {
  return (
    <div
      className={`${cardShell} w-[340px] p-6`}
      style={{ background: cardBg, boxShadow: cardShadow }}
    >
      {/* ghosted jersey number, behind content */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-6 right-2 select-none text-[160px] font-black leading-none text-white/10"
      >
        {demo.number}
      </span>

      <div className="relative z-10 flex flex-col items-center">
        {/* top row: logo (left) + badge (right) */}
        <div className="flex w-full items-center justify-between">
          <LogoMark logo={demo.logo} team={demo.team} size={46} />
          <BadgeSlot tier={demo.tier} />
        </div>

        {/* center: photo placeholder */}
        <div className="mt-7">
          <PhotoFrame initials={demo.initials} shape="circle" size={150} />
        </div>

        {/* name + position · team */}
        <div className="mt-7">
          <NameBlock demo={demo} center size="text-3xl" />
        </div>

        {/* bottom stat panel */}
        <div className="mt-6 w-full">
          <StatPanel demo={demo} />
        </div>
      </div>
    </div>
  );
}

// --- CARD 2: Horizontal (landscape) -------------------------------------

export function HorizontalCard({ demo }: { demo: CardData }) {
  return (
    <div
      className={`${cardShell} w-[560px] max-w-full p-6`}
      style={{ background: cardBg, boxShadow: cardShadow }}
    >
      {/* ghosted jersey number, behind content */}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-10 right-6 select-none text-[190px] font-black leading-none text-white/10"
      >
        {demo.number}
      </span>

      <div className="relative z-10">
        {/* top row: logo (left) + badge (right) */}
        <div className="flex items-center justify-between">
          <LogoMark logo={demo.logo} team={demo.team} size={50} />
          <BadgeSlot tier={demo.tier} />
        </div>

        {/* body: photo (left) + name (right) */}
        <div className="mt-5 flex items-center gap-5">
          <PhotoFrame initials={demo.initials} shape="square" size={128} />
          <div className="flex-1">
            <NameBlock demo={demo} size="text-3xl" />
          </div>
        </div>

        {/* stat row */}
        <div className="mt-6">
          <StatPanel demo={demo} />
        </div>
      </div>
    </div>
  );
}
