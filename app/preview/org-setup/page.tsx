"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, buttonClass } from "@/app/components/ui/Button";
import { cardDefault, rowNested } from "@/app/components/ui/Card";
import { fieldClass, labelClass } from "@/app/components/ui/Field";
import { chipClass, pillClass } from "@/app/components/ui/Pill";
import { AuthFrame, MockNote } from "../MockShell";

// START AN ORGANIZATION — the setup wizard. The structure step is the
// "every possible level" design: one flexible tree of groups (any mix of
// Boys/Girls, age groups, grade levels, schools…, up to 4 levels deep), with
// teams at the ends. Templates fill it in; everything stays editable later.

type Node = { name: string; kind: string; children?: Node[]; teams?: string[] };
type Template = "one" | "club" | "school" | "district" | "custom";

const AGES = ["8U", "9U", "10U", "11U", "12U", "13U", "14U", "15U", "16U", "17U"];
const LEVELS = { jh: ["7th Grade", "8th Grade"], hs: ["Freshman", "JV", "Varsity"] };

function buildTree(t: Template, org: string, genders: string[], ages: string[], split: boolean): Node[] {
  const genderWrap = (inner: (g: string) => Node[]): Node[] =>
    genders.length > 1 ? genders.map((g) => ({ name: g, kind: "Program", children: inner(g) })) : inner(genders[0] ?? "");
  const school = (): Node[] => [
    { name: "Junior High", kind: "Level", children: (split ? genderWrap : (f: (g: string) => Node[]) => f(""))((g) => LEVELS.jh.map((l) => ({ name: l, kind: "Grade", teams: [`${g ? g + " " : ""}${l}`] }))) },
    { name: "High School", kind: "Level", children: (split ? genderWrap : (f: (g: string) => Node[]) => f(""))((g) => LEVELS.hs.map((l) => ({ name: l, kind: "Level", teams: [`${g ? g + " " : ""}${l}`] }))) },
  ];
  switch (t) {
    case "one":
      return [{ name: org, kind: "Team", teams: [org] }];
    case "club":
      return genderWrap((g) => ages.map((a) => ({ name: a, kind: "Age group", teams: [`${org} ${a}${g ? " " + g : ""} Black`, `${org} ${a}${g ? " " + g : ""} Red`] })));
    case "school":
      return school();
    case "district":
      return ["Lincoln High School", "Washington Middle School"].map((s) => ({ name: s, kind: "School", children: school().slice(s.includes("Middle") ? 0 : 1, s.includes("Middle") ? 1 : 2) }));
    default:
      return [];
  }
}

function countTeams(nodes: Node[]): number {
  return nodes.reduce((n, x) => n + (x.teams?.length ?? 0) + countTeams(x.children ?? []), 0);
}

