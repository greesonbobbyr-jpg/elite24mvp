"use client";

import { useEffect, useState } from "react";
import { checkClass, fieldBase, labelClass } from "@/app/components/ui/Field";
import { pillClass } from "@/app/components/ui/Pill";
import { CLUB_AGES, type TemplateChoice } from "@/lib/structure-templates";

// THE SHAPE PICKER — how an organization's groups start out (lib/structure-
// templates). Renders real form fields (the names choiceFromForm reads), so
// it drops into any form; `onChange` reports the choice for a live preview.

export type ShapeKey = "one-team" | "club" | "school" | "district";

const SHAPES: { key: ShapeKey; label: string; sub: string }[] = [
  { key: "one-team", label: "One team", sub: "Just one team — no groups to set up" },
  { key: "club", label: "Club", sub: "Boys / Girls → age groups" },
  { key: "school", label: "School", sub: "Junior High · High School" },
  { key: "district", label: "District", sub: "Schools → their levels" },
];

export function ShapeFields({
  shapes = ["one-team", "club", "school", "district"],
  initial = "club",
  onChange,
}: {
  shapes?: ShapeKey[];
  initial?: ShapeKey;
  onChange?: (choice: TemplateChoice) => void;
}) {
  const [shape, setShape] = useState<ShapeKey>(initial);
  const [genders, setGenders] = useState({ Boys: true, Girls: true });
  const [ages, setAges] = useState<number[]>(CLUB_AGES.filter((a) => a >= 12));
  const [levels, setLevels] = useState({ juniorHigh: true, highSchool: true, splitGenders: false });
  const [schools, setSchools] = useState("");

  useEffect(() => {
    const choice: TemplateChoice =
      shape === "club"
        ? { template: "club", genders: (["Boys", "Girls"] as const).filter((g) => genders[g]), ages }
        : shape === "school"
          ? { template: "school", ...levels }
          : shape === "district"
            ? { template: "district", schools: schools.split(/\r?\n|,/), ...levels }
            : { template: "one-team" };
    onChange?.(choice);
  }, [shape, genders, ages, levels, schools, onChange]);

  const options = SHAPES.filter((s) => shapes.includes(s.key));
  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="template" value={shape} />
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Shape">
        {options.map((s) => (
          <button key={s.key} type="button" role="radio" aria-checked={shape === s.key} onClick={() => setShape(s.key)} className={pillClass(shape === s.key, "sm")}>
            {s.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-subtle">{SHAPES.find((s) => s.key === shape)!.sub}</p>

      {shape === "club" && (
        <>
          <div className="flex gap-4">
            {(["Boys", "Girls"] as const).map((g) => (
              <label key={g} className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name={g} checked={genders[g]} onChange={(e) => setGenders({ ...genders, [g]: e.target.checked })} className={checkClass} /> {g}
              </label>
            ))}
          </div>
          <div>
            <p className={labelClass}>Age groups</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {CLUB_AGES.map((a) => (
                <label key={a} className="flex items-center gap-1.5 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="age"
                    value={a}
                    checked={ages.includes(a)}
                    onChange={(e) => setAges(e.target.checked ? [...ages, a].sort((x, y) => x - y) : ages.filter((x) => x !== a))}
                    className={checkClass}
                  />{" "}
                  {a}U
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {shape === "district" && (
        <div>
          <label htmlFor="schools" className={labelClass}>Schools, one per line</label>
          <textarea
            id="schools"
            name="schools"
            rows={3}
            value={schools}
            onChange={(e) => setSchools(e.target.value)}
            placeholder={"Lincoln High\nLincoln Middle"}
            className={`${fieldBase} w-full px-3 py-2 text-sm`}
          />
        </div>
      )}

      {(shape === "school" || shape === "district") && (
        <div className="flex flex-wrap gap-4">
          {(
            [
              ["juniorHigh", "Junior High (7th, 8th)"],
              ["highSchool", "High School (Freshman, JV, Varsity)"],
              ["splitGenders", "Separate Boys and Girls"],
            ] as const
          ).map(([key, text]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name={key} checked={levels[key]} onChange={(e) => setLevels({ ...levels, [key]: e.target.checked })} className={checkClass} /> {text}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
