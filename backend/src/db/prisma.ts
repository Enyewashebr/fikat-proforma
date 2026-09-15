import { PrismaClient } from "@prisma/client";

// Reuse a single client across the process (important with ts-node-dev
// hot-reloading, which would otherwise open a new pool on every reload).
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
