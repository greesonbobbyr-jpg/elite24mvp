import QRCode from "qrcode";
import { cardDefault } from "@/app/components/ui/Card";
import { fieldClass, labelClass } from "@/app/components/ui/Field";
import { MockNote, MockShell } from "../MockShell";
import { ShareButtons } from "./ShareButtons";

// INVITE STAFF without an email service: the inviter picks role + team, and
// gets a short code and a link to send any way they like — copy, the phone's
// share sheet (Messages, WhatsApp, mail), or a QR code to scan in person.
// Single use, expires in 7 days.
const CODE = "K7QD-M2PX";
const LINK = "https://elite24mvp.vercel.app/invite/k7qdm2px9f3h";

export default async function PreviewInvite() {
  const qr = await QRCode.toString(LINK, { type: "svg", margin: 1, color: { dark: "#000000", light: "#ffffff" } });
  return (
    <MockShell badge={2} initials="CG" tabs="coach" active="Home">
      <header>
        <p className="e24-eyebrow">Organization View · Invites</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">Invite a coach</h1>
      </header>

      <section className={`${cardDefault} grid gap-3 sm:grid-cols-2`}>
        <div>
          <label className={labelClass} htmlFor="pv-role">Role</label>
          <select id="pv-role" className={fieldClass} defaultValue="ac">
            <option value="hc">Head Coach</option>
            <option value="ac">Assistant Coach</option>
            <option value="gm">General Manager</option>
            <option value="ga">Group Admin</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="pv-team">Team</label>
          <select id="pv-team" className={fieldClass} defaultValue="14b">
            <option value="14b">14U Mustang Black</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="pv-label">Who&apos;s it for? <span className="text-subtle">(only you see this)</span></label>
          <input id="pv-label" className={fieldClass} defaultValue="Coach Marcus" />
        </div>
      </section>

      <section className={`${cardDefault} flex flex-col items-center gap-4 text-center`}>
        <p className="text-sm text-muted">Send Coach Marcus this code or link. It works once and expires in 7 days.</p>
        <p className="rounded-xl border border-line-strong bg-sunken px-5 py-3 font-mono text-3xl font-black tracking-[0.2em] text-ink">{CODE}</p>
        <ShareButtons code={CODE} link={LINK} />
        <div className="flex flex-col items-center gap-1.5">
          {/* The QR keeps its own black-on-white in both modes so phones can read it. */}
          <div className="h-40 w-40 overflow-hidden rounded-xl border border-line" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="text-xs text-subtle">Or let them scan this in person</p>
        </div>
      </section>

      <MockNote>
        No email needed: the code and link go out by text, WhatsApp, or however you like. Opening the link walks them through
        making an account (or logging in) and puts them on the team as Assistant Coach.
      </MockNote>
    </MockShell>
  );
}
