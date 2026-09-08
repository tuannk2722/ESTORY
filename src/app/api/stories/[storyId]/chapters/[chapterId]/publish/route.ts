import { PrismaChapterCommandService } from "@/lib/services/prisma-chapter-command-service";
import { storyMutationRoute } from "@/lib/http/story-command-route";
import { publishChapterSchema, chapterSchema } from "@/lib/validation/story-command-schema";

export const PATCH = storyMutationRoute({
  scope: "chapter", body: publishChapterSchema.omit({ actorId: true, storyId: true, chapterId: true }), output: chapterSchema,
  execute: (body, context) => new PrismaChapterCommandService().setChapterPublication({ ...body, ...context }),
});
