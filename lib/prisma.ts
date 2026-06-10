import { PrismaClient } from "@prisma/client";

// A single shared Prisma client. In development Next.js hot-reloads modules,
// which would otherwise create a new client (and new DB connections) on every
// reload, so we cache it on globalThis. Standard Prisma + Next.js pattern.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
