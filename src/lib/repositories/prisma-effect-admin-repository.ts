import type { EffectType } from "@/types/story";
import type {
  EffectDefinition,
  EffectKeywordSuggestion,
} from "@/types/effect-admin";
import { EFFECT_MANIFEST } from "@/lib/effects/effect-manifest";
import type { EffectAdminReadRepository } from "./effect-admin-repository";
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

export class PrismaEffectAdminRepository implements EffectAdminReadRepository {
  constructor(
    private readonly clientSource: PrismaReadClientSource = loadRuntimePrismaClient,
    private readonly observer: RepositoryReadObserver = consoleRepositoryReadObserver,
  ) {}

  async getDefinitions(): Promise<EffectDefinition[]> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const rows = await db.effectDefinition.findMany({
      orderBy: { effectId: "asc" },
    });
    return rows.map((row) => ({
      effect_id: effectType(row.effectId, this.observer),
      label: row.label,
      ...(row.description === null ? {} : { description: row.description }),
      is_active: row.isActive,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    }));
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
    return rows.map((row) => {
      if (!Number.isInteger(row.weight) || row.weight < 1 || row.weight > 100) {
        return failRepositoryRead(
          this.observer,
          "P3_PRISMA_INVALID_EFFECT_KEYWORD",
        );
      }
      return {
        id: row.id,
        keyword: row.keyword,
        normalized_keyword: row.normalizedKeyword,
        effect_id: effectType(row.effectId, this.observer),
        weight: row.weight,
      };
    });
  }
}
