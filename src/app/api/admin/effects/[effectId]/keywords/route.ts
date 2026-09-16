import { requireRole } from "@/lib/auth/guards";
import { AuthAccessError } from "@/lib/auth/policy";
import { serverEnv } from "@/lib/env";
import {
  commandFailure,
  commandResponse,
  readCommandJson,
} from "@/lib/http/command-response";
import { AdminEffectService } from "@/lib/services/admin-effect-service";
import { validateCommand } from "@/lib/validation/story-command-schema";
import {
  createEffectKeywordSchema,
  deleteEffectKeywordSchema,
  effectIdSchema,
  managedEffectAdminItemSchema,
  updateEffectKeywordSchema,
} from "@/lib/validation/effect-admin-schema";

const service = new AdminEffectService();
type EffectKeywordRouteContext = { params: Promise<{ effectId: string }> };

function requireSameOrigin(request: Request): void {
  if (!serverEnv.AUTH_URL || request.headers.get("origin") !== new URL(serverEnv.AUTH_URL).origin) {
    throw new AuthAccessError(403);
  }
}

async function contextEffectId(context: EffectKeywordRouteContext) {
  return validateCommand(effectIdSchema, (await context.params).effectId);
}

export async function POST(request: Request, context: EffectKeywordRouteContext) {
  try {
    const session = await requireRole("admin");
    requireSameOrigin(request);
    const effectId = await contextEffectId(context);
    const body = validateCommand(createEffectKeywordSchema, await readCommandJson(request));
    return commandResponse(
      managedEffectAdminItemSchema,
      await service.createKeyword({ actorId: session.user.id, effectId, ...body }),
      201,
    );
  } catch (error) {
    return commandFailure(error);
  }
}

export async function PATCH(request: Request, context: EffectKeywordRouteContext) {
  try {
    const session = await requireRole("admin");
    requireSameOrigin(request);
    const effectId = await contextEffectId(context);
    const body = validateCommand(updateEffectKeywordSchema, await readCommandJson(request));
    return commandResponse(
      managedEffectAdminItemSchema,
      await service.updateKeyword({ actorId: session.user.id, effectId, ...body }),
    );
  } catch (error) {
    return commandFailure(error);
  }
}

export async function DELETE(request: Request, context: EffectKeywordRouteContext) {
  try {
    const session = await requireRole("admin");
    requireSameOrigin(request);
    const effectId = await contextEffectId(context);
    const body = validateCommand(deleteEffectKeywordSchema, await readCommandJson(request));
    return commandResponse(
      managedEffectAdminItemSchema,
      await service.deleteKeyword({ actorId: session.user.id, effectId, ...body }),
    );
  } catch (error) {
    return commandFailure(error);
  }
}
