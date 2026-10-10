"use server";

import { revalidatePath } from "next/cache";
import {
  authorRoleFor,
  BODY_MAX,
  cleanLink,
  EXPIRY_CHOICES,
  markRead,
  MAX_PICTURES,
  mayDelete,
  maySend,
  targetOf,
  TITLE_MAX,
  type ExpiryChoice,
  type SendTarget,
} from "@/lib/announcements";
import { getCurrentContext } from "@/lib/context";
import { mediaStore } from "@/lib/mediaStore";
import { prisma } from "@/lib/prisma";
import { rateLimit, RATE_LIMITED_MESSAGE } from "@/lib/ratelimit";

// SENDING, DELETING AND READING ANNOUNCEMENTS (person-first plan Phase 5).
// Every check runs here from a fresh context — the form only says what was
// asked for. The same actions serve CEO View and Organization View.

// round: how many sent from this form so far — a new round empties it.
export type SendState = { error?: string; sent?: number; round?: number };

const int = (v: string | undefined) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isInteger(n) ? n : null;
};

/** "PLATFORM" | "ORG:<org>" | "GROUP:<org>:<group>" | "TEAM:<org>:<team>" */
function parseTarget(raw: FormDataEntryValue | null): SendTarget | null {
  const [scope, a, b] = String(raw ?? "").split(":");
  const org = int(a);
  const id = int(b);
  if (scope === "PLATFORM") return { scope };
  if (scope === "ORG" && org != null) return { scope, organizationId: org };
  if (scope === "GROUP" && org != null && id != null) return { scope, organizationId: org, groupId: id };
  if (scope === "TEAM" && org != null && id != null) return { scope, organizationId: org, teamId: id };
  return null;
}

export async function sendAnnouncement(prev: SendState, formData: FormData): Promise<SendState> {
  const result = await send(formData);
  return "sent" in result ? { sent: result.sent, round: (prev.round ?? 0) + 1 } : { error: result.error, round: prev.round ?? 0 };
}

async function send(formData: FormData): Promise<{ error: string } | { sent: number }> {
  const ctx = await getCurrentContext();
  if (!ctx?.profile) return { error: "Please log in again." };
  const target = parseTarget(formData.get("target"));
  if (!target) return { error: "Pick who it's for." };
  if (!(await maySend(ctx, target))) return { error: "You can't send to that place." };

  const audience = String(formData.get("audience"));
  if (audience !== "EVERYONE" && audience !== "PLAYERS" && audience !== "STAFF") return { error: "Pick who sees it." };
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title) return { error: "Add a title." };
  if (title.length > TITLE_MAX) return { error: `Keep the title under ${TITLE_MAX} characters.` };
  if (body.length > BODY_MAX) return { error: `Keep the message under ${BODY_MAX} characters.` };
  const link = cleanLink(formData.get("linkUrl"));
  if (!link.ok) return { error: "Video links can be YouTube, Vimeo or Hudl (https://…)." };
  const expiry = String(formData.get("expires")) as ExpiryChoice;
  if (!(expiry in EXPIRY_CHOICES)) return { error: "Pick when it disappears." };
  const mediaIds = [...new Set(formData.getAll("mediaId").map(String))];
  if (mediaIds.length > MAX_PICTURES) return { error: `Up to ${MAX_PICTURES} pictures.` };
  if (mediaIds.length > 0 && !mediaStore()) return { error: "Pictures are off right now. Send it without them." };

  if (!(await rateLimit("announcement-send", String(ctx.profile.id), 20, 3600))) return { error: RATE_LIMITED_MESSAGE };

  const now = new Date();
  const lifetime = EXPIRY_CHOICES[expiry];
  const authorRole = authorRoleFor(ctx, target);
  const profileId = ctx.profile.id;
  const created = await prisma.$transaction(async (tx) => {
    const a = await tx.announcement.create({
      data: {
        scope: target.scope,
        organizationId: target.scope === "PLATFORM" ? null : target.organizationId,
        groupId: target.scope === "GROUP" ? target.groupId : null,
        teamId: target.scope === "TEAM" ? target.teamId : null,
        audience,
        title,
        body,
        linkUrl: link.url,
        authorProfileId: profileId,
        authorRole,
        publishedAt: now,
        expiresAt: lifetime == null ? null : new Date(now.getTime() + lifetime),
      },
    });
    if (mediaIds.length > 0) {
      // Only this person's own unsent uploads.
      const attached = await tx.mediaAsset.updateMany({
        where: { id: { in: mediaIds }, uploadedByProfileId: profileId, announcementId: null, deletedAt: null },
        data: { announcementId: a.id },
      });
      if (attached.count !== mediaIds.length) throw new Error("picture-mismatch");
    }
    await tx.auditEvent.create({
      data: {
        actorProfileId: profileId,
        action: authorRole === "CEO" ? "ceo.announcement.sent" : "announcement.sent",
        organizationId: a.organizationId,
        teamId: a.teamId,
        detail: title,
      },
    });
    return a;
  }).catch((e: unknown) => {
    if (e instanceof Error && e.message === "picture-mismatch") return null;
    throw e;
  });
  if (!created) return { error: "A picture didn't upload. Remove it and try again." };

  revalidatePath("/", "layout");
  return { sent: created.id };
}

export async function deleteAnnouncement(formData: FormData): Promise<void> {
  const ctx = await getCurrentContext();
  const id = int(String(formData.get("announcementId") ?? ""));
  if (!ctx?.profile || id == null) return;
  const a = await prisma.announcement.findUnique({ where: { id }, include: { media: { where: { deletedAt: null } } } });
  if (!a || a.deletedAt) return;
  if (!(await mayDelete(ctx, a))) return;

  const now = new Date();
  await prisma.announcement.update({ where: { id }, data: { deletedAt: now } });
  await prisma.auditEvent.create({
    data: {
      actorProfileId: ctx.profile.id,
      action: ctx.platformRole === "CEO" && authorRoleFor(ctx, targetOf(a)) === "CEO" ? "ceo.announcement.deleted" : "announcement.deleted",
      organizationId: a.organizationId,
      teamId: a.teamId,
      detail: a.title,
    },
  });
  // Pictures go now; if storage is down, the hourly cleanup retries.
  const store = mediaStore();
  if (store && a.media.length > 0) {
    try {
      await store.remove(a.media.map((m) => m.storageKey));
      await prisma.mediaAsset.updateMany({ where: { id: { in: a.media.map((m) => m.id) } }, data: { deletedAt: now } });
    } catch {
      // left for /api/cron/expire-media
    }
  }
  revalidatePath("/", "layout");
}

export async function markAnnouncementRead(formData: FormData): Promise<void> {
  const ctx = await getCurrentContext();
  const id = int(String(formData.get("announcementId") ?? ""));
  if (!ctx || id == null) return;
  if (await markRead(ctx, id)) revalidatePath("/", "layout");
}

