import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { __swPrisma?: PrismaClient };

export const prisma =
  globalForPrisma.__swPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__swPrisma = prisma;
}
