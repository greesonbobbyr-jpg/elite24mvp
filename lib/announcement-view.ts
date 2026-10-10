import type { Announcement, AnnouncementAudience } from "@prisma/client";
import type { AnnouncementView } from "@/app/components/AnnouncementCard";
import { formatDateTime } from "./format";

// Turns an announcement into what its card shows (server side, so times
// are worked out once).

export const AUDIENCE_LABEL: Record<AnnouncementAudience, string> = {
  EVERYONE: "Everyone",
  PLAYERS: "Players",
  STAFF: "Coaches & staff",
};

export function expiryText(expiresAt: Date | null, now = new Date()): string | null {
  if (!expiresAt) return null;
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) return "Gone";
  const hours = Math.floor(ms / 3600_000);
  if (hours < 1) return "Disappears within the hour";
  if (hours < 24) return `Disappears in ${hours}h`;
  const days = Math.round(hours / 24);
  return `Disappears in ${days} day${days === 1 ? "" : "s"}`;
}

export function toLabel(a: Pick<Announcement, "scope" | "audience">, place: string | null): string {
  const who = AUDIENCE_LABEL[a.audience];
  if (a.scope === "PLATFORM") return a.audience === "EVERYONE" ? "everyone on Elite24MVP" : `${who.toLowerCase()} on Elite24MVP`;
  return `${who} · ${place ?? ""}`;
}

export function fromLabel(authorRole: string, authorName: string, orgName: string | null): string {
  if (authorRole === "CEO") return `${authorName} · CEO`;
  return orgName ? `${authorName} · ${orgName}` : authorName;
}

export function announcementView(
  a: Pick<Announcement, "id" | "scope" | "audience" | "title" | "body" | "linkUrl" | "authorRole" | "publishedAt" | "expiresAt"> & {
    media: { id: string; width: number | null; height: number | null }[];
    org: AnnouncementView["org"];
    place: string | null;
    authorName: string;
  },
  unread: boolean,
  now = new Date(),
): AnnouncementView {
  return {
    id: a.id,
    look: a.authorRole === "CEO" ? "elite24" : "org",
    title: a.title,
    body: a.body,
    linkUrl: a.linkUrl,
    pictures: a.media,
    org: a.org,
    to: toLabel(a, a.place),
    from: fromLabel(a.authorRole, a.authorName, a.org?.name ?? null),
    when: formatDateTime(a.publishedAt),
    expires: expiryText(a.expiresAt, now),
    unread,
  };
}
