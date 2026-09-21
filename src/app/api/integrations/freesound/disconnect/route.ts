import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { commandFailure, publicResponse } from "@/lib/http/command-response";
import { assertMutationOrigin } from "@/lib/http/mutation-origin";
import { disconnectFreesound } from "@/lib/integrations/freesound/oauth";
export async function POST(request: Request) {
  try {
    const { user } = await requireRole("author"); assertMutationOrigin(request);
    await disconnectFreesound(user.id); return publicResponse(z.object({ connected: z.literal(false) }), { connected: false });
  } catch (e) { return commandFailure(e); }
}
