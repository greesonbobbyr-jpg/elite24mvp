import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isOnboarded } from "@/lib/onboarding";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const user = await getCurrentUser();

  // Only an un-onboarded player should see this. Coaches, onboarded players,
  // and "no user selected" go back to the app.
  if (!user || user.role !== "PLAYER" || isOnboarded(user)) {
    redirect("/");
  }

  const firstName = user.name.split(" ")[0];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-2">
        <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Welcome
        </span>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Hey {firstName}! 👋
        </h1>
        <p className="text-sm text-zinc-500">
          Let&apos;s set up your profile. It only takes a minute — start with the
          big one: your dream.
        </p>
      </header>

      <OnboardingForm />
    </main>
  );
}
