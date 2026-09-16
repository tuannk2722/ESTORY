import { isAdminManagedEffect } from "@/lib/effects/effect-management";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { EffectType } from "@/types/story";
import type {
  EffectDefinition,
  EffectKeywordSuggestion,
} from "@/types/effect-admin";
import { EFFECT_MANIFEST } from "@/lib/effects/effect-manifest";
import { normalizeEffectKeyword } from "@/lib/effects/effect-keyword-normalization";
import { CommandError, conflict, mapCommandDatabaseError } from "@/lib/services/command-error";
import type {
  EffectAdminReadRepository,
  EffectAdminTransactionalRepository,
  EffectAdminTransactionProvider,
  EffectKeywordWrite,
  EffectOverlayUpdate,
} from "./effect-admin-repository";
import {
  loadRuntimePrismaClient,
  resolvePrismaReadClient,
  type PrismaReadClientSource,
} from "./prisma-read-client";
import {
  consoleRepositoryReadObserver,
  failRepositoryRead,
  type RepositoryReadObserver,
} from "./read-observability";

function effectType(
  value: string,
  observer: RepositoryReadObserver,
): EffectType {
  if (Object.hasOwn(EFFECT_MANIFEST, value)) return value as EffectType;
  return failRepositoryRead(observer, "P3_PRISMA_UNKNOWN_EFFECT_DEFINITION");
}

