import type { Metadata, Viewport } from "next";
import { Roboto, Barlow_Semi_Condensed } from "next/font/google";
import "./globals.css";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { roleLabel } from "@/lib/format";
import {
  DevUserSwitcher,
  type SwitcherOrg,
} from "@/app/components/DevUserSwitcher";
import { HomeFooter } from "@/app/components/HomeFooter";
import { InstallBanner } from "@/app/components/InstallBanner";

// App-wide type: Roboto (self-hosted by next/font — no external request).
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-roboto",
  display: "swap",
});

// Wordmark type: Barlow Semi Condensed Black Italic — used only for the header
// "Elite24MVP" wordmark (loads just the one 900-italic face, so it's light).
const barlow = Barlow_Semi_Condensed({
  subsets: ["latin"],
  weight: ["900"],
  style: ["italic"],
  variable: "--font-barlow",
  display: "swap",
});

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
    const [rawOrgs, currentUserId] = await Promise.all([
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
      getCurrentUserId(),
    ]);
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
    return <DevUserSwitcher orgs={orgs} currentUserId={currentUserId} />;
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
    <html
      lang="en"
      className={`${roboto.variable} ${barlow.variable} dark h-full antialiased`}
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
