// Where to go after logging in or signing up — only ever a path on this site
// (never "//evil.com" or a full URL), so a crafted link can't bounce someone
// off to another site.
export function safeNext(raw: unknown): string | null {
  const next = String(raw ?? "");
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || next.length > 300) return null;
  return next;
}
