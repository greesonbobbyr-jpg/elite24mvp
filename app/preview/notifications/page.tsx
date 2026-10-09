import { CoachAlert, Elite24Announcement, OrgAnnouncement, Poster } from "../AnnouncementCards";
import { MockNote, MockShell } from "../MockShell";

// NOTIFICATIONS with all three kinds of message, and the unread number on ☰.
export default function PreviewNotifications() {
  return (
    <MockShell badge={3} tabs="player" active="Home">
      <header>
        <p className="e24-eyebrow">Notifications</p>
        <p className="mt-1 text-sm text-subtle">From Elite24, your organization and your coach</p>
      </header>

      <h2 className="e24-eyebrow">To read · 3</h2>

      <Elite24Announcement
        title="See it. Say it. Sketch it. Feel it."
        body="Before practice today, close your eyes for 30 seconds and see yourself making the play. Then go make it."
        media={<Poster line="Value the ball." sub="Most Valuable Process" />}
        expires="Disappears in 23h"
      />

      <OrgAnnouncement
        org="Mustang Basketball Club"
        color="#c8102e"
        logo="/mustang-logo.png"
        to="Boys · 16U and 17U"
        title="Spring tryouts — Saturday 9 AM"
        body="Main gym. Bring water, a ball, and your best attitude. Parents can watch from the bleachers."
        expires="Disappears in 7 days"
      />

      <CoachAlert title="Practice moved to 5 PM today" body="Same gym. Eat early, be on time." />

      <section>
        <p className="e24-eyebrow mb-2">Earlier</p>
        <ul className="flex flex-col gap-1.5">
          {["Great hustle on Saturday", "Welcome to Elite24MVP!"].map((t) => (
            <li key={t} className="flex items-center gap-2.5 rounded-xl border border-line bg-panel px-3 py-2.5 text-sm text-muted shadow-sm shadow-shade">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-good-solid text-[11px] font-bold text-on-accent">✓</span>
              {t}
            </li>
          ))}
        </ul>
      </section>

      <MockNote>
        Every unread message adds to the number on ☰ (and on the coach&apos;s Alerts tab). Elite24 messages wear the black and
        gold frame; an organization&apos;s wear its own color and logo; coach alerts stay as they are. Pictures can disappear on
        their own after 24 hours or 7 days.
      </MockNote>
    </MockShell>
  );
}
