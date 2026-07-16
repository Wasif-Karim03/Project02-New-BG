import { PrismaClient } from "@prisma/client";

// Single PrismaClient across hot-reloads in dev (avoids exhausting connections).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    // Multi-step interactive transactions (approval, deletion, donor consolidation)
    // make many sequential round-trips. In production the DB and the serverless
    // functions are in different regions, so that latency adds up — Prisma's default
    // 5s interactive-transaction timeout is too tight and trips P2028. Give
    // transactions real headroom (and a longer wait to acquire a connection).
    transactionOptions: { maxWait: 15_000, timeout: 30_000 },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
