import { requireRole } from "@/lib/auth/guards";
import { commandFailure } from "@/lib/http/command-response";
import { assertMutationOrigin } from "@/lib/http/mutation-origin";
import { audioTranscodeSpike } from "../../../../../scripts/spike-audio-transcode";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request) {
  try {
    await requireRole("admin"); assertMutationOrigin(request);
    return Response.json({ data: await audioTranscodeSpike() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return commandFailure(e); }
}