function Tree({ nodes, depth = 0 }: { nodes: Node[]; depth?: number }) {
  return (
    <ul className={depth ? "ml-3 border-l border-line pl-3" : ""}>
      {nodes.map((n) => (
        <li key={n.name} className="py-1">
          <span className="flex items-center gap-2">
            <span className="font-semibold text-ink">{n.name}</span>
            <span className={chipClass("neutral")}>{n.kind}</span>
          </span>
          {n.children && <Tree nodes={n.children} depth={depth + 1} />}
          {n.teams && depth + (n.children ? 1 : 0) >= 0 && (
            <ul className="ml-3 border-l border-line pl-3">
              {n.teams.map((t) => (
                <li key={t} className="py-0.5 text-sm text-muted">🏀 {t}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

const TEMPLATES: { key: Template; title: string; line: string }[] = [
  { key: "one", title: "Just one team", line: "A single team. No groups at all." },
  { key: "club", title: "Club", line: "Boys and/or Girls, then age groups (8U–17U), then teams." },
  { key: "school", title: "School", line: "Junior High (7th, 8th) and High School (Freshman, JV, Varsity)." },
  { key: "district", title: "District", line: "Several schools, each with its own levels and teams." },
  { key: "custom", title: "Build my own", line: "Start empty and add any groups you want, up to 4 levels deep." },
];

export default function PreviewOrgSetup() {
  const [step, setStep] = useState(1);
  const [template, setTemplate] = useState<Template>("club");
  const [genders, setGenders] = useState(["Boys", "Girls"]);
  const [ages, setAges] = useState(["14U", "15U", "16U", "17U"]);
  const [split, setSplit] = useState(true);
  const org = "Mustang";
  const tree = buildTree(template, org, genders, ages, split);
  const toggle = (list: string[], v: string, set: (l: string[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <AuthFrame subtitle={`Start an Organization · Step ${step} of 4`}>
      <ol className="flex gap-1.5" aria-label="Progress">
        {[1, 2, 3, 4].map((n) => (
          <li key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-accent" : "bg-raised-2"}`} />
        ))}
      </ol>

      {step === 1 && (
        <section className={`${cardDefault} flex flex-col gap-3`}>
          <p className={`${chipClass("good")} w-fit`}>✓ Organization code accepted</p>
          <div>
            <label className={labelClass} htmlFor="pv-org">Organization name</label>
            <input id="pv-org" className={fieldClass} defaultValue="Mustang Basketball Club" />
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-field-line bg-sunken p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mustang-logo.png" alt="" className="h-12 w-12 rounded-lg bg-frame object-contain p-1" />
            <span className="text-sm text-ink-mid">Logo added · <span className="text-subtle">change</span></span>
          </div>
          <div>
            <p className={labelClass}>Team color</p>
            <div className="flex gap-2">
              {["#c8102e", "#0b3d91", "#f2a900", "#1f1f1f"].map((c, i) => (
                <span key={c} className={`h-9 w-9 rounded-full border-2 ${i === 0 ? "border-ink" : "border-line"}`} style={{ background: c }} />
              ))}
            </div>
          </div>
          <Button onClick={() => setStep(2)}>Next: how your organization is set up</Button>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-muted">Pick the closest starting point. You can rename, add or move anything later.</p>
          <ul className="flex flex-col gap-2">
            {TEMPLATES.map((t) => (
              <li key={t.key}>
                <button
                  type="button"
                  onClick={() => setTemplate(t.key)}
                  className={`${cardDefault} w-full p-3.5 text-left ${template === t.key ? "border-accent-edge ring-1 ring-accent-edge" : ""}`}
                >
                  <span className="block font-bold text-ink">{t.title}</span>
                  <span className="block text-sm text-muted">{t.line}</span>
                </button>
              </li>
            ))}
          </ul>

          {(template === "club" || template === "school" || template === "district") && (
            <div className={`${cardDefault} flex flex-col gap-3 p-4`}>
              {template === "club" && (
                <>
                  <p className="text-xs font-bold uppercase tracking-wide text-subtle">Programs</p>
                  <div className="flex gap-2">
                    {["Boys", "Girls"].map((g) => (
                      <button key={g} type="button" onClick={() => toggle(genders, g, setGenders)} className={pillClass(genders.includes(g))}>{g}</button>
                    ))}
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wide text-subtle">Age groups</p>
                  <div className="flex flex-wrap gap-1.5">
                    {AGES.map((a) => (
                      <button key={a} type="button" onClick={() => toggle(ages, a, setAges)} className={pillClass(ages.includes(a), "sm")}>{a}</button>
                    ))}
                  </div>
                </>
              )}
              {template !== "club" && (
                <label className="flex items-center gap-2 text-sm text-ink-mid">
                  <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} className="h-4 w-4 accent-accent" />
                  Separate Boys and Girls
                </label>
              )}
            </div>
          )}

          <div className={`${cardDefault} p-4`}>
            <div className="flex items-baseline justify-between">
              <p className="e24-eyebrow">Preview</p>
              <span className="text-xs text-subtle">{countTeams(tree)} teams</span>
            </div>
            <div className="mt-2 max-h-80 overflow-y-auto">
              {tree.length ? <Tree nodes={tree} /> : <p className="text-sm text-subtle">Empty — add your first group or team.</p>}
            </div>
          </div>
          <Button onClick={() => setStep(3)}>Next: teams</Button>
        </section>
      )}

      {step === 3 && (
        <section className={`${cardDefault} flex flex-col gap-3`}>
          <p className="text-sm text-muted">These are your teams. Rename them or add more — each gets its own join code for players.</p>
          <ul className="flex flex-col gap-1.5">
            {["Mustang 17U Boys Black", "Mustang 17U Boys Red", "Mustang 16U Girls Black", "Mustang 15U Girls Black"].map((t) => (
              <li key={t} className={`${rowNested} flex items-center justify-between px-3 py-2 text-sm`}>
                <span className="font-semibold text-ink">{t}</span>
                <span className="font-mono text-xs text-subtle">code made</span>
              </li>
            ))}
            <li className="px-1 text-sm font-semibold text-brand">+ Add a team</li>
          </ul>
          <Button onClick={() => setStep(4)}>Next: coaches</Button>
        </section>
      )}

      {step === 4 && (
        <section className={`${cardDefault} flex flex-col gap-3`}>
          <p className="text-sm text-muted">Who coaches each team? Invite them now or later from Organization View.</p>
          <ul className="flex flex-col gap-2">
            {[
              ["Mustang 17U Boys Black", "me"],
              ["Mustang 17U Boys Red", "invite"],
              ["Mustang 16U Girls Black", "later"],
            ].map(([t, pick]) => (
              <li key={t} className={`${rowNested} px-3 py-2.5`}>
                <p className="text-sm font-semibold text-ink">{t}</p>
                <div className="mt-2 flex gap-1.5">
                  <span className={pillClass(pick === "me", "sm")}>I coach it</span>
                  <span className={pillClass(pick === "invite", "sm")}>Invite a coach</span>
                  <span className={pillClass(pick === "later", "sm")}>Later</span>
                </div>
              </li>
            ))}
          </ul>
          <Link href="/preview/invite" className={`${buttonClass("primary")} w-full`}>Finish — invite my coaches</Link>
        </section>
      )}

      <MockNote>
        Any shape works: Boys/Girls → age groups, Junior High/JV/Varsity, schools in a district, or your own. A part of the
        organization can get its own admin (a Girls Director, a school&apos;s athletic director) who only manages that part.
      </MockNote>
    </AuthFrame>
  );
}
