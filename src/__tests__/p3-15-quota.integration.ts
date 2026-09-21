import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { QuotaService } from "@/lib/services/quota-service";
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

async function run() {
  const { prisma } = await import("@/lib/db/prisma");
  const { PrismaQuotaStore } = await import("@/lib/repositories/prisma-quota-store");
  const ids: string[] = [];
  try {
    for (let i = 0; i < 2; i++) {
      const user = await prisma.user.create({ data: {
        email: `quota-${randomUUID()}@example.invalid`, role: "AUTHOR",
        freesoundImportQuotaLimit: 3, aiBackgroundQuotaLimit: 1,
      } });
      ids.push(user.id);
    }
    let now = new Date("2030-12-31T23:59:59Z");
    const store = new PrismaQuotaStore(async () => prisma);
    const service = new QuotaService(store, () => now);
    assert.equal((await service.read(ids[0], "freesound_import")).reset_at, "2031-01-01T00:00:00.000Z");
    const attempts = await Promise.allSettled(Array.from({ length: 12 }, () => service.reserve(ids[0], "freesound_import")));
    const accepted = attempts.filter((x) => x.status === "fulfilled").map((x) => x.value);
    assert.equal(accepted.length, 3);
    assert.equal((await service.read(ids[0], "freesound_import")).used, 3);
    assert.equal((await service.read(ids[1], "freesound_import")).used, 0);
    const ai = await service.reserve(ids[0], "ai_background");
    await Promise.all([ai.refund(), ai.refund(), ai.commit()]);
    assert.equal((await service.read(ids[0], "ai_background")).used, 0);
    await accepted[0].commit();
    await accepted[0].refund();
    assert.equal((await service.read(ids[0], "freesound_import")).used, 3);
    now = new Date("2031-01-01T00:00:00Z");
    const today = await service.reserve(ids[0], "freesound_import");
    await accepted[1].refund();
    assert.equal((await service.read(ids[0], "freesound_import")).used, 1, "Previous-day refund must not decrement today");
    await today.refund();
    assert.equal((await service.read(ids[0], "freesound_import")).used, 0);
    console.log("P3-15 quota DB: UTC rollover, isolation, concurrent cap and settlement passed");
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
}
run().catch((error: unknown) => {
  console.error("P3-15 quota DB failed", error instanceof assert.AssertionError ? error.message :
    error && typeof error === "object" && "code" in error ? error.code : "unclassified");
  process.exitCode = 1;
});
