import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import "./globals.css";
import { prisma } from "@/lib/prisma";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { getCurrentUserId } from "@/lib/session";
import { roleLabel } from "@/lib/format";
import {
  DevUserSwitcher,
  type SwitcherEntry,
  type SwitcherOrg,
} from "@/app/components/DevUserSwitcher";
import { HomeFooter } from "@/app/components/HomeFooter";
import { InstallBanner } from "@/app/components/InstallBanner";

// App-wide type: Roboto (self-hosted by next/font — no external request).
const roboto = localFont({ src: "../public/fonts/Roboto-Variable.ttf", variable: "--font-roboto", display: "swap" });

// Display type: Barlow Semi Condensed — the header wordmark (900 italic) and
// the PROVISIONAL card face (Δ1: working typography for the Player/Staff card
// system, validated against the approved reference during the visual loop —
// swapped out if it can't reproduce the reference; geometry never bends to it).
const barlow = localFont({
  src: [
    { path: "../public/fonts/BarlowSemiCondensed-Black.ttf", weight: "900", style: "normal" },
    { path: "../public/fonts/BarlowSemiCondensed-BlackItalic.ttf", weight: "900", style: "italic" },
    { path: "../public/fonts/BarlowSemiCondensed-SemiBold.ttf", weight: "600", style: "normal" },
  ],
  variable: "--font-barlow",
  display: "swap",
});

const cardDisplay = localFont({ src: "../public/fonts/Rajdhani-Bold.ttf", weight: "700", variable: "--font-card-display", display: "swap" });



export const metadata: Metadata = {
  title: "Elite24MVP",
  description: "Team-private basketball development app.",
  // PWA: web manifest (served by app/manifest.ts) + iOS "add to home screen"
  // support so the app opens full-screen with the Elite24 icon.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Elite24",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  // Edge to edge on notched iPhones, so the env(safe-area-inset-*) padding
  // used by the header and bottom tab bars takes effect (it's always 0
  // without this). Pairs with statusBarStyle "black-translucent" above.
  viewportFit: "cover",
};

// Renders the dev-only user switcher, grouped ORG → TEAM → MEMBER (Stage 5).
// Never shown in production (section 7). Wrapped in try/catch so a
// not-yet-migrated database doesn't crash the app.
async function DevSwitcherSlot() {
  if (process.env.NODE_ENV === "production") return null;
  try {
    const [rawOrgs, rawNoTeam, currentUserId] = await Promise.all([
      prisma.organization.findMany({
        orderBy: { id: "asc" },
        include: {
          roleAssignments: {
            where: { role: "ORG_ADMIN", revokedAt: null },
            include: { profile: { select: { userId: true, name: true, memberships: { where: { endedAt: null, season: { isCurrent: true } }, select: { id: true } } } } },
          },
          teams: {
            orderBy: { id: "asc" },
            include: {
              memberships: {
                where: { endedAt: null, season: { isCurrent: true } },
                orderBy: [{ role: "asc" }, { id: "asc" }],
                include: { profile: { select: { userId: true, name: true } } },
              },
            },
          },
        },
      }),
      // No active membership and no org-admin grant: a personal athlete, or
      // a removed player.
      prisma.profile.findMany({
        where: {
          userId: { not: null },
          memberships: { none: { endedAt: null, season: { isCurrent: true } } },
          roleAssignments: { none: { revokedAt: null } },
        },
        orderBy: { name: "asc" },
        select: {
          userId: true,
          name: true,
          setupCompletedAt: true,
          memberships: { select: { id: true }, take: 1 },
        },
      }),
      getCurrentUserId(),
    ]);
    const noTeam: SwitcherEntry[] = rawNoTeam.map((p) => ({
      userId: p.userId!,
      name: p.name,
      label: p.memberships.length > 0 ? "Removed" : p.setupCompletedAt ? "Personal" : "New",
      membershipId: null,
    }));
    const orgs: SwitcherOrg[] = rawOrgs.map((o) => ({
      id: o.id,
      name: o.name,
      // Org admins WITHOUT a roster spot appear at the org level.
      admins: o.roleAssignments
        .filter((r) => r.profile.userId != null && r.profile.memberships.length === 0)
        .map((r) => ({
          userId: r.profile.userId!,
          name: r.profile.name,
          label: "Org Admin",
          membershipId: null,
        })),
      teams: o.teams.map((t) => ({
        id: t.id,
        name: t.name,
        members: t.memberships
          .filter((m) => m.profile.userId != null)
          .map((m) => ({
            userId: m.profile.userId!,
            name: m.profile.name,
            label: roleLabel(m.role) ?? "Player",
            membershipId: m.id,
          })),
      })),
    }));
    return <DevUserSwitcher orgs={orgs} noTeam={noTeam} currentUserId={currentUserId} />;
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Light/dark (CLAUDE.md §9): no data-theme = follow the phone's setting;
  // "light"/"dark" = the person's pinned choice from the ☰ menu. Rendered
  // server-side so the first paint is already in the right mode.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html
      lang="en"
      data-theme={theme === "system" ? undefined : theme}
      className={`${roboto.variable} ${barlow.variable} ${cardDisplay.variable} h-full antialiased`}
    >
      {/* pb-16 reserves space so the global footer + page content clear the
          player bottom tab bar (rendered in the (main) layout). */}
      <body className="flex min-h-full flex-col pb-16">
        {children}
        {/* Elite24 "Powered by" mark — rendered on the Home route only. */}
        <HomeFooter />
        {/* Dismissible "add to home screen" prompt (PWA install). */}
        <InstallBanner />
        <DevSwitcherSlot />
      </body>
    </html>
  );
}





