import { requireRole } from "@/lib/auth/guards";
import { commandFailure, publicResponse } from "@/lib/http/command-response";
import { connectionStatus } from "@/lib/integrations/freesound/oauth";
import { quotaService } from "@/lib/integrations/freesound/runtime";
import { integrationStatusSchema } from "@/lib/validation/audio-asset-schema";
export async function GET() {
  try {
    const { user } = await requireRole("author");
    const [freesound_connection, freesound_import_quota] = await Promise.all([connectionStatus(user.id), quotaService().read(user.id, "freesound_import")]);
    return publicResponse(integrationStatusSchema, { freesound_connection, freesound_import_quota });
  } catch (e) { return commandFailure(e); }
}
