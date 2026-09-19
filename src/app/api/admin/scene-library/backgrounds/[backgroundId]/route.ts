import { requireRole } from "@/lib/auth/guards";
import { requireAdminSameOrigin } from "@/lib/http/admin-same-origin";
import { commandFailure, commandResponse, readCommandJson } from "@/lib/http/command-response";
import { AdminSceneCatalogService } from "@/lib/services/admin-scene-catalog-service";
import {
  backgroundMutationSchema,
  deleteCatalogItemSchema,
  managedBackgroundAssetSchema,
  sceneCatalogDeletionResultSchema,
  sceneCatalogIdSchema,
} from "@/lib/validation/scene-catalog-schema";
import { validateCommand } from "@/lib/validation/story-command-schema";

const service = new AdminSceneCatalogService();
type BackgroundRouteContext = { params: Promise<{ backgroundId: string }> };

async function itemId(context: BackgroundRouteContext): Promise<string> {
  return validateCommand(sceneCatalogIdSchema, (await context.params).backgroundId);
}
export async function PATCH(request: Request, context: BackgroundRouteContext) {
  try {
    const session = await requireRole("admin");
    requireAdminSameOrigin(request);
    const [backgroundId, body] = await Promise.all([
      itemId(context),
      readCommandJson(request).then((input) => validateCommand(backgroundMutationSchema, input)),
    ]);
    const result = body.action === "update"
      ? await service.updateBackground({ actorId: session.user.id, itemId: backgroundId, ...body })
      : await service.transition({ actorId: session.user.id, itemId: backgroundId, kind: "background", ...body });
    return commandResponse(managedBackgroundAssetSchema, result);
  } catch (error) {
    return commandFailure(error);
  }
}

export async function DELETE(request: Request, context: BackgroundRouteContext) {
  try {
    const session = await requireRole("admin");
    requireAdminSameOrigin(request);
    const [backgroundId, body] = await Promise.all([
      itemId(context),
      readCommandJson(request).then((input) => validateCommand(deleteCatalogItemSchema, input)),
    ]);
    return commandResponse(
      sceneCatalogDeletionResultSchema,
      await service.delete({ actorId: session.user.id, itemId: backgroundId, kind: "background", ...body }),
    );
  } catch (error) {
    return commandFailure(error);
  }
}
