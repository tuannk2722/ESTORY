import { requireRole } from "@/lib/auth/guards";
import { PrismaStoryCommandService } from "@/lib/services/prisma-story-command-service";
import { StoryDataAccess } from "@/lib/services/story-dal";
import { storyMutationRoute } from "@/lib/http/story-command-route";
import { commandFailure, publicResponse } from "@/lib/http/command-response";
import { authorStoryListSchema, createStorySchema, storySchema } from "@/lib/validation/story-command-schema";

export async function GET() {
  try {
    const session = await requireRole("author");
    const stories = await new StoryDataAccess().getStoriesForAuthor(session.user.id);
    return publicResponse(authorStoryListSchema, stories);
  } catch (error) { return commandFailure(error); }
}

export const POST = storyMutationRoute({
  scope: "create", body: createStorySchema.omit({ actorId: true }), output: storySchema, status: 201,
  execute: (body, { actorId }) => new PrismaStoryCommandService().createStoryWithChapters({ ...body, actorId }),
});
