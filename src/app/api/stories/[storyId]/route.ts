import { storyRepository } from "@/lib/repositories";
import { PrismaStoryCommandService } from "@/lib/services/prisma-story-command-service";
import { z } from "zod";
import { notFound } from "@/lib/services/command-error";
import { storyMutationRoute, type CommandRouteContext } from "@/lib/http/story-command-route";
import { commandFailure, publicResponse } from "@/lib/http/command-response";
import { deleteStorySchema, idSchema, managedStorySchema, storySchema, updateStorySchema, validateCommand } from "@/lib/validation/story-command-schema";

/** Full owner/admin data and concurrency metadata use the separate /manage endpoint. */
export async function GET(_request: Request, { params }: CommandRouteContext) {
  try {
    const storyId = validateCommand(idSchema, (await params).storyId);
    const story = await storyRepository.getPublicById(storyId) ?? notFound();
    return publicResponse(storySchema, story);
  } catch (error) { return commandFailure(error); }
}
export const PUT = storyMutationRoute({
  scope: "story", body: updateStorySchema.omit({ actorId: true, storyId: true }), output: managedStorySchema,
  execute: (body, { actorId, storyId }) => new PrismaStoryCommandService().updateStoryMetadata({ ...body, actorId, storyId }),
});
export const DELETE = storyMutationRoute({
  scope: "story", body: deleteStorySchema.omit({ actorId: true, storyId: true }), output: z.null(),
  execute: (body, { actorId, storyId }) => new PrismaStoryCommandService().deleteStory({ ...body, actorId, storyId }),
});
