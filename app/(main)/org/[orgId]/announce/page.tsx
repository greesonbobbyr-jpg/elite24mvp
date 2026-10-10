import { AnnouncementComposer } from "@/app/components/AnnouncementComposer";
import { SentAnnouncements } from "@/app/components/SentAnnouncements";
import { orgLookRecord, sendPlaces, sentList } from "@/lib/announcement-admin";
import { mediaEnabled } from "@/lib/mediaStore";
import { requireOrgAccess } from "../access";

// ORGANIZATION VIEW · ANNOUNCE — the organization's announcements: to the
// whole org, a group or a team (a group admin, their branch). They arrive
// in Notifications in the org's own color and logo; the CEO sending from
// here sends as Elite24.
export default async function OrgAnnouncePage({ params }: { params: Promise<{ orgId: string }> }) {
  const { ctx, access } = await requireOrgAccess(params);
  const [places, orgs, sent] = await Promise.all([
    sendPlaces(ctx, access.orgId),
    orgLookRecord([access.orgId]),
    sentList(ctx, access.orgId),
  ]);
  const asCeo = access.via === "ceo";
  const orgName = orgs[access.orgId]?.name ?? "";
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-3 sm:px-0">
      <AnnouncementComposer
        places={places}
        orgs={orgs}
        look={asCeo ? "elite24" : "org"}
        from={asCeo ? `${ctx.user.name} · CEO` : `${ctx.user.name} · ${orgName}`}
        picturesOn={mediaEnabled()}
      />
      <SentAnnouncements items={sent} empty="Nothing sent to this organization yet." />
    </section>
  );
}
