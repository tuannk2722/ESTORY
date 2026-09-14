import { loadEnvConfig } from "@next/env";
import { Prisma } from "@/generated/prisma/client";
import { PrismaStoryRepository } from "@/lib/repositories/prisma-story-repository";
import { normalizeSearchText } from "@/lib/search/text-search";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

interface PlanNode {
  "Node Type"?: string;
  "Actual Total Time"?: number;
  "Shared Hit Blocks"?: number;
  "Shared Read Blocks"?: number;
}

async function run() {
  const { prisma } = await import("@/lib/db/prisma");
  try {
    const [dataset, published, sample] = await Promise.all([
      prisma.story.count(),
      prisma.story.count({ where: { status: "PUBLISHED" } }),
      prisma.story.findFirst({
        where: { status: "PUBLISHED" },
        orderBy: { slug: "asc" },
        select: { title: true },
      }),
    ]);
    const token = normalizeSearchText(sample?.title ?? "").split(" ")[0] ?? "";
    const query = { q: token, genre: null, cursor: null, limit: 9 };
    const repository = new PrismaStoryRepository(async () => prisma);
    await repository.listPublicStories(query);
    await repository.listPublicStories(query);
    const durations: number[] = [];
    for (let index = 0; index < 12; index += 1) {
      const start = performance.now();
      await repository.listPublicStories(query);
      durations.push(performance.now() - start);
    }
    durations.sort((left, right) => left - right);
    const p95 = durations[Math.ceil(durations.length * 0.95) - 1];
    const rows = await prisma.$queryRaw<Array<{ "QUERY PLAN": unknown }>>(Prisma.sql`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT s."slug"
      FROM "Story" s
      WHERE s."status" = 'PUBLISHED'::"StoryStatus"
        AND s."searchTextNormalized" LIKE ${`%${token}%`}
      ORDER BY s."slug" ASC
      LIMIT 9
    `);
    const document = rows[0]?.["QUERY PLAN"];
    const root = Array.isArray(document)
      && document[0]
      && typeof document[0] === "object"
      && "Plan" in document[0]
      ? (document[0] as { Plan: PlanNode }).Plan
      : {};
    console.log(JSON.stringify({
      dataset,
      published,
      samples: durations.length,
      p95Ms: Number(p95.toFixed(2)),
      plan: {
        nodeType: root["Node Type"] ?? "unknown",
        actualTotalMs: root["Actual Total Time"] ?? null,
        sharedHitBlocks: root["Shared Hit Blocks"] ?? null,
        sharedReadBlocks: root["Shared Read Blocks"] ?? null,
      },
    }));
  } finally {
    await prisma.$disconnect();
  }
}

run().catch(() => {
  console.error("P3-11 search measurement failed; database details are not logged.");
  process.exitCode = 1;
});
