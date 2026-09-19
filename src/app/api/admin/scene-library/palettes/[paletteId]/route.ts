import { requireRole } from "@/lib/auth/guards";
import { requireAdminSameOrigin } from "@/lib/http/admin-same-origin";
import { commandFailure } from "@/lib/http/command-response";
import {
  sceneCatalogIdSchema,
} from "@/lib/validation/scene-catalog-schema";
import { validateCommand } from "@/lib/validation/story-command-schema";
import { CommandError } from "@/lib/services/command-error";

type PaletteRouteContext = { params: Promise<{ paletteId: string }> };

async function itemId(context: PaletteRouteContext): Promise<string> {
  return validateCommand(sceneCatalogIdSchema, (await context.params).paletteId);
}
export async function PATCH(request: Request, context: PaletteRouteContext) {
  try {
    await requireRole("admin");
    requireAdminSameOrigin(request);
    await itemId(context);
    throw new CommandError(410, "PALETTE_CATALOG_RETIRED", "Palette catalog is read-only after the Scene v2 cutover");
  } catch (error) {
    return commandFailure(error);
  }
}

export async function DELETE(request: Request, context: PaletteRouteContext) {
  try {
    await requireRole("admin");
    requireAdminSameOrigin(request);
    await itemId(context);
    throw new CommandError(410, "PALETTE_CATALOG_RETIRED", "Palette catalog is read-only after the Scene v2 cutover");
  } catch (error) {
    return commandFailure(error);
  }
}
