// A coach's-whistle glyph for the TIME OUT mark (there is no whistle emoji in
// Unicode). Path is the "whistle" icon from Material Design Icons (@mdi/svg),
// licensed Apache-2.0 (https://github.com/Templarian/MaterialDesign/blob/master/LICENSE).
// Apache-2.0 requires only that the license notice be kept in the source — NO
// user-facing attribution credit is required.
//
// Uses `currentColor`, so it tints to whatever text color it sits in (set
// `text-white` / `text-red-500` on the usage).
export function WhistleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M8.5,9A6.5,6.5 0 0,0 2,15.5A6.5,6.5 0 0,0 8.5,22A6.5,6.5 0 0,0 15,15.5V13.91L22,12V9H11V11H9V9H8.5M11,2V7H9V2H11M6.35,7.28C5.68,7.44 5.04,7.68 4.43,8L2.14,4.88L3.76,3.7L6.35,7.28M17.86,4.88L16.32,7H13.85L16.24,3.7L17.86,4.88Z" />
    </svg>
  );
}
