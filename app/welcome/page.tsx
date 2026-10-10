import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/context";
import { normalizeCode } from "@/lib/invites";
import { personaOf } from "@/lib/persona";
import { WelcomePaths } from "./WelcomePaths";

// STEP 2 — after creating an account: start an organization, join a team, or
// train on your own. Outside the (main) layout, which sends anyone not set up
// yet here. Anyone signed in can come back to use a code (e.g. a coach given
// an organization code); the solo path is only for someone not yet set up.
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login?next=/welcome");
  const code = normalizeCode((await searchParams).code) || null;
  const persona = personaOf(ctx);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 py-10">
      <WelcomePaths firstName={ctx.user.name.split(" ")[0]} initialCode={code} canGoSolo={persona === "new"} />
    </main>
  );
}
