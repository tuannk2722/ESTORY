import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { AuthAccessError, hasMinimumRole } from "@/lib/auth/policy";
import { requireChapterInStory, requireStoryOwnerOrAdmin, requireStoryMutable } from "@/lib/auth/story-policy";
import type { StoryAccessRecord, StoryActor } from "@/lib/auth/story-policy";
import { PrismaStoryCommandRepository } from "@/lib/repositories/prisma-story-command-repository";
import { loadRuntimePrismaClient } from "@/lib/repositories/prisma-read-client";
import type { CommandResult, StoryCommandContext } from "./story-command-service";
import { mapCommandDatabaseError } from "./command-error";

export type CommandRepositoryFactory = (tx: Prisma.TransactionClient) => PrismaStoryCommandRepository;
export interface AuthorizedStory {
  repository: PrismaStoryCommandRepository; actor: StoryActor; story: StoryAccessRecord;
}

export async function authorizeStory(repository: PrismaStoryCommandRepository, actorId: string, storyId: string, chapterId?: string): Promise<AuthorizedStory> {
  const actor = await repository.getActor(actorId);
  if (!hasMinimumRole(actor.role, "author")) throw new AuthAccessError(403);
  const story = await repository.getAccessRecord(storyId);
  requireStoryOwnerOrAdmin(actor, story);
  if (chapterId !== undefined) requireChapterInStory(story, await repository.getChapterRecord(chapterId, story.id));
  return { repository, actor, story };
}

export class StoryCommandTransactions {
  constructor(
    private readonly clientSource: () => Promise<PrismaClient> = loadRuntimePrismaClient,
    private readonly repositoryFactory: CommandRepositoryFactory = (tx) => new PrismaStoryCommandRepository(tx),
  ) {}

  async transaction<T>(work: (repository: PrismaStoryCommandRepository) => Promise<T>): Promise<T> {
    const db = await this.clientSource();
    try {
      return await db.$transaction((tx) => work(this.repositoryFactory(tx)), {
        isolationLevel: "Serializable", maxWait: 10_000, timeout: 30_000,
      });
    } catch (error) { return mapCommandDatabaseError(error); }
  }

  mutate<T>(input: StoryCommandContext & { chapterId?: string }, mutable: boolean,
    work: (context: AuthorizedStory, updatedAt: Date) => Promise<T>): Promise<CommandResult<T>> {
    return this.transaction(async (repository) => {
      const context = await authorizeStory(repository, input.actorId, input.storyId, input.chapterId);
      if (mutable) requireStoryMutable(context.actor, context.story);
      const updatedAt = await repository.advanceRevision(context.story, input.expectedUpdatedAt);
      const data = await work(context, updatedAt);
      return { data, meta: { updatedAt: updatedAt.toISOString() } };
    });
  }
}
