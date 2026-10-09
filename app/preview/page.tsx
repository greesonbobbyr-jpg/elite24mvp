import Link from "next/link";
import { cardDefault } from "@/app/components/ui/Card";

// Index of the mockup screens, in the order someone meets them.
const SCREENS: { href: string; title: string; note: string }[] = [
  { href: "/preview/signup", title: "1 · Create your account", note: "Everyone starts here: name, email, password, photo." },
  { href: "/preview/welcome", title: "2 · What brings you here?", note: "Start an Organization · Joining a Team · Personal Player Development." },
  { href: "/preview/org-setup", title: "3 · Start an Organization", note: "Org code → name and colors → structure → teams → coaches." },
  { href: "/preview/invite", title: "4 · Invite staff", note: "A code and a link to text or share, plus a QR code — no email needed." },
  { href: "/preview/org-view", title: "5 · Organization View", note: "Structure, people and roles, invites, announcements, activity log." },
  { href: "/preview/compose", title: "6 · Send an announcement", note: "Who it goes to, pictures, a video link, and when it disappears." },
  { href: "/preview/notifications", title: "7 · Notifications", note: "Elite24, org and coach messages look different; the ☰ shows what's unread." },
  { href: "/preview/ceo", title: "8 · CEO View", note: "Gary's view of every organization, team, coach and player." },
];

export default function PreviewIndex() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-6 py-10">
      <header>
        <p className="e24-eyebrow">Mockup</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">Accounts, organizations &amp; announcements</h1>
        <p className="mt-1 text-sm text-muted">Sample screens only — nothing here saves. Tap through in order.</p>
      </header>
      <ul className="flex flex-col gap-2.5">
        {SCREENS.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className={`${cardDefault} block p-4 transition hover:border-field-line`}>
              <span className="block font-bold text-ink">{s.title}</span>
              <span className="mt-0.5 block text-sm text-muted">{s.note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
