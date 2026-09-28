import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/context";
import { isSetUp } from "@/lib/onboarding";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const ctx = await getCurrentContext();
  const user = ctx?.user;

  // Only a player who hasn't completed setup should see this (4f: the gate
  // reads Profile.setupCompletedAt). Everyone else goes back to the app.
  if (!ctx || !user || user.role !== "PLAYER" || isSetUp(ctx)) {
    redirect("/");
  }

  const firstName = user.name.split(" ")[0];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-2">
        <span className="w-fit rounded-full bg-red-600/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-2">
          Welcome
        </span>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Hey {firstName}! 👋
        </h1>
        <p className="text-sm text-subtle">
          Let&apos;s set up your profile. It only takes a minute — start with the
          big one: your dream.
        </p>
      </header>

      <OnboardingForm />
    </main>
  );
}
