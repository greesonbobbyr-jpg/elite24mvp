import type { Metadata } from "next";
import Image from "next/image";
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
      {/* pb-16 reserves space so the global footer + page content clear the
          player bottom tab bar (rendered in the (main) layout). */}
      <body className="flex min-h-full flex-col pb-16">
        {children}
        {/* Always-present Elite24 mark — the fixed brand frame (section 9). */}
        <footer className="flex flex-col items-center gap-2 border-t border-zinc-900 py-5 text-center text-xs text-zinc-500">
          <Image
            src="/logo.png"
            alt="Elite 24 MVP"
            width={40}
            height={40}
            className="h-10 w-10"
          />
          <span>
            Powered by{" "}
            <span className="font-semibold text-red-500">Elite 24 MVP</span>
          </span>
        </footer>
        <DevSwitcherSlot />
      </body>
    </html>
  );
}
