import type { GroupKind } from "@prisma/client";
import { MAX_GROUP_DEPTH } from "./group-limits";

// STARTING SHAPES for an organization's group tree (owner, 2026-10-09: "every
// possible level" — Boys/Girls, age groups, JH/JV/Varsity, sub-orgs/schools).
// Pure: a template is just the groups it would create; the caller writes them
// (and the org can rename, move or delete any of it afterwards).
//
//   one-team  no groups — the team sits directly under the organization
//   club      Boys / Girls → age groups (8U–17U); one side → just the ages
//   school    Junior High (7th, 8th) and/or High School (Freshman, JV,
//             Varsity), optionally split Boys / Girls first
//   district  Schools → each shaped like a school
//   custom    empty — build it by hand

export type TemplateNode = { name: string; kind: GroupKind; children?: TemplateNode[] };

export type SchoolLevels = { juniorHigh: boolean; highSchool: boolean; splitGenders: boolean };

export type TemplateChoice =
  | { template: "one-team" }
  | { template: "custom" }
  | { template: "club"; genders: ("Boys" | "Girls")[]; ages: number[] }
  | ({ template: "school" } & SchoolLevels)
  | ({ template: "district"; schools: string[] } & SchoolLevels);

export const CLUB_AGES = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17] as const;
const MAX_GROUPS = 200;
const MAX_SCHOOLS = 20;

function genderSplit(genders: ("Boys" | "Girls")[], inner: () => TemplateNode[]): TemplateNode[] {
  // A single side is a layer with one entry — it would only add a click.
  if (genders.length < 2) return inner();
  return genders.map((g) => ({ name: g, kind: "GENDER" as const, children: inner() }));
}

function schoolLevels(levels: SchoolLevels): TemplateNode[] {
  const jh: TemplateNode = {
    name: "Junior High",
    kind: "LEVEL",
    children: [
      { name: "7th Grade", kind: "LEVEL" },
      { name: "8th Grade", kind: "LEVEL" },
    ],
  };
  const hs: TemplateNode = {
    name: "High School",
    kind: "LEVEL",
    children: [
      { name: "Freshman", kind: "LEVEL" },
      { name: "JV", kind: "LEVEL" },
      { name: "Varsity", kind: "LEVEL" },
    ],
  };
  const inner = () => {
    const parts = [levels.juniorHigh ? jh : null, levels.highSchool ? hs : null].filter((n): n is TemplateNode => !!n);
    // Only one of the two: its grades go straight in (no lone wrapper).
    return parts.length === 1 ? structuredClone(parts[0].children!) : structuredClone(parts);
  };
  return genderSplit(levels.splitGenders ? ["Boys", "Girls"] : ["Boys"], inner);
}

export function countGroups(nodes: readonly TemplateNode[]): number {
  return nodes.reduce((n, g) => n + 1 + countGroups(g.children ?? []), 0);
}

export function templateDepth(nodes: readonly TemplateNode[]): number {
  return nodes.reduce((d, g) => Math.max(d, 1 + templateDepth(g.children ?? [])), 0);
}

/** The groups a choice creates, or why it can't. */
export function templateGroups(choice: TemplateChoice): { ok: true; groups: TemplateNode[] } | { ok: false; error: string } {
  let groups: TemplateNode[];
  switch (choice.template) {
    case "one-team":
    case "custom":
      groups = [];
      break;
    case "club": {
      const ages = [...new Set(choice.ages)].filter((a) => (CLUB_AGES as readonly number[]).includes(a)).sort((a, b) => a - b);
      const genders = choice.genders.filter((g, i, all) => all.indexOf(g) === i);
      if (ages.length === 0) return { ok: false, error: "Pick at least one age group." };
      if (genders.length === 0) return { ok: false, error: "Pick Boys, Girls, or both." };
      groups = genderSplit(genders, () => ages.map((a) => ({ name: `${a}U`, kind: "AGE_GROUP" as const })));
      break;
    }
    case "school":
      if (!choice.juniorHigh && !choice.highSchool) return { ok: false, error: "Pick Junior High, High School, or both." };
      groups = schoolLevels(choice);
      break;
    case "district": {
      if (!choice.juniorHigh && !choice.highSchool) return { ok: false, error: "Pick Junior High, High School, or both." };
      const schools = choice.schools.map((s) => s.trim()).filter((s, i, all) => s && all.indexOf(s) === i);
      if (schools.length === 0) return { ok: false, error: "Name at least one school." };
      if (schools.length > MAX_SCHOOLS) return { ok: false, error: `At most ${MAX_SCHOOLS} schools at once.` };
      if (schools.some((s) => s.length > 40)) return { ok: false, error: "School names are at most 40 characters." };
      groups = schools.map((name) => ({ name, kind: "SCHOOL" as const, children: schoolLevels(choice) }));
      break;
    }
  }
  if (templateDepth(groups) > MAX_GROUP_DEPTH) return { ok: false, error: `That's more than ${MAX_GROUP_DEPTH} levels deep.` };
  if (countGroups(groups) > MAX_GROUPS) return { ok: false, error: `That's more than ${MAX_GROUPS} groups.` };
  return { ok: true, groups };
}

/** A shape choice from form fields (the same names the shape picker uses):
 * template, Boys, Girls, age (repeated), juniorHigh, highSchool,
 * splitGenders, schools (one per line). */
export function choiceFromForm(formData: FormData): TemplateChoice | null {
  const template = String(formData.get("template"));
  const levels = {
    juniorHigh: formData.get("juniorHigh") === "on",
    highSchool: formData.get("highSchool") === "on",
    splitGenders: formData.get("splitGenders") === "on",
  };
  switch (template) {
    case "one-team":
    case "custom":
      return { template };
    case "club":
      return {
        template,
        genders: (["Boys", "Girls"] as const).filter((g) => formData.get(g) === "on"),
        ages: formData.getAll("age").map((a) => Number(a)),
      };
    case "school":
      return { template, ...levels };
    case "district":
      return { template, schools: String(formData.get("schools") ?? "").split(/\r?\n|,/), ...levels };
    default:
      return null;
  }
}

/** Every group a template makes, as a place a team can go: "0.2" = the third
 * group inside the first top-level one; label "Boys · 14U". */
export function templatePlaces(nodes: readonly TemplateNode[], prefix: number[] = [], names: string[] = []): { path: string; label: string }[] {
  return nodes.flatMap((n, i) => {
    const path = [...prefix, i];
    const label = [...names, n.name];
    return [{ path: path.join("."), label: label.join(" · ") }, ...templatePlaces(n.children ?? [], path, label)];
  });
}
