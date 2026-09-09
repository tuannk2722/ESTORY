import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";

export async function createReaderSyncFixture(db: PrismaClient) {
  const prefix = `sync-${randomUUID()}`;
  const users: string[] = [];
  const stories: string[] = [];
  async function cleanup() {
    await db.session.deleteMany({ where: { userId: { in: users } } });
    await db.bookmark.deleteMany({ where: { userId: { in: users } } });
    await db.readingProgress.deleteMany({ where: { userId: { in: users } } });
    await db.userSettings.deleteMany({ where: { userId: { in: users } } });
    await db.effect.deleteMany({ where: { block: { chapter: { storyId: { in: stories } } } } });
    await db.scene.deleteMany({ where: { chapter: { storyId: { in: stories } } } });
    await db.storyBlock.deleteMany({ where: { chapter: { storyId: { in: stories } } } });
    await db.chapter.deleteMany({ where: { storyId: { in: stories } } });
    await db.story.deleteMany({ where: { id: { in: stories } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
  }
  try {
    for (let index = 0; index < 4; index++) {
      const user = await db.user.create({ data: { email: `${prefix}-${index}@example.invalid`, role: index === 3 ? "AUTHOR" : "READER" } });
      users.push(user.id);
    }
    for (let index = 0; index < 2; index++) {
      const story = await db.story.create({ data: {
        slug: `${prefix}-story-${index}`, title: `Sync fixture ${index}`, authorDisplayName: "Sync Author", authorId: users[3],
        status: "PUBLISHED", description: "Disposable sync fixture", genre: ["test"],
        chapters: { create: Array.from({ length: 2 }, (_, chapter) => ({
          id: `${prefix}-chapter-${index}-${chapter}`, title: `Chapter ${chapter}`, order: chapter + 1, status: "PUBLISHED" as const,
          blocks: { create: Array.from({ length: 5 }, (_, block) => ({
            id: `${prefix}-block-${index}-${chapter}-${block}`, type: "paragraph", order: block,
            text: (`Readable sync fixture block ${block}. `).repeat(75),
          })) },
        })) },
      } });
      stories.push(story.id);
    }
    return { prefix, users, stories, slug: (index = 0) => `${prefix}-story-${index}`,
      chapter: (story = 0, chapter = 0) => `${prefix}-chapter-${story}-${chapter}`,
      block: (story = 0, chapter = 0, block = 0) => `${prefix}-block-${story}-${chapter}-${block}`, cleanup };
  } catch (error) { await cleanup(); throw error; }
}
