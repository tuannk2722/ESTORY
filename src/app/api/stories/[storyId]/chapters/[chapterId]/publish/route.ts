import { PrismaChapterCommandService } from "@/lib/services/prisma-chapter-command-service";
import { storyMutationRoute } from "@/lib/http/story-command-route";
import { managedChapterSchema, publishChapterSchema } from "@/lib/validation/story-command-schema";

export const PATCH = storyMutationRoute({
  scope: "chapter", body: publishChapterSchema.omit({ actorId: true, storyId: true, chapterId: true }), output: managedChapterSchema,
  execute: (body, context) => new PrismaChapterCommandService().setChapterPublication({ ...body, ...context }),
});
