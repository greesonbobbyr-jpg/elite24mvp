"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { cardDefault } from "@/app/components/ui/Card";
import { fieldClass, labelClass } from "@/app/components/ui/Field";
import { pillClass } from "@/app/components/ui/Pill";
import { Elite24Announcement, OrgAnnouncement, Poster } from "../AnnouncementCards";
import { MockNote, MockShell } from "../MockShell";

// SEND AN ANNOUNCEMENT — the same composer in CEO View (any scope) and
// Organization View (its own org, a group, or a team). Pictures can
// disappear on their own; video comes as a link (or, later, a short clip).
type From = "ceo" | "org";
type Scope = "everyone" | "orgs" | "group" | "team";

export default function PreviewCompose() {
  const [from, setFrom] = useState<From>("ceo");
  const [scope, setScope] = useState<Scope>("everyone");
  const [audience, setAudience] = useState("Everyone");
  const [expiry, setExpiry] = useState("24 hours");
  const [title, setTitle] = useState("See it. Say it. Sketch it. Feel it.");
  const [body, setBody] = useState("Before practice today, close your eyes for 30 seconds and see yourself making the play.");
  const scopes: { key: Scope; label: string }[] =
    from === "ceo"
      ? [{ key: "everyone", label: "Everyone" }, { key: "orgs", label: "Organizations" }, { key: "group", label: "A group" }, { key: "team", label: "A team" }]
      : [{ key: "everyone", label: "Whole org" }, { key: "group", label: "A group" }, { key: "team", label: "A team" }];

  const expires = expiry === "Keep" ? undefined : `Disappears in ${expiry === "24 hours" ? "24h" : "7 days"}`;

  return (
    <MockShell badge={0} initials="GH" wide>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="e24-eyebrow">{from === "ceo" ? "CEO View" : "Organization View"}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">New announcement</h1>
        </div>
        <div className="flex gap-2" aria-label="Mockup: send as">
          <button type="button" onClick={() => { setFrom("ceo"); setScope("everyone"); }} className={pillClass(from === "ceo", "sm")}>As CEO</button>
          <button type="button" onClick={() => { setFrom("org"); setScope("everyone"); }} className={pillClass(from === "org", "sm")}>As an org</button>
        </div>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <section className={`${cardDefault} flex flex-col gap-4`}>
          <div>
            <p className={labelClass}>Send to</p>
            <div className="flex flex-wrap gap-1.5">
              {scopes.map((s) => (
                <button key={s.key} type="button" onClick={() => setScope(s.key)} className={pillClass(scope === s.key, "sm")}>{s.label}</button>
              ))}
            </div>
            {scope !== "everyone" && (
              <select className={`${fieldClass} mt-2`} defaultValue="a">
                <option value="a">
                  {scope === "orgs" ? "Mustang Basketball Club, Lincoln School District" : scope === "group" ? "Mustang · Boys · 16U and 17U" : "Mustang 17U Boys Black"}
                </option>
              </select>
            )}
          </div>
          <div>
            <p className={labelClass}>Who sees it</p>
            <div className="flex gap-1.5">
              {["Everyone", "Players", "Coaches & staff"].map((a) => (
                <button key={a} type="button" onClick={() => setAudience(a)} className={pillClass(audience === a, "sm")}>{a}</button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="pv-title">Title</label>
            <input id="pv-title" className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="pv-body">Message</label>
            <textarea id="pv-body" rows={3} className={fieldClass} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div>
            <p className={labelClass}>Pictures</p>
            <div className="flex gap-2">
              <div className="w-16"><Poster line="Value" /></div>
              <span className="flex aspect-[4/5] w-16 items-center justify-center rounded-xl border border-dashed border-field-line bg-sunken text-xl text-muted">+</span>
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="pv-video">Video link <span className="text-subtle">(YouTube, Vimeo or Hudl)</span></label>
            <input id="pv-video" className={fieldClass} placeholder="https://youtu.be/…" />
          </div>
          <div>
            <p className={labelClass}>Disappears after</p>
            <div className="flex gap-1.5">
              {["24 hours", "7 days", "Keep"].map((e) => (
                <button key={e} type="button" onClick={() => setExpiry(e)} className={pillClass(expiry === e, "sm")}>{e}</button>
              ))}
            </div>
            <p className="mt-1 text-xs text-subtle">When it disappears, its pictures are deleted for good.</p>
          </div>
          <Button>Send announcement</Button>
        </section>

        <section className="flex flex-col gap-2">
          <p className="e24-eyebrow">What they&apos;ll see</p>
          {from === "ceo" ? (
            <Elite24Announcement title={title} body={body} media={<Poster line="Value the ball." sub="Most Valuable Process" />} expires={expires} action={false} />
          ) : (
            <OrgAnnouncement
              org="Mustang Basketball Club"
              color="#c8102e"
              logo="/mustang-logo.png"
              to={scope === "everyone" ? "Everyone" : scope === "group" ? "Boys · 16U and 17U" : "17U Boys Black"}
              title={title}
              body={body}
              media={<Poster line="Value the ball." />}
              expires={expires}
            />
          )}
          <p className="text-xs text-subtle">After it&apos;s sent you&apos;ll see &ldquo;Seen by 41 of 96&rdquo;.</p>
        </section>
      </div>

      <MockNote>
        Gary can send to everyone, chosen organizations, a group or a team. An organization (or a group admin) sends within its
        own part. Short video clips can be added later in the same way, also disappearing on their own.
      </MockNote>
    </MockShell>
  );
}
