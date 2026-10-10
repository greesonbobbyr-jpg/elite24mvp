"use client";

import { useActionState, useRef, useState } from "react";
import { sendAnnouncement, type SendState } from "@/app/(main)/announcements/actions";
import { AnnouncementCard, type AnnouncementView } from "./AnnouncementCard";
import { Button } from "./ui/Button";
import { cardDefault } from "./ui/Card";
import { Banner } from "./ui/Banner";
import { fieldClass, labelClass } from "./ui/Field";
import { pillClass } from "./ui/Pill";
import { BODY_MAX, MAX_PICTURES, PICTURE_EDGE, TITLE_MAX } from "@/lib/announcement-limits";
import { shrinkToJpeg } from "@/lib/clientImage";

// SEND AN ANNOUNCEMENT — the same composer in CEO View (everyone, or any
// org / group / team) and Organization View (the org, a group, a team;
// group admins their branch only). The server re-checks everything; the
// places offered here are only the ones this person may send to.

// value: the form's target ("ORG:3", "TEAM:3:12"); label: the picker's line;
// name: the place on the card ("17U Boys Black").
export type Place = { value: string; label: string; name: string; scope: "PLATFORM" | "ORG" | "GROUP" | "TEAM"; orgId: number | null };

const SCOPE_PILL: Record<Place["scope"], string> = {
  PLATFORM: "Everyone",
  ORG: "Whole organization",
  GROUP: "A group",
  TEAM: "A team",
};
const AUDIENCES = [
  { value: "EVERYONE", label: "Everyone" },
  { value: "PLAYERS", label: "Players" },
  { value: "STAFF", label: "Coaches & staff" },
] as const;
const EXPIRIES = [
  { value: "24h", label: "24 hours", chip: "Disappears in 23h" },
  { value: "7d", label: "7 days", chip: "Disappears in 7 days" },
  { value: "keep", label: "Keep", chip: null },
] as const;

type Picture = { id: string; width: number; height: number };

export function AnnouncementComposer({
  places,
  orgs,
  look,
  from,
  picturesOn,
}: {
  places: Place[];
  orgs: Record<number, { name: string; color: string | null; logoUrl: string | null }>;
  look: "elite24" | "org";
  from: string;
  picturesOn: boolean;
}) {
  const [state, action, pending] = useActionState<SendState, FormData>(sendAnnouncement, {});
  // A new, empty form after each send (an error keeps what was typed).
  return <ComposerForm key={state.round ?? 0} {...{ places, orgs, look, from, picturesOn, state, action, pending }} />;
}

