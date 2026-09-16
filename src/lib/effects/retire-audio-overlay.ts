import type { Prisma } from "@/generated/prisma/client";

/** Post-deploy data migration. Never runs as part of pre-deploy manifest sync. */
export async function retireAudioOverlay(
  tx: Prisma.TransactionClient,
  backup: (snapshot: unknown) => Promise<void>,
): Promise<{ removedOverlayCount: number; removedKeywordCount: number }> {
  const overlay = await tx.effectDefinition.findUnique({
    where: { effectId: "audio" }, include: { keywords: true },
  });
  if (!overlay) return { removedOverlayCount: 0, removedKeywordCount: 0 };
  // Backup failure aborts the transaction. Never delete story effects, assets or files.
  await backup({ version: 1, kind: "retired-audio-overlay", overlay });
  await tx.effectDefinition.delete({ where: { effectId: "audio" } });
  return { removedOverlayCount: 1, removedKeywordCount: overlay.keywords.length };
}
