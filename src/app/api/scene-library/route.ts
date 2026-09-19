import { requireRole } from "@/lib/auth/guards";
import { commandFailure, publicResponse } from "@/lib/http/command-response";
import { sceneLibraryRepository } from "@/lib/repositories";
import { sceneAuthoringLibraryDataSchema } from "@/lib/validation/scene-catalog-schema";

export async function GET() {
  try {
    await requireRole("author");
    const backgrounds = await sceneLibraryRepository.getActiveGlobalBackgrounds();
    return publicResponse(sceneAuthoringLibraryDataSchema, { backgrounds });
  } catch (error) {
    return commandFailure(error);
  }
}