function ComposerForm({
  places,
  orgs,
  look,
  from,
  picturesOn,
  state,
  action,
  pending,
}: {
  places: Place[];
  orgs: Record<number, { name: string; color: string | null; logoUrl: string | null }>;
  look: "elite24" | "org";
  from: string;
  picturesOn: boolean;
  state: SendState;
  action: (f: FormData) => void;
  pending: boolean;
}) {
  const scopes = [...new Set(places.map((p) => p.scope))];
  const [scope, setScope] = useState<Place["scope"]>(scopes[0]);
  const inScope = places.filter((p) => p.scope === scope);
  const [target, setTarget] = useState(inScope[0]?.value ?? "");
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]["value"]>("EVERYONE");
  const [expires, setExpires] = useState<(typeof EXPIRIES)[number]["value"]>("24h");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [uploading, setUploading] = useState(0);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const place = places.find((p) => p.value === target);
  const org = place?.orgId != null ? (orgs[place.orgId] ?? null) : null;

  function pickScope(next: Place["scope"]) {
    setScope(next);
    setTarget(places.find((p) => p.scope === next)?.value ?? "");
  }

  async function addPictures(files: FileList | null) {
    if (!files) return;
    setPictureError(null);
    const room = MAX_PICTURES - pictures.length;
    for (const file of [...files].slice(0, room)) {
      setUploading((n) => n + 1);
      try {
        const jpeg = await shrinkToJpeg(file, PICTURE_EDGE);
        if (!jpeg) throw new Error("That file isn't a picture we can use.");
        const res = await fetch("/api/media", { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: jpeg });
        if (!res.ok) throw new Error(res.status === 429 ? "Too many pictures this hour. Try later." : "A picture didn't upload. Try again.");
        const made = (await res.json()) as Picture;
        setPictures((p) => (p.length < MAX_PICTURES ? [...p, made] : p));
      } catch (e) {
        setPictureError(e instanceof Error ? e.message : "A picture didn't upload. Try again.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (files.length > room) setPictureError(`Up to ${MAX_PICTURES} pictures.`);
    if (fileRef.current) fileRef.current.value = "";
  }

  const preview: AnnouncementView = {
    id: 0,
    look,
    title: title || "Your title",
    body,
    linkUrl: /^https:\/\/\S+$/.test(link) ? link : null,
    pictures,
    org,
    to:
      place?.scope === "PLATFORM"
        ? audience === "EVERYONE"
          ? "everyone on Elite24MVP"
          : `${AUDIENCES.find((a) => a.value === audience)!.label.toLowerCase()} on Elite24MVP`
        : `${AUDIENCES.find((a) => a.value === audience)!.label} · ${place?.name ?? ""}`,
    from,
    when: "Just now",
    expires: EXPIRIES.find((e) => e.value === expires)!.chip,
    unread: true,
  };

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <form action={action} className={`${cardDefault} flex min-w-0 flex-col gap-4`}>
        {state.sent && <Banner tone="good">✓ Sent. It&apos;s in their Notifications now.</Banner>}
        {state.error && <Banner tone="accent" role="alert">{state.error}</Banner>}

        <div>
          <p className={labelClass}>Send to</p>
          {scopes.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {scopes.map((s) => (
                <button key={s} type="button" onClick={() => pickScope(s)} className={pillClass(scope === s, "sm")} aria-pressed={scope === s}>
                  {SCOPE_PILL[s]}
                </button>
              ))}
            </div>
          )}
          {scope === "PLATFORM" ? (
            <p className="mt-2 text-sm text-ink-mid">Everyone on Elite24MVP — every organization, and players training on their own.</p>
          ) : (
            <select
              aria-label="Which one"
              className={`${fieldClass} mt-2`}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              {inScope.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
          <input type="hidden" name="target" value={target} />
        </div>

        <div>
          <p className={labelClass}>Who sees it</p>
          <div className="flex flex-wrap gap-1.5">
            {AUDIENCES.map((a) => (
              <button key={a.value} type="button" onClick={() => setAudience(a.value)} className={pillClass(audience === a.value, "sm")} aria-pressed={audience === a.value}>
                {a.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="audience" value={audience} />
        </div>

        <div>
          <label className={labelClass} htmlFor="ann-title">
            Title
          </label>
          <input id="ann-title" name="title" required maxLength={TITLE_MAX} className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="ann-body">
            Message
          </label>
          <textarea id="ann-body" name="body" rows={4} maxLength={BODY_MAX} className={fieldClass} value={body} onChange={(e) => setBody(e.target.value)} />
          <p className="mt-1 text-right text-[11px] text-subtle">
            {body.length}/{BODY_MAX}
          </p>
        </div>

        {picturesOn && (
          <div>
            <p className={labelClass}>Pictures <span className="text-subtle">(up to {MAX_PICTURES})</span></p>
            <div className="flex flex-wrap gap-2">
              {pictures.map((p) => (
                <div key={p.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private, session-checked bytes */}
                  <img src={`/api/media/${p.id}`} alt="" className="h-20 w-16 rounded-xl bg-sunken object-cover" />
                  <input type="hidden" name="mediaId" value={p.id} />
                  <button
                    type="button"
                    onClick={() => setPictures((all) => all.filter((x) => x.id !== p.id))}
                    aria-label="Remove picture"
                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-line-strong bg-panel text-xs font-bold text-ink"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {pictures.length + uploading < MAX_PICTURES && (
                <label className="flex h-20 w-16 cursor-pointer items-center justify-center rounded-xl border border-dashed border-field-line bg-sunken text-2xl text-muted hover:border-accent-edge">
                  <span aria-hidden>+</span>
                  <span className="sr-only">Add pictures</span>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addPictures(e.target.files)} />
                </label>
              )}
              {uploading > 0 && <span className="flex h-20 items-center text-xs text-muted">Uploading…</span>}
            </div>
            {pictureError && <p className="mt-1 text-xs font-semibold text-brand" role="alert">{pictureError}</p>}
            <p className="mt-1 text-xs text-subtle">Pictures are made smaller on your phone, and location is removed.</p>
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="ann-link">
            Video link <span className="text-subtle">(YouTube, Vimeo or Hudl)</span>
          </label>
          <input id="ann-link" name="linkUrl" type="url" inputMode="url" placeholder="https://youtu.be/…" className={fieldClass} value={link} onChange={(e) => setLink(e.target.value)} />
        </div>

        <div>
          <p className={labelClass}>Disappears after</p>
          <div className="flex flex-wrap gap-1.5">
            {EXPIRIES.map((e) => (
              <button key={e.value} type="button" onClick={() => setExpires(e.value)} className={pillClass(expires === e.value, "sm")} aria-pressed={expires === e.value}>
                {e.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="expires" value={expires} />
          <p className="mt-1 text-xs text-subtle">When it disappears, its pictures are deleted for good.</p>
        </div>

        <Button type="submit" disabled={pending || uploading > 0 || !target}>
          {pending ? "Sending…" : "Send announcement"}
        </Button>
      </form>

      <section className="flex min-w-0 flex-col gap-2" aria-label="Preview">
        <p className="e24-eyebrow">What they&apos;ll see</p>
        <AnnouncementCard a={preview} />
      </section>
    </div>
  );
}
