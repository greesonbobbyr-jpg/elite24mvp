import { notFound } from "next/navigation";

// PERSON-FIRST MOCKUP (plan Phase 0, owner 2026-10-09): clickable screens for
// the new front door, org setup, invites, announcements, Organization View
// and CEO View — static sample data, nothing reads or writes the database.
// The owner signs off on flows and looks before any of it is built for real.
// DEV-ONLY: production builds 404.
export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}
