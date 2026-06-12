// The team's reference library entries. Static config for the MVP (CLAUDE.md
// §4/§5) — one real entry, Gary's playbook. Structured as an array so more
// entries can be added later without touching the page or route. No DB, no
// upload UI, no AI processing of the content.
export type LibraryEntry = {
  slug: string;
  title: string;
  description: string;
  href: string; // the gated route that serves the file
};

export const LIBRARY_ENTRIES: LibraryEntry[] = [
  {
    slug: "playbook",
    title: "E24P Playbook",
    description:
      "Your team's full playbook — the Elite24 / E24P method, start to finish.",
    href: "/library/playbook",
  },
];
