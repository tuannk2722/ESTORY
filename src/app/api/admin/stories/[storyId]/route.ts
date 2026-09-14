import { requireRole } from "@/lib/auth/guards";
import { commandFailure, commandResponse } from "@/lib/http/command-response";
import type { CommandRouteContext } from "@/lib/http/story-command-route";
import { StoryDataAccess } from "@/lib/services/story-dal";
import { idSchema, validateCommand } from "@/lib/validation/story-command-schema";
import { moderationDetailSchema } from "@/lib/validation/story-moderation-schema";

const dataAccess = new StoryDataAccess();

export async function GET(_request: Request, context: CommandRouteContext) {
  try {
    const session = await requireRole("admin");
    const storyId = validateCommand(idSchema, (await context.params).storyId);
    return commandResponse(
      moderationDetailSchema,
      await dataAccess.getModerationDetail(session.user.id, storyId),
    );
  } catch (error) {
    return commandFailure(error);
  }
}
