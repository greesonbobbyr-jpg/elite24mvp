import { VerticalCard, HorizontalCard, type CardData } from "./cards";

// TEMPORARY design sandbox: renders two player-card directions side by side with
// hardcoded demo data so we can iterate on the look in-browser. NOT linked from
// any nav — reachable only by typing /card-preview. Touches no real feature,
// model, or route. Delete this whole folder once a direction is picked and the
// winner is wired into the real Brand page.
const demo: CardData = {
  name: "Jordan Carter",
  number: "24",
  position: "Point Guard",
  team: "Mustang Broncos",
  tier: "PROSPECT",
  height: "6'2\"",
  weight: "175",
  leaderboardRank: "#3",
  initials: "JC",
  logo: "/mustang-logo.png",
};

export default function CardPreviewPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center gap-8 px-6 py-12">
      <p className="text-center text-sm text-zinc-500">
        Card design preview — demo data, not wired to real profiles yet.
      </p>

      <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-start lg:justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="e24-eyebrow">Vertical</span>
          <VerticalCard demo={demo} />
        </div>

        <div className="flex flex-col items-center gap-3">
          <span className="e24-eyebrow">Horizontal</span>
          <HorizontalCard demo={demo} />
        </div>
      </div>
    </main>
  );
}
