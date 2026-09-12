import { PrismaSceneCommandService } from "@/lib/services/prisma-scene-command-service";
import { storyMutationRoute, storyReadRoute } from "@/lib/http/story-command-route";
import { replaceEditorSchema, editorDataSchema } from "@/lib/validation/story-command-schema";

export const GET = storyReadRoute(editorDataSchema, "editor");
export const PUT = storyMutationRoute({
  scope: "chapter", body: replaceEditorSchema.omit({ actorId: true, storyId: true, chapterId: true }), output: editorDataSchema,
  execute: (body, context) => new PrismaSceneCommandService().replaceEditor({ ...body, ...context }),
});
