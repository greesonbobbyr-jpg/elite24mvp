// Friendly date formatting for the journal and points history.

// A "YYYY-MM-DD" day key → e.g. "Tue, Jun 10, 2026".
export function formatDayKey(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// A Date → e.g. "Jun 10, 2026".
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// A Date → e.g. "Jun 11, 3:42 PM" (chat-style timestamp).
export function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// A Date → e.g. "3:42 PM" (time only).
export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// Display label for an author-role SNAPSHOT (stamped at write time — it
// survives later promotions/demotions by design). PLAYER gets no badge.
export function roleLabel(role: string | null | undefined): string | null {
  switch (role) {
    case "HEAD_COACH":
      return "Head Coach";
    case "ASSISTANT_COACH":
      return "Assistant Coach";
    case "GENERAL_MANAGER":
      return "General Manager";
    case "ORG_ADMIN":
      return "Org Admin";
    case "COACH": // legacy value on pre-rebuild rows
      return "Coach";
    default:
      return null;
  }
}
