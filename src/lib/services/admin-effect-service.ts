import "server-only";
import { isAdminManagedEffect } from "@/lib/effects/effect-management";
import { AuthAccessError } from "@/lib/auth/policy";
import { EffectCatalogService } from "@/lib/effects/effect-catalog-service";
import { normalizeEffectKeyword } from "@/lib/effects/effect-keyword-normalization";
import type {
  EffectAdminTransactionalRepository,
  EffectAdminTransactionProvider,
} from "@/lib/repositories/effect-admin-repository";
import { PrismaEffectAdminTransactions } from "@/lib/repositories/prisma-effect-admin-repository";
import { CommandError, notFound } from "./command-error";
import { validateCommand } from "@/lib/validation/story-command-schema";
import {
  createEffectKeywordCommandSchema,
  deleteEffectKeywordCommandSchema,
  effectAdminListQuerySchema,
  updateEffectKeywordCommandSchema,
  updateEffectOverlayCommandSchema,
} from "@/lib/validation/effect-admin-schema";
import { projectManagedEffect } from "@/lib/effects/effect-projector";
import type { EffectAdminListQuery, ManagedEffectAdminItem } from "@/types/effect-admin";
import type { EffectType } from "@/types/story";

export interface EffectAdminAuditEvent {
  event: "effect_admin_mutation";
  action: "overlay_updated" | "keyword_created" | "keyword_updated" | "keyword_deleted";
  actorId: string;
  effectId: EffectType;
  keywordId?: string;
  updatedAt: string;
}

export interface EffectAdminAuditLogger {
  log(event: EffectAdminAuditEvent): void;
}

const structuredEffectAdminAuditLogger: EffectAdminAuditLogger = {
  log(event) {
    // Deliberately excludes label, description, keyword text, tokens and persistence details.
    console.info("[effect-admin]", JSON.stringify(event));
  },
};

async function authorizeExactAdmin(
  repository: EffectAdminTransactionalRepository,
  actorId: string,
): Promise<void> {
  if (await repository.getActorRole(actorId) !== "admin") throw new AuthAccessError(403);
}

async function requireDefinition(
  repository: EffectAdminTransactionalRepository,
  effectId: EffectType,
) {
  if (!isAdminManagedEffect(effectId)) notFound();
  const definition = await repository.getDefinition(effectId);
  if (!definition) notFound();
  return definition;
}

async function projectMutationResult(
  repository: EffectAdminTransactionalRepository,
  effectId: EffectType,
): Promise<ManagedEffectAdminItem> {
  const definition = await requireDefinition(repository, effectId);
  return {
    ...projectManagedEffect(definition),
    keywords: await repository.getKeywordsForEffect(effectId),
  };
}

function duplicateKeyword(): never {
  throw new CommandError(409, "DUPLICATE_EFFECT_KEYWORD", "This normalized keyword already exists for the effect.", {
    keyword: ["Từ khóa này đã tồn tại cho hiệu ứng."],
  });
}

export class AdminEffectService {
  constructor(
    private readonly transactions: EffectAdminTransactionProvider = new PrismaEffectAdminTransactions(),
    private readonly audit: EffectAdminAuditLogger = structuredEffectAdminAuditLogger,
  ) {}

  async list(actorId: string, rawQuery: EffectAdminListQuery) {
    const query = validateCommand(effectAdminListQuerySchema, rawQuery);
    return this.transactions.transaction(async (repository) => {
      await authorizeExactAdmin(repository, actorId);
      return new EffectCatalogService(repository).getAdminCatalog(query);
    });
  }

  async updateOverlay(rawCommand: unknown) {
    const command = validateCommand(updateEffectOverlayCommandSchema, rawCommand);
    const result = await this.transactions.transaction(async (repository) => {
      await authorizeExactAdmin(repository, command.actorId);
      await requireDefinition(repository, command.effectId);
      const updatedAt = await repository.updateOverlayWithRevision(
        command.effectId,
        command.expectedUpdatedAt,
        {
          label: command.label,
          description: command.description,
          isActive: command.isActive,
        },
      );
      return {
        data: await projectMutationResult(repository, command.effectId),
        meta: { updatedAt },
        audit: {
          event: "effect_admin_mutation",
          action: "overlay_updated",
          actorId: command.actorId,
          effectId: command.effectId,
          updatedAt,
        } satisfies EffectAdminAuditEvent,
      };
    });
    this.writeAudit(result.audit);
    return { data: result.data, meta: result.meta };
  }

