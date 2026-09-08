import { PrismaChapterCommandService } from "@/lib/services/prisma-chapter-command-service";
import { storyMutationRoute } from "@/lib/http/story-command-route";
import { createChapterSchema, chapterSchema } from "@/lib/validation/story-command-schema";

export const POST = storyMutationRoute({
  scope: "story", body: createChapterSchema.omit({ actorId: true, storyId: true }), output: chapterSchema, status: 201,
  execute: (body, { actorId, storyId }) => new PrismaChapterCommandService().createChapter({ ...body, actorId, storyId }),
});
