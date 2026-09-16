import { requireRole } from "@/lib/auth/guards";
import { EffectCatalogService } from "@/lib/effects/effect-catalog-service";
import { commandFailure, publicResponse } from "@/lib/http/command-response";
import { effectAuthorCatalogSchema } from "@/lib/validation/effect-admin-schema";

const service = new EffectCatalogService();

export async function GET() {
  try {
    await requireRole("author");
    return publicResponse(effectAuthorCatalogSchema, await service.getActiveCatalog());
  } catch (error) {
    return commandFailure(error);
  }
}
