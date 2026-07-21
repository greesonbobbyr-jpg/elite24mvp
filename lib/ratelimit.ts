import { headers } from "next/headers";
import { prisma } from "./prisma";

// DB-backed fixed-window rate limiter. Chosen over in-memory (resets per
// serverless instance, trivially bypassed) and over a Redis service (new infra +
// account) — one small table works everywhere the app runs. bcrypt endpoints
// especially need this: unthrottled credential stuffing is both a security and a
// serverless-billing problem.
//
// Fail-open by design: if the limiter itself errors, the request proceeds — a
// broken counter must never lock every kid out of the app.

// True = allowed; false = over the limit for this window.
export async function rateLimit(
  scope: string,
  identifier: string,
  max: number,
  windowSec: number,
): Promise<boolean> {
  const windowIndex = Math.floor(Date.now() / (windowSec * 1000));
  const key = `${scope}:${identifier.toLowerCase()}:${windowIndex}`;
  try {
    const row = await prisma.rateLimit.upsert({
      where: { key },
      create: { key },
      update: { count: { increment: 1 } },
    });
    // Opportunistic pruning (~2% of calls) so the table never grows unbounded.
    if (Math.random() < 0.02) {
      await prisma.rateLimit.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - 24 * 3600_000) } },
      });
    }
    return row.count <= max;
  } catch {
    return true; // fail-open
  }
}

// Best-effort client IP for per-IP limits (Vercel sets x-forwarded-for; the
// first hop is the client). Falls back to a shared bucket locally.
export async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    return fwd?.split(",")[0]?.trim() || "local";
  } catch {
    return "local";
  }
}

export const RATE_LIMITED_MESSAGE =
  "Too many attempts. Please wait a few minutes and try again.";
