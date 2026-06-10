import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isOnboarded } from "@/lib/onboarding";

// Gate for the main app: a Player must finish onboarding before using anything
// here. Coaches and "no user selected" pass through (CLAUDE.md section 2).
// The /onboarding route lives outside this group, so it is never gated.
export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (user?.role === "PLAYER" && !isOnboarded(user)) {
    redirect("/onboarding");
  }

  return <>{children}</>;
}
