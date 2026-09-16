import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import { retireAudioOverlay } from "@/lib/effects/retire-audio-overlay";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

async function run() {
  const args = process.argv.slice(3);
  const apply = args[0] === "--apply";
  if (args.length && !(apply && args.length === 3 && args[1] === "--backup" && args[2])) {
    throw new Error("INVALID_ARGUMENTS");
  }
  const { prisma } = await import("@/lib/db/prisma");
  try {
    if (!apply) {
      const overlay = await prisma.effectDefinition.findUnique({
        where: { effectId: "audio" }, select: { _count: { select: { keywords: true } } },
      });
      console.log(JSON.stringify({ event: "audio_overlay_cleanup_dry_run", overlayCount: overlay ? 1 : 0, keywordCount: overlay?._count.keywords ?? 0 }));
      return;
    }
    const backupPath = resolve(args[2]);
    const report = await prisma.$transaction(
      (tx) => retireAudioOverlay(tx, (snapshot) => writeFile(backupPath, JSON.stringify(snapshot, null, 2) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 })),
      { isolationLevel: "Serializable", maxWait: 10_000, timeout: 30_000 },
    );
    console.log(JSON.stringify({ event: "audio_overlay_cleanup_completed", ...report }));
  } finally {
    await prisma.$disconnect();
  }
}

run().catch(() => {
  // Do not print adapter errors or backup contents.
  console.error("Audio cleanup failed. Usage: effects:retire-audio [--apply --backup <new-private-file>]. Verify the database and backup directory; existing files are never overwritten.");
  process.exitCode = 1;
});
