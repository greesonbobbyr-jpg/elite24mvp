import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Move the Next.js dev-tools indicator to the bottom-right so it doesn't sit
  // on top of the bottom-left "Dev: switch user" menu (both are dev-only).
  devIndicators: { position: "bottom-right" },

  experimental: {
    // This project lives under OneDrive, whose background file syncing corrupts
    // Turbopack's persistent on-disk dev cache — causing "(stale)" builds,
    // "React Client Manifest" errors, and cache panics. Disabling that disk
    // cache makes Turbopack rebuild cleanly in memory each run: a little slower
    // to start, but stable here. (Remove this if the project moves off OneDrive.)
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
