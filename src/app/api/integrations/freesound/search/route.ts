import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { commandFailure, publicResponse } from "@/lib/http/command-response";
import { validateCommand } from "@/lib/validation/story-command-schema";
import { freesoundSearchSchema } from "@/lib/validation/audio-asset-schema";
import { soundSchema } from "@/lib/integrations/freesound/client";
import { searchFreesound } from "@/lib/integrations/freesound/search";
export async function GET(request: Request) {
  try {
    const { user } = await requireRole("author");
    const input = validateCommand(freesoundSearchSchema, Object.fromEntries(new URL(request.url).searchParams));
    return publicResponse(z.object({ count: z.number(), results: z.array(soundSchema), hasMore: z.boolean() }), await searchFreesound(user.id, input.q, input.page));
  } catch (e) { return commandFailure(e); }
}
