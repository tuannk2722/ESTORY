import { requireRole } from "@/lib/auth/guards";
import { requireAdminSameOrigin } from "@/lib/http/admin-same-origin";
import {
  commandFailure,
  publicResponse,
} from "@/lib/http/command-response";
import { AdminSceneCatalogService } from "@/lib/services/admin-scene-catalog-service";
import {
  paletteAdminListSchema,
  parsePaletteAdminSearchParams,
} from "@/lib/validation/scene-catalog-schema";
import { CommandError } from "@/lib/services/command-error";

const service = new AdminSceneCatalogService();

export async function GET(request: Request) {
  try {
    const session = await requireRole("admin");
    const url = new URL(request.url);
    const query = parsePaletteAdminSearchParams({
      q: url.searchParams.getAll("q"),
      status: url.searchParams.getAll("status"),
      cursor: url.searchParams.getAll("cursor"),
    });
    return publicResponse(paletteAdminListSchema, await service.listPalettes(session.user.id, query));
  } catch (error) {
    return commandFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    await requireRole("admin");
    requireAdminSameOrigin(request);
    throw new CommandError(410, "PALETTE_CATALOG_RETIRED", "Palette catalog is read-only after the Scene v2 cutover");
  } catch (error) {
    return commandFailure(error);
  }
}
