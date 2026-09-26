import { PrismaClient } from "@prisma/client";

// Re-use a single PrismaClient instance across the whole process.
// In development, hot-reloads would otherwise create hundreds of connections
// because each module re-evaluation calls `new PrismaClient()`.
// Storing the instance on `globalThis` prevents that.

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env["NODE_ENV"] === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = prisma;
}
