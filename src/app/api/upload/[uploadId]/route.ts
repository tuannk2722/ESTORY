import { requireSession } from "@/lib/auth/guards";
import { commandFailure, publicResponse } from "@/lib/http/command-response";
import { assertMutationOrigin } from "@/lib/http/mutation-origin";
import { getRuntimeUploadService } from "@/lib/storage/runtime-media-storage";
import { cancelUploadResponseSchema, completeUploadRequestSchema } from "@/lib/validation/media-upload-schema";
import { validateCommand } from "@/lib/validation/story-command-schema";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: RouteContext<"/api/upload/[uploadId]">) {
  try {
    const session = await requireSession();
    assertMutationOrigin(request);
    const { uploadId } = await context.params;
    validateCommand(completeUploadRequestSchema, { uploadId });
    const result = await getRuntimeUploadService().cancelUpload(session.user, uploadId);
    return publicResponse(cancelUploadResponseSchema, result);
  } catch (error) { return commandFailure(error); }
}
