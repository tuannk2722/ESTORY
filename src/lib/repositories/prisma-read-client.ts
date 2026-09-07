import type { Prisma, PrismaClient } from "@/generated/prisma/client";

export type PrismaReadClient = PrismaClient | Prisma.TransactionClient;
export type PrismaReadClientSource =
  | PrismaReadClient
  | (() => Promise<PrismaReadClient>);

export async function resolvePrismaReadClient(
  source: PrismaReadClientSource,
): Promise<PrismaReadClient> {
  return typeof source === "function" ? source() : source;
}

export async function loadRuntimePrismaClient(): Promise<PrismaClient> {
  const { prisma } = await import("@/lib/db/prisma");
  return prisma;
}
