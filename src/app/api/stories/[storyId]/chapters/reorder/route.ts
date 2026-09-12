import { z } from "zod";
import { PrismaChapterCommandService } from "@/lib/services/prisma-chapter-command-service";
import { storyMutationRoute } from "@/lib/http/story-command-route";
import { chapterOrderSchema, reorderChaptersSchema } from "@/lib/validation/story-command-schema";

export const PATCH = storyMutationRoute({
  scope: "story", body: reorderChaptersSchema.omit({ actorId: true, storyId: true }), output: z.array(chapterOrderSchema),
  execute: (body, { actorId, storyId }) => new PrismaChapterCommandService().reorderChapters({ ...body, actorId, storyId }),
});