function mapDefinitionRow(
  row: { effectId: string; label: string; description: string | null; isActive: boolean; createdAt: Date; updatedAt: Date },
  observer: RepositoryReadObserver,
): EffectDefinition {
  return {
    effect_id: effectType(row.effectId, observer),
    label: row.label,
    ...(row.description === null ? {} : { description: row.description }),
    is_active: row.isActive,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function mapKeywordRow(
  row: { id: string; keyword: string; normalizedKeyword: string; effectId: string; weight: number },
  observer: RepositoryReadObserver,
): EffectKeywordSuggestion {
  if (
    !Number.isInteger(row.weight)
    || row.weight < 1
    || row.weight > 100
    || !row.normalizedKeyword
    || normalizeEffectKeyword(row.keyword) !== row.normalizedKeyword
  ) {
    return failRepositoryRead(observer, "P3_PRISMA_INVALID_EFFECT_KEYWORD");
  }
  return {
    id: row.id,
    keyword: row.keyword,
    normalized_keyword: row.normalizedKeyword,
    effect_id: effectType(row.effectId, observer),
    weight: row.weight,
  };
}

function nextRevision(expectedUpdatedAt: string): Date {
  return new Date(Math.max(Date.now(), Date.parse(expectedUpdatedAt) + 1));
}

export class PrismaEffectAdminRepository implements EffectAdminReadRepository, EffectAdminTransactionalRepository {
  constructor(
    private readonly clientSource: PrismaReadClientSource = loadRuntimePrismaClient,
    private readonly observer: RepositoryReadObserver = consoleRepositoryReadObserver,
  ) {}

  async getDefinitions(): Promise<EffectDefinition[]> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const rows = await db.effectDefinition.findMany({
      orderBy: { effectId: "asc" },
    });
    return rows.filter((row) => isAdminManagedEffect(effectType(row.effectId, this.observer))).map((row) => mapDefinitionRow(row, this.observer));
  }

  async getKeywords(): Promise<EffectKeywordSuggestion[]> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const rows = await db.effectKeywordSuggestion.findMany({
      orderBy: [
        { effectId: "asc" },
        { weight: "desc" },
        { normalizedKeyword: "asc" },
        { id: "asc" },
      ],
    });
    return rows.filter((row) => isAdminManagedEffect(effectType(row.effectId, this.observer))).map((row) => mapKeywordRow(row, this.observer));
  }

  async getActorRole(actorId: string): Promise<"reader" | "author" | "admin" | null> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const actor = await db.user.findUnique({ where: { id: actorId }, select: { role: true } });
    return actor ? actor.role.toLowerCase() as "reader" | "author" | "admin" : null;
  }

  async getDefinition(effectId: EffectType): Promise<EffectDefinition | null> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const row = await db.effectDefinition.findUnique({ where: { effectId } });
    return row ? mapDefinitionRow(row, this.observer) : null;
  }

  async getKeywordsForEffect(effectId: EffectType): Promise<EffectKeywordSuggestion[]> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const rows = await db.effectKeywordSuggestion.findMany({
      where: { effectId },
      orderBy: [{ weight: "desc" }, { normalizedKeyword: "asc" }, { id: "asc" }],
    });
    return rows.filter((row) => isAdminManagedEffect(effectType(row.effectId, this.observer))).map((row) => mapKeywordRow(row, this.observer));
  }

  async getKeyword(effectId: EffectType, keywordId: string): Promise<EffectKeywordSuggestion | null> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const row = await db.effectKeywordSuggestion.findFirst({ where: { id: keywordId, effectId } });
    return row ? mapKeywordRow(row, this.observer) : null;
  }

  async findKeywordByNormalized(
    effectId: EffectType,
    normalizedKeyword: string,
    excludeKeywordId?: string,
  ): Promise<EffectKeywordSuggestion | null> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const row = await db.effectKeywordSuggestion.findFirst({
      where: {
        effectId,
        normalizedKeyword,
        ...(excludeKeywordId ? { id: { not: excludeKeywordId } } : {}),
      },
    });
    return row ? mapKeywordRow(row, this.observer) : null;
  }

  async updateOverlayWithRevision(
    effectId: EffectType,
    expectedUpdatedAt: string,
    update: EffectOverlayUpdate,
  ): Promise<string> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const updatedAt = nextRevision(expectedUpdatedAt);
    const result = await db.effectDefinition.updateMany({
      where: { effectId, updatedAt: new Date(expectedUpdatedAt) },
      data: {
        label: update.label,
        description: update.description,
        isActive: update.isActive,
        updatedAt,
      },
    });
    if (result.count !== 1) conflict();
    return updatedAt.toISOString();
  }

  async bumpRevision(effectId: EffectType, expectedUpdatedAt: string): Promise<string> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const updatedAt = nextRevision(expectedUpdatedAt);
    const result = await db.effectDefinition.updateMany({
      where: { effectId, updatedAt: new Date(expectedUpdatedAt) },
      data: { updatedAt },
    });
    if (result.count !== 1) conflict();
    return updatedAt.toISOString();
  }

  async createKeyword(effectId: EffectType, input: EffectKeywordWrite): Promise<EffectKeywordSuggestion> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const row = await db.effectKeywordSuggestion.create({ data: { effectId, ...input } });
    return mapKeywordRow(row, this.observer);
  }

  async updateKeyword(keywordId: string, input: EffectKeywordWrite): Promise<EffectKeywordSuggestion> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const row = await db.effectKeywordSuggestion.update({ where: { id: keywordId }, data: input });
    return mapKeywordRow(row, this.observer);
  }

  async deleteKeyword(keywordId: string): Promise<void> {
    const db = await resolvePrismaReadClient(this.clientSource);
    await db.effectKeywordSuggestion.delete({ where: { id: keywordId } });
  }
}

export type EffectAdminRepositoryFactory = (tx: Prisma.TransactionClient) => EffectAdminTransactionalRepository;

export class PrismaEffectAdminTransactions implements EffectAdminTransactionProvider {
  constructor(
    private readonly clientSource: () => Promise<PrismaClient> = loadRuntimePrismaClient,
    private readonly repositoryFactory: EffectAdminRepositoryFactory = (tx) => new PrismaEffectAdminRepository(tx),
  ) {}

  async transaction<T>(work: (repository: EffectAdminTransactionalRepository) => Promise<T>): Promise<T> {
    const db = await this.clientSource();
    try {
      return await db.$transaction((tx) => work(this.repositoryFactory(tx)), {
        isolationLevel: "Serializable",
        maxWait: 10_000,
        timeout: 30_000,
      });
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (code === "P2002") {
        throw new CommandError(409, "DUPLICATE_EFFECT_KEYWORD", "This normalized keyword already exists for the effect.", {
          keyword: ["Từ khóa này đã tồn tại cho hiệu ứng."],
        });
      }
      return mapCommandDatabaseError(error);
    }
  }
}
