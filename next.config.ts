import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Move the Next.js dev-tools indicator to the bottom-right so it doesn't sit
  // on top of the bottom-left "Dev: switch user" menu (both are dev-only).
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
