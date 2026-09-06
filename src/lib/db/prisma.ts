import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { serverEnv } from "@/lib/env";
import { requireDatabaseUrl } from "@/lib/config/environment";

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: requireDatabaseUrl(serverEnv),
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });
  // Do not log queries/parameters or connection errors containing credentials.
  return new PrismaClient({ adapter, log: [], errorFormat: "minimal" });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Reuse the pool across Next.js development hot reloads. Production uses the
// module singleton; request handlers must not disconnect it after each query.
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
