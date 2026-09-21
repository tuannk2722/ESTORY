import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { DailyQuota } from "@/types/user";
import { notFound } from "@/lib/services/command-error";
import { nextUtcMidnight, type QuotaKind, type QuotaStore } from "@/lib/services/quota-service";
import { loadRuntimePrismaClient } from "./prisma-read-client";

const fields = {
  freesound_import: ['"freesoundImportQuotaLimit"', '"freesoundImportQuotaUsed"', '"freesoundQuotaResetAt"'],
  ai_background: ['"aiBackgroundQuotaLimit"', '"aiBackgroundQuotaUsed"', '"aiBackgroundQuotaResetAt"'],
} as const;

function columns(kind: QuotaKind) {
  // Identifiers come exclusively from this allowlist, never request input.
  const names = fields[kind];
  if (!names) throw new Error("Invalid quota kind");
  return names.map((name) => Prisma.raw(name));
}
type Row = { limit: number; used: number; reset_at: Date };
const project = (row: Row): DailyQuota => ({ ...row, reset_at: row.reset_at.toISOString() });

export class PrismaQuotaStore implements QuotaStore {
  constructor(
    private readonly clientSource: () => Promise<PrismaClient> = loadRuntimePrismaClient,
    private readonly initialImportLimit = 15,
  ) {}

  private async reset(tx: Prisma.TransactionClient, userId: string, kind: QuotaKind, now: Date) {
    const [limit, used, reset] = columns(kind);
    const initialLimit = kind === "freesound_import" ? this.initialImportLimit : 0;
    await tx.$executeRaw(Prisma.sql`UPDATE "User" SET
      ${limit} = CASE WHEN ${reset} IS NULL AND ${limit} = 0 THEN ${initialLimit} ELSE ${limit} END,
      ${used} = 0, ${reset} = ${nextUtcMidnight(now)}
      WHERE "id" = ${userId} AND (${reset} IS NULL OR ${reset} <= ${now})`);
  }

  private async select(tx: Prisma.TransactionClient, userId: string, kind: QuotaKind) {
    const [limit, used, reset] = columns(kind);
    const rows = await tx.$queryRaw<Row[]>(Prisma.sql`SELECT ${limit} AS "limit", ${used} AS "used", ${reset} AS "reset_at"
      FROM "User" WHERE "id" = ${userId}`);
    if (!rows[0]) notFound();
    return project(rows[0]);
  }

  async read(userId: string, kind: QuotaKind, now: Date): Promise<DailyQuota> {
    const db = await this.clientSource();
    return db.$transaction(async (tx) => {
      await this.reset(tx, userId, kind, now);
      return this.select(tx, userId, kind);
    });
  }

  async reserve(userId: string, kind: QuotaKind, now: Date) {
    const db = await this.clientSource();
    const [limit, used, reset] = columns(kind);
    return db.$transaction(async (tx) => {
      await this.reset(tx, userId, kind, now);
      const rows = await tx.$queryRaw<Row[]>(Prisma.sql`UPDATE "User" SET ${used} = ${used} + 1
        WHERE "id" = ${userId} AND ${used} < ${limit}
        RETURNING ${limit} AS "limit", ${used} AS "used", ${reset} AS "reset_at"`);
      return { reserved: rows.length === 1, quota: rows[0] ? project(rows[0]) : await this.select(tx, userId, kind) };
    });
  }

  async refund(userId: string, kind: QuotaKind, resetAt: string): Promise<void> {
    const db = await this.clientSource();
    const [, used, reset] = columns(kind);
    await db.$executeRaw(Prisma.sql`UPDATE "User" SET ${used} = ${used} - 1
      WHERE "id" = ${userId} AND ${reset} = ${new Date(resetAt)} AND ${used} > 0`);
  }
}
