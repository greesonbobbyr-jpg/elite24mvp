import { AnnouncementComposer } from "@/app/components/AnnouncementComposer";
import { SentAnnouncements } from "@/app/components/SentAnnouncements";
import { orgLookRecord, sendPlaces, sentList } from "@/lib/announcement-admin";
import { getCurrentContext } from "@/lib/context";
import { mediaEnabled } from "@/lib/mediaStore";
import { requireCeo } from "../gate";

// CEO View · Announce — Elite24 announcements: to everyone, or to any
// organization, group or team. They arrive in Notifications as the black
// and gold Elite24 card.
export default async function CeoAnnouncePage() {
  await requireCeo();
  const ctx = (await getCurrentContext())!;
  const places = await sendPlaces(ctx, null);
  const orgIds = [...new Set(places.map((p) => p.orgId).filter((x): x is number => x != null))];
  const [orgs, sent] = await Promise.all([orgLookRecord(orgIds), sentList(ctx, null)]);
  return (
    <div className="flex flex-col gap-6">
      <AnnouncementComposer places={places} orgs={orgs} look="elite24" from={`${ctx.user.name} · CEO`} picturesOn={mediaEnabled()} />
      <SentAnnouncements items={sent} empty="Nothing sent yet." />
    </div>
  );
}