  async createKeyword(rawCommand: unknown) {
    const command = validateCommand(createEffectKeywordCommandSchema, rawCommand);
    const result = await this.transactions.transaction(async (repository) => {
      await authorizeExactAdmin(repository, command.actorId);
      await requireDefinition(repository, command.effectId);
      const normalizedKeyword = normalizeEffectKeyword(command.keyword);
      if (await repository.findKeywordByNormalized(command.effectId, normalizedKeyword)) duplicateKeyword();
      const updatedAt = await repository.bumpRevision(command.effectId, command.expectedUpdatedAt);
      const keyword = await repository.createKeyword(command.effectId, {
        keyword: command.keyword,
        normalizedKeyword,
        weight: command.weight,
      });
      return {
        data: await projectMutationResult(repository, command.effectId),
        meta: { updatedAt },
        audit: {
          event: "effect_admin_mutation",
          action: "keyword_created",
          actorId: command.actorId,
          effectId: command.effectId,
          keywordId: keyword.id,
          updatedAt,
        } satisfies EffectAdminAuditEvent,
      };
    });
    this.writeAudit(result.audit);
    return { data: result.data, meta: result.meta };
  }

  async updateKeyword(rawCommand: unknown) {
    const command = validateCommand(updateEffectKeywordCommandSchema, rawCommand);
    const result = await this.transactions.transaction(async (repository) => {
      await authorizeExactAdmin(repository, command.actorId);
      await requireDefinition(repository, command.effectId);
      if (!await repository.getKeyword(command.effectId, command.keywordId)) notFound();
      const normalizedKeyword = normalizeEffectKeyword(command.keyword);
      if (await repository.findKeywordByNormalized(command.effectId, normalizedKeyword, command.keywordId)) duplicateKeyword();
      const updatedAt = await repository.bumpRevision(command.effectId, command.expectedUpdatedAt);
      await repository.updateKeyword(command.keywordId, {
        keyword: command.keyword,
        normalizedKeyword,
        weight: command.weight,
      });
      return {
        data: await projectMutationResult(repository, command.effectId),
        meta: { updatedAt },
        audit: {
          event: "effect_admin_mutation",
          action: "keyword_updated",
          actorId: command.actorId,
          effectId: command.effectId,
          keywordId: command.keywordId,
          updatedAt,
        } satisfies EffectAdminAuditEvent,
      };
    });
    this.writeAudit(result.audit);
    return { data: result.data, meta: result.meta };
  }

  async deleteKeyword(rawCommand: unknown) {
    const command = validateCommand(deleteEffectKeywordCommandSchema, rawCommand);
    const result = await this.transactions.transaction(async (repository) => {
      await authorizeExactAdmin(repository, command.actorId);
      await requireDefinition(repository, command.effectId);
      if (!await repository.getKeyword(command.effectId, command.keywordId)) notFound();
      const updatedAt = await repository.bumpRevision(command.effectId, command.expectedUpdatedAt);
      await repository.deleteKeyword(command.keywordId);
      return {
        data: await projectMutationResult(repository, command.effectId),
        meta: { updatedAt },
        audit: {
          event: "effect_admin_mutation",
          action: "keyword_deleted",
          actorId: command.actorId,
          effectId: command.effectId,
          keywordId: command.keywordId,
          updatedAt,
        } satisfies EffectAdminAuditEvent,
      };
    });
    this.writeAudit(result.audit);
    return { data: result.data, meta: result.meta };
  }

  private writeAudit(event: EffectAdminAuditEvent): void {
    try {
      this.audit.log(event);
    } catch {
      // The committed mutation must not be reported as failed if the log sink is unavailable.
      console.error("[effect-admin] EFFECT_AUDIT_LOG_FAILED");
    }
  }
}
