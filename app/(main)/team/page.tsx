import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { JoinCodeCard } from "./JoinCodeCard";
import { TeamSettingsForm } from "./TeamSettingsForm";

// Coach-only team settings: the join code (copy / regenerate) + team name and
// branding. Team comes from the session (coach's own team) — never the client,
// so a coach can only ever see/edit their own team.
export default async function TeamSettingsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "COACH") redirect("/");

  const team = await prisma.team.findUnique({ where: { id: user.teamId } });
  if (!team) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-6 py-8">
      <header>
        <p className="e24-eyebrow">Team Settings</p>
        <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-white">
          {team.name}
        </h1>
      </header>

      <JoinCodeCard code={team.joinCode} />

      <section>
        <p className="e24-eyebrow mb-2">Team details</p>
        <TeamSettingsForm
          team={{
            name: team.name,
            logoUrl: team.logoUrl,
            accentColor: team.accentColor,
          }}
        />
      </section>
    </main>
  );
}
