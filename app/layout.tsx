import type { Metadata } from "next";
import "./globals.css";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { DevUserSwitcher } from "@/app/components/DevUserSwitcher";

export const metadata: Metadata = {
  title: "Elite24MVP",
  description: "Team-private basketball development app (dev build).",
};

// Renders the dev-only user switcher. Never shown in production (section 7).
// Wrapped in try/catch so a not-yet-migrated database doesn't crash the app.
async function DevSwitcherSlot() {
  if (process.env.NODE_ENV === "production") return null;
  try {
    const [teams, currentUserId] = await Promise.all([
      prisma.team.findMany({
        orderBy: { id: "asc" },
        include: {
          users: {
            orderBy: [{ role: "asc" }, { name: "asc" }],
            select: { id: true, name: true, role: true },
          },
        },
      }),
      getCurrentUserId(),
    ]);
    return <DevUserSwitcher teams={teams} currentUserId={currentUserId} />;
  } catch {
    return null;
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // `dark` forces the brand's black theme app-wide (CLAUDE.md section 9).
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        {/* Always-present Elite24 mark — the fixed brand frame (section 9). */}
        <footer className="border-t border-zinc-900 py-4 text-center text-xs text-zinc-500">
          Powered by{" "}
          <span className="font-semibold text-red-500">Elite 24 MVP</span>
        </footer>
        <DevSwitcherSlot />
      </body>
    </html>
  );
}
