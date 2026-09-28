// DEV-ONLY sample organizations for the org tree mockup (/org-preview). Static
// and deterministic: no database, no real people (the one sample portrait is
// the card studio's). Shaped like the grouping model: org → divisions →
// teams (head coach, staff, players).

import processedMeta from "@/design/reference/sample-athlete-processed.meta.json";

export type SampleStaff = { id: string; name: string; role: string };
export type SamplePlayer = {
  id: string;
  name: string;
  jerseyNumber: number;
  position: string;
  careerPoints: number;
  cutoutUrl: string | null;
  photoMeta: unknown;
};
export type SampleTeam = {
  id: string;
  name: string;
  headCoach: SampleStaff | null;
  staff: SampleStaff[];
  players: SamplePlayer[];
};
export type SampleDivision = { id: string; name: string; teams: SampleTeam[] };
export type SampleOrg = { id: string; name: string; owner: SampleStaff; divisions: SampleDivision[] };

const SAMPLE_CUTOUT = "/api/dev/reference/sample-athlete-processed.webp";

const FIRST = ["Jordan", "Malik", "Tyler", "Sam", "Casey", "Andre", "Brandon", "Diego", "Chris", "Kai", "Devon", "Marcus", "Isaiah", "Noah", "Tyrese", "Elijah", "Jalen", "Cam", "Aiden", "Micah", "Zion", "Derek", "Luis", "Trey"];
const LAST = ["Carter", "Johnson", "Nguyen", "Okafor", "Rivers", "Washington", "Lee", "Morales", "Bennett", "Price", "Holloway", "Grant", "Ellis", "Brooks", "Hayes", "Coleman", "Reed", "Foster", "Ward", "Simmons", "Patel", "Kim", "Russo", "Vaughn"];
const COACH_FIRST = ["Darnell", "Rachel", "Marcus", "Tanya", "Luis", "Keith", "Monica", "Andre", "Priya", "Dwayne", "Carla", "Victor", "Janelle", "Omar", "Brenda", "Glen", "Nadia", "Ray"];
const COACH_LAST = ["Brooks", "Alvarez", "Fields", "Morgan", "Ortiz", "Dawson", "Hill", "Price", "Shah", "Tate", "Lin", "Reyes", "Watts", "Hassan", "Kerr", "Doyle", "Park", "Mason"];
const POSITIONS = ["Point Guard", "Shooting Guard", "Small Forward", "Power Forward", "Center", "Combo Guard", "Wing", "Forward"];
const COLORS = ["Black", "Red", "White", "Gold", "Silver"];

/** Deterministic pseudo-random numbers (mulberry32), so the mockup never reshuffles. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Career points by age group: older players have had more seasons, so the
 * spread reaches higher tiers (Bronze <1k, Silver <5k, Gold <20k, Platinum <50k). */
function careerPoints(age: number, r: () => number): number {
  const ceiling = { 12: 3_000, 13: 6_000, 14: 12_000, 15: 25_000, 16: 45_000, 17: 70_000 }[age] ?? 5_000;
  return Math.round(r() ** 1.6 * ceiling);
}

function makeTeam(org: string, age: number, division: string, color: string, index: number, opts: { noHeadCoach?: boolean } = {}): SampleTeam {
  const r = rng(age * 100 + index * 7 + org.length);
  const id = `${org}-${division}-${color}`.toLowerCase();
  const count = 8 + Math.floor(r() * 4);
  const players: SamplePlayer[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count; i++) {
    let name = "";
    do name = `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`;
    while (used.has(name));
    used.add(name);
    const hasPhoto = r() > 0.25;
    players.push({
      id: `${id}-p${i}`,
      name,
      jerseyNumber: 1 + Math.floor(r() * 44),
      position: POSITIONS[Math.floor(r() * POSITIONS.length)],
      careerPoints: careerPoints(age, r),
      cutoutUrl: hasPhoto ? SAMPLE_CUTOUT : null,
      photoMeta: hasPhoto ? processedMeta : null,
    });
  }
  players.sort((a, b) => b.careerPoints - a.careerPoints);
  const coach = (role: string, n: number): SampleStaff => ({
    id: `${id}-${role.toLowerCase().replace(/\s+/g, "-")}`,
    name: `${COACH_FIRST[(age + index * 3 + n) % COACH_FIRST.length]} ${COACH_LAST[(age * 2 + index + n) % COACH_LAST.length]}`,
    role,
  });
  const staff: SampleStaff[] = [];
  if (r() > 0.35) staff.push(coach("Assistant Coach", 5));
  if (r() > 0.6) staff.push(coach("General Manager", 9));
  return { id, name: `${division} ${org.split(" ")[0]} ${color}`, headCoach: opts.noHeadCoach ? null : coach("Head Coach", 0), staff, players };
}

function makeDivision(org: string, age: number, teams: number, opts: { noHeadCoachAt?: number } = {}): SampleDivision {
  const name = `${age}U`;
  return {
    id: `${org}-${name}`.toLowerCase(),
    name,
    teams: COLORS.slice(0, teams).map((color, i) => makeTeam(org, age, name, color, i, { noHeadCoach: opts.noHeadCoachAt === i })),
  };
}

/** A club with 12U–17U divisions and several teams each (the owner's sketch). */
export const MUSTANG: SampleOrg = {
  id: "mustang",
  name: "Mustang Athletics",
  owner: { id: "mustang-owner", name: "Angela Whitfield", role: "Org Owner" },
  divisions: [
    makeDivision("Mustang Athletics", 12, 5),
    makeDivision("Mustang Athletics", 13, 3),
    makeDivision("Mustang Athletics", 14, 4, { noHeadCoachAt: 3 }),
    makeDivision("Mustang Athletics", 15, 3),
    makeDivision("Mustang Athletics", 16, 3),
    makeDivision("Mustang Athletics", 17, 2),
  ],
};

/** A one-team club: no divisions row, the owner goes straight to the coach. */
export const THUNDER: SampleOrg = {
  id: "thunder",
  name: "OKC Thunder Club",
  owner: { id: "thunder-owner", name: "Riley Jackson", role: "Org Owner" },
  divisions: [{ id: "thunder-main", name: "Main", teams: [makeTeam("Thunder Club", 16, "16U", "Blue", 0)] }],
};

export const SAMPLE_ORGS = [MUSTANG, THUNDER];
