// Shared metadata for board message types. Plain constants (no runtime imports),
// safe to use in both the server page and the client composer. The colored
// special types are coach-only (enforced server-side in postMessage).
export type MessageType = "REGULAR" | "DISCUSSION" | "CHALLENGE" | "SPOTLIGHT";

export const TYPE_META: Record<
  MessageType,
  {
    label: string | null;
    card: string; // message card border/background tint
    badge: string; // the type label badge
    text: string; // the MESSAGE BODY text color (the letters themselves)
    idleTab: string; // composer tab when not selected — tinted its type color
    activeTab: string; // composer tab when selected — solid type color
  }
> = {
  REGULAR: {
    label: null,
    card: "border-zinc-800",
    badge: "",
    text: "text-zinc-200",
    idleTab: "border-zinc-600 text-zinc-300 hover:bg-zinc-800",
    activeTab: "bg-zinc-700 text-white hover:bg-zinc-600",
  },
  DISCUSSION: {
    label: "Discussion of the Day",
    card: "border-blue-500/40 bg-blue-500/10",
    badge: "bg-blue-500/20 text-blue-300",
    text: "text-blue-300",
    idleTab: "border-blue-500/60 text-blue-300 hover:bg-blue-500/20",
    activeTab: "bg-blue-600 text-white hover:bg-blue-500",
  },
  CHALLENGE: {
    label: "Challenge of the Week",
    card: "border-green-500/40 bg-green-500/10",
    badge: "bg-green-500/20 text-green-300",
    text: "text-green-300",
    idleTab: "border-green-500/60 text-green-300 hover:bg-green-500/20",
    activeTab: "bg-green-600 text-white hover:bg-green-500",
  },
  // Spotlight uses the app's warm red accent (red-500/600), not the lighter
  // red-300, so it reads as the brand's bold red / orange-red.
  SPOTLIGHT: {
    label: "Coach's Spotlight",
    card: "border-red-500/40 bg-red-500/10",
    badge: "bg-red-500/20 text-red-400",
    text: "text-red-400",
    idleTab: "border-red-500/60 text-red-400 hover:bg-red-500/20",
    activeTab: "bg-red-600 text-white hover:bg-red-500",
  },
};

export const TAB_TYPES: MessageType[] = [
  "REGULAR",
  "DISCUSSION",
  "CHALLENGE",
  "SPOTLIGHT",
];

export const SHORT_LABEL: Record<MessageType, string> = {
  REGULAR: "Regular",
  DISCUSSION: "Discussion",
  CHALLENGE: "Challenge",
  SPOTLIGHT: "Spotlight",
};
