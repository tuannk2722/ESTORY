import { requireRole } from "@/lib/auth/guards";
import { AuthAccessError } from "@/lib/auth/policy";
import { serverEnv } from "@/lib/env";
import {
  commandFailure,
  commandResponse,
  readCommandJson,
} from "@/lib/http/command-response";
import type { CommandRouteContext } from "@/lib/http/story-command-route";
import { CommandError } from "@/lib/services/command-error";
import { StoryModerationService } from "@/lib/services/story-moderation-service";
import { idSchema, validateCommand } from "@/lib/validation/story-command-schema";
import {
  moderationDecisionSchema,
  rejectStorySchema,
} from "@/lib/validation/story-moderation-schema";

const service = new StoryModerationService();

export async function POST(request: Request, context: CommandRouteContext) {
  try {
    const session = await requireRole("admin");
    if (!serverEnv.AUTH_URL || request.headers.get("origin") !== new URL(serverEnv.AUTH_URL).origin) {
      throw new AuthAccessError(403);
    }
    const storyId = validateCommand(idSchema, (await context.params).storyId);
    const body = validateCommand(rejectStorySchema, await readCommandJson(request));
    if (serverEnv.PHASE3_STORY_WRITE_SOURCE !== "prisma") {
      throw new CommandError(503, "WRITES_DISABLED", "Content writes are disabled during the database transition.");
    }
    return commandResponse(
      moderationDecisionSchema,
      await service.reject({ actorId: session.user.id, storyId, ...body }),
    );
  } catch (error) {
    return commandFailure(error);
  }
}
