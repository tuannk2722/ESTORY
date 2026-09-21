import { requireRole } from "@/lib/auth/guards";
import { commandFailure, publicResponse, readCommandJson } from "@/lib/http/command-response";
import { assertMutationOrigin } from "@/lib/http/mutation-origin";
import { validateCommand } from "@/lib/validation/story-command-schema";
import { audioAssetSchema, importAudioSchema } from "@/lib/validation/audio-asset-schema";
import { importFreesound } from "@/lib/integrations/freesound/import";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request) {
  try {
    const { user } = await requireRole("author"); assertMutationOrigin(request);
    const input = validateCommand(importAudioSchema, await readCommandJson(request));
    return publicResponse(audioAssetSchema, await importFreesound(user.id, input.freesound_sound_id));
  } catch (e) { return commandFailure(e); }
}
