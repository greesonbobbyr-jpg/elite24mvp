// Turns a stored photo value into the URL pages should render.
//
// WHY: photos are stored as ~100-200KB data: URLs; inlining them into list pages
// (leaderboard, roster, board) made a 12-player page >1MB of base64 HTML. Data:
// values now render via the authed /api/photo/[userId] route (real image bytes,
// cacheable); http(s)/path values pass through unchanged. `v` is a content hash
// so a changed photo busts the browser cache.

// Tiny FNV-1a — stable, fast, good enough for cache busting (not security).
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function photoSrc(
  userId: number,
  photoUrl: string | null | undefined,
): string | null {
  if (!photoUrl) return null;
  if (!photoUrl.startsWith("data:")) return photoUrl; // real URL already
  return `/api/photo/${userId}?v=${fnv1a(photoUrl)}`;
}
