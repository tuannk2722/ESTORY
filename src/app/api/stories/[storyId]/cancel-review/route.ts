import { PrismaStoryCommandService } from "@/lib/services/prisma-story-command-service";
import { storyMutationRoute } from "@/lib/http/story-command-route";
import { managedStorySchema, storyContextSchema } from "@/lib/validation/story-command-schema";

export const POST = storyMutationRoute({
  scope: "story", body: storyContextSchema.omit({ actorId: true, storyId: true }), output: managedStorySchema,
  execute: (body, { actorId, storyId }) => new PrismaStoryCommandService().cancelReview({ ...body, actorId, storyId }),
});
