import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { commandFailure, publicResponse, readCommandJson } from "@/lib/http/command-response";
import { assertMutationOrigin } from "@/lib/http/mutation-origin";
import { validateCommand } from "@/lib/validation/story-command-schema";
import { audioAssetSchema, claimAudioSchema } from "@/lib/validation/audio-asset-schema";
import { PrismaAudioAssetRepository } from "@/lib/repositories/prisma-audio-asset-repository";
export const runtime = "nodejs";
export async function GET() {
  try { const { user } = await requireRole("author"); return publicResponse(z.array(audioAssetSchema), await new PrismaAudioAssetRepository().getByOwner(user.id)); }
  catch (e) { return commandFailure(e); }
}
export async function POST(request: Request) {
  try {
    const { user } = await requireRole("author"); assertMutationOrigin(request);
    const input = validateCommand(claimAudioSchema, await readCommandJson(request));
    return publicResponse(audioAssetSchema, await new PrismaAudioAssetRepository().claimUpload(user.id, input.uploadId, input.title));
  } catch (e) { return commandFailure(e); }
}
