import { splitHeight } from "@/lib/height";

// Height as two small boxes, "5 ft  8 in", posted as heightFt + heightIn and
// combined server-side by lib/height parseHeight. The caller supplies its
// form's own field and label styles.
export function HeightFields({
  defaultInches,
  inputClass,
  labelClass,
}: {
  defaultInches?: number | null;
  inputClass: string;
  labelClass: string;
}) {
  const current = splitHeight(defaultInches);
  const unit = "pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-subtle";
  // Desktop spin arrows would sit on top of the ft/in label in these small boxes.
  const noSpinner =
    "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  return (
    <div>
      <span className={labelClass}>Height</span>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            name="heightFt"
            type="number"
            inputMode="numeric"
            min={3}
            max={8}
            placeholder="5"
            aria-label="Height, feet"
            defaultValue={current?.feet ?? ""}
            className={`${inputClass} ${noSpinner} pr-7`}
          />
          <span className={unit}>ft</span>
        </div>
        <div className="relative min-w-0 flex-1">
          <input
            name="heightIn"
            type="number"
            inputMode="numeric"
            min={0}
            max={11}
            placeholder="8"
            aria-label="Height, inches"
            defaultValue={current?.inches ?? ""}
            className={`${inputClass} ${noSpinner} pr-7`}
          />
          <span className={unit}>in</span>
        </div>
      </div>
    </div>
  );
}
