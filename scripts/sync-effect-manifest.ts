import { loadEnvConfig } from "@next/env";
import { buildEffectKeywordSeed } from "@/lib/effects/effect-keywords";
import { ADMIN_MANAGED_EFFECT_TYPES } from "@/lib/effects/effect-management";
import { EffectManifestSyncError, syncEffectManifestForDeployment } from "@/lib/effects/effect-manifest-sync";
import { EFFECT_PRESENTATION_SEED } from "@/lib/effects/effect-seed";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

async function run() {
  const { prisma } = await import("@/lib/db/prisma");
  const definitions = ADMIN_MANAGED_EFFECT_TYPES.map((effectId) => ({
    effectId,
    label: EFFECT_PRESENTATION_SEED[effectId].label,
    description: EFFECT_PRESENTATION_SEED[effectId].description,
    isActive: true,
  }));
  const keywords = buildEffectKeywordSeed().entries;
  try {
    const report = await prisma.$transaction(
      (tx) => syncEffectManifestForDeployment(tx, definitions, keywords),
      { isolationLevel: "Serializable", maxWait: 10_000, timeout: 30_000 },
    );
    console.log(JSON.stringify({ event: "effect_manifest_sync_completed", ...report }));
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((error: unknown) => {
  if (error instanceof EffectManifestSyncError) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  // Never emit DB errors: adapter messages can contain connection details or row values.
  console.error("Effect manifest sync failed. Verify the database and technical manifest IDs.");
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : null;
  if (code) console.error(`Code: ${code}`);
  if (error instanceof Error) console.error(`Type: ${error.name}`);
  process.exitCode = 1;
});
