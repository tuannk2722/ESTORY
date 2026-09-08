import { PrismaStoryCommandService } from "@/lib/services/prisma-story-command-service";
import { storyMutationRoute } from "@/lib/http/story-command-route";
import { createStorySchema, storySchema } from "@/lib/validation/story-command-schema";

export const POST = storyMutationRoute({
  scope: "create", body: createStorySchema.omit({ actorId: true }), output: storySchema, status: 201,
  execute: (body, { actorId }) => new PrismaStoryCommandService().createStoryWithChapters({ ...body, actorId }),
});
