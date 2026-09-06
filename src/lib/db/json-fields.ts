import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { backgroundRenderSnapshotSchema, sceneRenderConfigSchema } from "@/lib/scenes/scene-render-config";

const effectsByCategorySchema = z.strictObject({
  visual: z.boolean(), audio: z.boolean(), motion: z.boolean(), transition: z.boolean(),
});

function jsonField<S extends z.ZodType>(field: string, schema: S) {
  function read(input: unknown): z.output<S> {
    const result = schema.safeParse(input);
    if (!result.success) {
      // Do not include malformed story content/media URLs in application logs.
      throw new Error(`Invalid database JSON: ${field}`);
    }
    return result.data;
  }
  return {
    read,
    write(input: unknown): Prisma.InputJsonValue {
      // Only validated, JSON-serializable domain data crosses the Prisma input
      // boundary; the round trip also removes optional undefined properties.
      return JSON.parse(JSON.stringify(read(input))) as Prisma.InputJsonValue;
    },
  };
}

// Repositories and commands must use these codecs before returning/writing
// database JSON. Schema migrations do not make a Json column trustworthy.
export const databaseJson = {
  backgroundRender: jsonField("BackgroundAsset.render", backgroundRenderSnapshotSchema),
  sceneRenderConfig: jsonField("Scene.renderConfig", sceneRenderConfigSchema),
  presetRenderConfig: jsonField("ScenePreset.renderConfig", sceneRenderConfigSchema),
  effectsByCategory: jsonField("UserSettings.effectsByCategory", effectsByCategorySchema),
};
