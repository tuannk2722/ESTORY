import { z } from "zod";
import { PrismaChapterCommandService } from "@/lib/services/prisma-chapter-command-service";
import { PrismaSceneCommandService } from "@/lib/services/prisma-scene-command-service";
import { storyMutationRoute } from "@/lib/http/story-command-route";
import { chapterContextSchema, replaceContentSchema, updateChapterSchema, chapterSchema, managedChapterSchema } from "@/lib/validation/story-command-schema";

const contextFields = { actorId: true, storyId: true, chapterId: true } as const;
export const PUT = storyMutationRoute({
  scope: "chapter", body: replaceContentSchema.omit(contextFields), output: chapterSchema,
  execute: (body, context) => new PrismaSceneCommandService().replaceChapterContent({ ...body, ...context }),
});
export const PATCH = storyMutationRoute({
  scope: "chapter", body: updateChapterSchema.omit(contextFields), output: managedChapterSchema,
  execute: (body, context) => new PrismaChapterCommandService().updateChapterMetadata({ ...body, ...context }),
});
export const DELETE = storyMutationRoute({
  scope: "chapter", body: chapterContextSchema.omit(contextFields), output: z.null(),
  execute: (body, context) => new PrismaChapterCommandService().deleteChapter({ ...body, ...context }),
});
