import "server-only";
import { AuthAccessError } from "@/lib/auth/policy";
import { conflict, notFound } from "./command-error";
import { StoryCommandTransactions } from "./story-command-context";
import {
  approveModerationCommandSchema,
  rejectModerationCommandSchema,
} from "@/lib/validation/story-moderation-schema";
import { validateCommand } from "@/lib/validation/story-command-schema";

export interface ApproveStoryCommand {
  actorId: string;
  storyId: string;
  expectedUpdatedAt: string;
}

export interface RejectStoryCommand extends ApproveStoryCommand {
  reason: string;
}

export class StoryModerationService {
  constructor(private readonly transactions = new StoryCommandTransactions()) {}

  approve(command: ApproveStoryCommand) {
    const input = validateCommand(approveModerationCommandSchema, command);
    return this.transactions.transaction(async (repository) => {
      const actor = await repository.getActor(input.actorId);
      if (actor.role !== "admin") throw new AuthAccessError(403);
      const story = await repository.getAccessRecord(input.storyId);
      if (!story) notFound();
      if (story.status !== "PENDING_REVIEW") {
        conflict("INVALID_STORY_STATE", "Only a pending story can be approved.");
      }
      const reviewedAt = await repository.advanceRevision(story, input.expectedUpdatedAt);
      await repository.approveStory(story.id, actor.id, reviewedAt);
      return {
        data: { storyId: story.slug, status: "published" as const, reviewedAt: reviewedAt.toISOString() },
        meta: { updatedAt: reviewedAt.toISOString() },
      };
    });
  }

  reject(command: RejectStoryCommand) {
    const input = validateCommand(rejectModerationCommandSchema, command);
    return this.transactions.transaction(async (repository) => {
      const actor = await repository.getActor(input.actorId);
      if (actor.role !== "admin") throw new AuthAccessError(403);
      const story = await repository.getAccessRecord(input.storyId);
      if (!story) notFound();
      if (story.status !== "PENDING_REVIEW") {
        conflict("INVALID_STORY_STATE", "Only a pending story can be rejected.");
      }
      const reviewedAt = await repository.advanceRevision(story, input.expectedUpdatedAt);
      await repository.rejectStory(story.id, actor.id, input.reason, reviewedAt);
      return {
        data: { storyId: story.slug, status: "rejected" as const, reviewedAt: reviewedAt.toISOString() },
        meta: { updatedAt: reviewedAt.toISOString() },
      };
    });
  }
}
