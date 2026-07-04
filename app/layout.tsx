import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { DevUserSwitcher } from "@/app/components/DevUserSwitcher";
import { HomeFooter } from "@/app/components/HomeFooter";

// App-wide type: Roboto (self-hosted by next/font — no external request).
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-roboto",
  display: "swap",
});

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
    <html lang="en" className={`${roboto.variable} dark h-full antialiased`}>
      {/* pb-16 reserves space so the global footer + page content clear the
          player bottom tab bar (rendered in the (main) layout). */}
      <body className="flex min-h-full flex-col pb-16">
        {children}
        {/* Elite24 "Powered by" mark — rendered on the Home route only. */}
        <HomeFooter />
        <DevSwitcherSlot />
      </body>
    </html>
  );
}
