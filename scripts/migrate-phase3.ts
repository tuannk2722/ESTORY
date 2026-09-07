import { loadEnvConfig } from "@next/env";
import { loadPhase3MigrationSource, type Phase3MigrationSource } from "@/lib/migration/phase3-source";
import { runPhase3Migration, type Phase3MigrationMode } from "@/lib/migration/phase3-migration";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

function parseMode(args: readonly string[]): Phase3MigrationMode {
  const normalizedArgs = args.filter((arg) => arg !== "--");
  const modes = normalizedArgs.filter((arg) => arg.startsWith("--mode="));
  if (modes.length !== 1 || normalizedArgs.length !== 1) {
    throw new Error("Usage: pnpm migrate:phase3 -- --mode=dry-run|apply|verify");
  }
  const mode = modes[0].slice("--mode=".length);
  if (mode !== "dry-run" && mode !== "apply" && mode !== "verify") {
    throw new Error("Mode must be one of dry-run, apply or verify");
  }
  return mode;
}

function report(mode: Phase3MigrationMode, result: "passed" | "failed", source: Phase3MigrationSource): void {
  console.log(JSON.stringify({
    mode,
    result,
    counts: source.counts,
    duplicateKeywordsResolved: source.duplicateKeywordCount,
    sourceFiles: source.sourceFiles,
    media: source.media,
  }, null, 2));
}

function safeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown failure";
  return error.message
    .replace(/postgres(?:ql)?:\/\/\S+/giu, "[database-url-redacted]")
    .replace(/password\s*[=:]\s*\S+/giu, "password=[redacted]");
}

async function main() {
  // run-typescript-tests.cjs occupies argv[1] and receives this script at argv[2].
  const mode = parseMode(process.argv.slice(3));
  const source = await loadPhase3MigrationSource();
  const { prisma } = await import("@/lib/db/prisma");
  try {
    await runPhase3Migration(mode, prisma, source, process.env.LEGACY_OWNER_USER_ID);
    report(mode, "passed", source);
  } catch (error) {
    report(mode, "failed", source);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`Phase 3 migration failed: ${safeErrorMessage(error)}`);
  process.exitCode = 1;
});
