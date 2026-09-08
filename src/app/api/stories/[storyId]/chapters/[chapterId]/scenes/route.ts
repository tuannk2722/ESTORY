import { z } from "zod";
import { PrismaSceneCommandService } from "@/lib/services/prisma-scene-command-service";
import { storyMutationRoute } from "@/lib/http/story-command-route";
import { replaceScenesSchema } from "@/lib/validation/story-command-schema";
import { sceneSchema } from "@/lib/scenes/scene-render-config";

export const PUT = storyMutationRoute({
  scope: "chapter", body: replaceScenesSchema.omit({ actorId: true, storyId: true, chapterId: true }), output: z.array(sceneSchema),
  execute: (body, context) => new PrismaSceneCommandService().replaceChapterScenes({ ...body, ...context }),
});
