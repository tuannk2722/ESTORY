import { requireSession } from "@/lib/auth/guards";
import { commandFailure, publicResponse, readCommandJson } from "@/lib/http/command-response";
import { assertMutationOrigin } from "@/lib/http/mutation-origin";
import { getRuntimeUploadService } from "@/lib/storage/runtime-media-storage";
import { presignUploadRequestSchema, presignUploadResponseSchema } from "@/lib/validation/media-upload-schema";
import { validateCommand } from "@/lib/validation/story-command-schema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    assertMutationOrigin(request);
    const input = validateCommand(presignUploadRequestSchema, await readCommandJson(request));
    const result = await getRuntimeUploadService().requestUpload(session.user, input);
    return publicResponse(presignUploadResponseSchema, result);
  } catch (error) { return commandFailure(error); }
}
