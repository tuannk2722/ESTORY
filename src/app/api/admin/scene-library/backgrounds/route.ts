import { requireRole } from "@/lib/auth/guards";
import { requireAdminSameOrigin } from "@/lib/http/admin-same-origin";
import {
  commandFailure,
  commandResponse,
  publicResponse,
  readCommandJson,
} from "@/lib/http/command-response";
import { AdminSceneCatalogService } from "@/lib/services/admin-scene-catalog-service";
import {
  backgroundAdminListSchema,
  createBackgroundSchema,
  managedBackgroundAssetSchema,
  parseBackgroundAdminSearchParams,
} from "@/lib/validation/scene-catalog-schema";
import { validateCommand } from "@/lib/validation/story-command-schema";

const service = new AdminSceneCatalogService();

export async function GET(request: Request) {
  try {
    const session = await requireRole("admin");
    const url = new URL(request.url);
    const query = parseBackgroundAdminSearchParams({
      q: url.searchParams.getAll("q"),
      type: url.searchParams.getAll("type"),
      motion: url.searchParams.getAll("motion"),
      status: url.searchParams.getAll("status"),
      cursor: url.searchParams.getAll("cursor"),
    });
    return publicResponse(backgroundAdminListSchema, await service.listBackgrounds(session.user.id, query));
  } catch (error) {
    return commandFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const session = await requireRole("admin");
    requireAdminSameOrigin(request);
    const body = validateCommand(createBackgroundSchema, await readCommandJson(request));
    return commandResponse(
      managedBackgroundAssetSchema,
      await service.createBackground({ actorId: session.user.id, ...body }),
      201,
    );
  } catch (error) {
    return commandFailure(error);
  }
}
