import { requireRole } from "@/lib/auth/guards";
import { AuthAccessError } from "@/lib/auth/policy";
import { serverEnv } from "@/lib/env";
import {
  commandFailure,
  commandResponse,
  publicResponse,
  readCommandJson,
} from "@/lib/http/command-response";
import { AdminEffectService } from "@/lib/services/admin-effect-service";
import { validateCommand } from "@/lib/validation/story-command-schema";
import {
  effectAdminListSchema,
  managedEffectAdminItemSchema,
  parseEffectAdminSearchParams,
  updateEffectOverlaySchema,
} from "@/lib/validation/effect-admin-schema";

const service = new AdminEffectService();

function requireSameOrigin(request: Request): void {
  if (!serverEnv.AUTH_URL || request.headers.get("origin") !== new URL(serverEnv.AUTH_URL).origin) {
    throw new AuthAccessError(403);
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireRole("admin");
    const url = new URL(request.url);
    const query = parseEffectAdminSearchParams({
      q: url.searchParams.getAll("q"),
      category: url.searchParams.getAll("category"),
      status: url.searchParams.getAll("status"),
      cursor: url.searchParams.getAll("cursor"),
    });
    return publicResponse(effectAdminListSchema, await service.list(session.user.id, query));
  } catch (error) {
    return commandFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireRole("admin");
    requireSameOrigin(request);
    const body = validateCommand(updateEffectOverlaySchema, await readCommandJson(request));
    return commandResponse(
      managedEffectAdminItemSchema,
      await service.updateOverlay({ actorId: session.user.id, ...body }),
    );
  } catch (error) {
    return commandFailure(error);
  }
}
