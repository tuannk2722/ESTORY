import "server-only";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { AuthAccessError } from "@/lib/auth/policy";
import { serverEnv } from "@/lib/env";
import { StoryDataAccess } from "@/lib/services/story-dal";
import { CommandError } from "@/lib/services/command-error";
import type { CommandResult } from "@/lib/services/story-command-service";
import { idSchema, validateCommand } from "@/lib/validation/story-command-schema";
import { commandFailure, commandResponse, readCommandJson } from "./command-response";

export interface CommandRouteContext { params: Promise<Record<string, string>> }
interface ActorRouteContext { actorId: string; storyId: string; chapterId: string }
const dal = new StoryDataAccess();

export function storyMutationRoute<S extends z.ZodType>(options: {
  scope: "create" | "story" | "chapter";
  body: S;
  output: z.ZodType;
  status?: number;
  execute: (body: z.output<S>, context: ActorRouteContext) => Promise<CommandResult<unknown>>;
}) {
  return async (request: Request, context: CommandRouteContext) => {
    try {
      const session = await requireRole(options.scope === "create" ? "reader" : "author");
      if (!serverEnv.AUTH_URL || request.headers.get("origin") !== new URL(serverEnv.AUTH_URL).origin) throw new AuthAccessError(403);
      const params = await context.params;
      const storyId = options.scope === "create" ? "" : validateCommand(idSchema, params.storyId);
      const chapterId = options.scope === "chapter" ? validateCommand(idSchema, params.chapterId) : "";
      if (storyId) await dal.authorize(session.user.id, storyId, chapterId || undefined);
      const body = validateCommand(options.body, await readCommandJson(request));
      if (serverEnv.PHASE3_STORY_WRITE_SOURCE !== "prisma") {
        throw new CommandError(503, "WRITES_DISABLED", "Content writes are disabled during the database transition.");
      }
      const result = await options.execute(body, { actorId: session.user.id, storyId, chapterId });
      return commandResponse(options.output, result, options.status);
    } catch (error) { return commandFailure(error); }
  };
}

export function storyReadRoute(output: z.ZodType, mode: "story" | "managed" | "editor" = "story") {
  return async (_request: Request, context: CommandRouteContext) => {
    try {
      const session = await requireRole("author");
      const params = await context.params;
      const storyId = validateCommand(idSchema, params.storyId);
      const result = mode === "editor"
        ? await dal.getEditor(session.user.id, storyId, validateCommand(idSchema, params.chapterId))
        : mode === "managed"
          ? await dal.getManagedStory(session.user.id, storyId)
          : await dal.getStory(session.user.id, storyId);
      return commandResponse(output, result);
    } catch (error) { return commandFailure(error); }
  };
}
