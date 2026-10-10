import type { SentItem } from "@/lib/announcement-admin";
import { AnnouncementCard } from "./AnnouncementCard";
import { DeleteAnnouncement } from "./DeleteAnnouncement";

// What's been sent, newest first: each card as people see it, with how many
// of the people it's for have opened it.
export function SentAnnouncements({ items, empty }: { items: SentItem[]; empty: string }) {
  return (
    <section className="flex flex-col gap-3" aria-label="Sent">
      <h2 className="e24-eyebrow">Sent</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        items.map((s) => (
          <div key={s.view.id} className="flex flex-col gap-2">
            <div className={s.status === "gone" ? "opacity-60" : undefined}>
              <AnnouncementCard a={s.view} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <p className="text-sm font-semibold text-ink-mid">
                {s.status === "gone" ? "Disappeared · " : ""}
                {`Seen by ${s.seen} of ${s.of}`}
              </p>
              {s.canDelete && s.status === "live" && <DeleteAnnouncement id={s.view.id} />}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
