import "server-only";
import { normalizeSearchText } from "@/lib/search/text-search";
import type { EffectAdminReadRepository } from "@/lib/repositories/effect-admin-repository";
import { PrismaEffectAdminRepository } from "@/lib/repositories/prisma-effect-admin-repository";
import type {
  EffectAdminList,
  EffectAdminListQuery,
  EffectAuthorCatalog,
  EffectDefinition,
  EffectKeywordSuggestion,
  ManagedEffectAdminItem,
} from "@/types/effect-admin";
import { EFFECT_ADMIN_PAGE_SIZE } from "@/lib/validation/effect-admin-schema";
import { EFFECT_TYPES, EFFECT_MANIFEST } from "./effect-manifest";
import { ADMIN_MANAGED_EFFECT_TYPES, isAdminManagedEffect } from "./effect-management";
import { EFFECT_PRESENTATION_SEED } from "./effect-seed";
import { matchesEffectSearch } from "./effect-search";
import { projectManagedEffect } from "./effect-projector";

interface EffectAdminCursorPayload {
  v: 1;
  q: string;
  category: EffectAdminListQuery["category"];
  status: EffectAdminListQuery["status"];
  lastId: string;
}

const ADMIN_CAPABILITIES = Object.freeze({
  canCreateEffect: false,
  canEditTechnicalFields: false,
  canEditMetadata: true,
  canManageKeywords: true,
} as const);

function encodeCursor(query: EffectAdminListQuery, lastId: string): string {
  const payload: EffectAdminCursorPayload = {
    v: 1,
    q: normalizeSearchText(query.q),
    category: query.category,
    status: query.status,
    lastId,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(query: EffectAdminListQuery): string | null {
  if (!query.cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(query.cursor, "base64url").toString("utf8")) as Partial<EffectAdminCursorPayload>;
    return parsed.v === 1
      && parsed.q === normalizeSearchText(query.q)
      && parsed.category === query.category
      && parsed.status === query.status
      && typeof parsed.lastId === "string"
      && EFFECT_TYPES.includes(parsed.lastId as (typeof EFFECT_TYPES)[number])
      ? parsed.lastId
      : null;
  } catch {
    return null;
  }
}

function buildOverlayMap(definitions: EffectDefinition[]): Map<string, EffectDefinition> {
  const overlays = new Map<string, EffectDefinition>();
  for (const definition of definitions) {
    if (overlays.has(definition.effect_id)) {
      throw new Error("P3_EFFECT_OVERLAY_DUPLICATE");
    }
    overlays.set(definition.effect_id, definition);
  }
  const missing = ADMIN_MANAGED_EFFECT_TYPES.filter((effectId) => !overlays.has(effectId));
  if (missing.length > 0) throw new Error("P3_EFFECT_OVERLAY_MISSING");
  return overlays;
}

function compareKeywords(left: EffectKeywordSuggestion, right: EffectKeywordSuggestion): number {
  return right.weight - left.weight
    || left.normalized_keyword.localeCompare(right.normalized_keyword, "vi")
    || left.id.localeCompare(right.id, "en");
}

export class EffectCatalogService {
  constructor(private readonly repository: EffectAdminReadRepository = new PrismaEffectAdminRepository()) {}

  private async loadCatalog() {
    const definitions = await this.repository.getDefinitions();
    const keywords = await this.repository.getKeywords();
    const overlays = buildOverlayMap(definitions);
    const managed = ADMIN_MANAGED_EFFECT_TYPES.map((effectId) => projectManagedEffect(overlays.get(effectId)!));
    return { managed, keywords: keywords.filter((entry) => isAdminManagedEffect(entry.effect_id)).sort(compareKeywords) };
  }

  /** Author/editor projection. Reader rendering never calls this service. */
  async getActiveCatalog(): Promise<EffectAuthorCatalog> {
    const { managed, keywords } = await this.loadCatalog();
    const activeIds = new Set(managed.filter((effect) => effect.is_active).map((effect) => effect.id));
    return {
      effects: EFFECT_TYPES.flatMap((effectId) => {
        if (!isAdminManagedEffect(effectId)) return [{
          ...structuredClone(EFFECT_MANIFEST[effectId]),
          ...EFFECT_PRESENTATION_SEED[effectId],
          is_active: true,
        }];
        const effect = managed.find((entry) => entry.id === effectId);
        if (!effect?.is_active) return [];
        return [{
          ...structuredClone(EFFECT_MANIFEST[effectId]),
          label: effect.label,
          ...(effect.description === undefined ? {} : { description: effect.description }),
          is_active: true,
        }];
      }),
      keywords: keywords.filter((keyword) => activeIds.has(keyword.effect_id)),
    };
  }

  async getAdminCatalog(query: EffectAdminListQuery): Promise<EffectAdminList> {
    const { managed, keywords } = await this.loadCatalog();
    const keywordsByEffect = new Map<string, EffectKeywordSuggestion[]>();
    for (const keyword of keywords) {
      const list = keywordsByEffect.get(keyword.effect_id) ?? [];
      list.push(keyword);
      keywordsByEffect.set(keyword.effect_id, list);
    }
    const filtered: ManagedEffectAdminItem[] = managed
      .filter((effect) => query.category === "all" || effect.category === query.category)
      .filter((effect) => query.status === "all" || effect.is_active === (query.status === "active"))
      .filter((effect) => matchesEffectSearch(query.q, effect.label, effect.description ?? "", effect.id, ...(keywordsByEffect.get(effect.id) ?? []).map((entry) => entry.keyword)))
      .map((effect) => ({ ...effect, keywords: keywordsByEffect.get(effect.id) ?? [] }));

    const cursorId = decodeCursor(query);
    const cursorIndex = cursorId === null ? -1 : filtered.findIndex((effect) => effect.id === cursorId);
    const start = cursorIndex < 0 ? 0 : cursorIndex + 1;
    const items = filtered.slice(start, start + EFFECT_ADMIN_PAGE_SIZE);
    const hasMore = start + items.length < filtered.length;
    return {
      items,
      total: filtered.length,
      nextCursor: hasMore && items.length > 0 ? encodeCursor(query, items.at(-1)!.id) : null,
      capabilities: ADMIN_CAPABILITIES,
    };
  }
}
