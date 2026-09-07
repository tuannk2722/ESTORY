import { z } from "zod";
import { authEnvironmentShape } from "./auth-environment";

// Pure parser shared by the server-only entry point, CLI config and tests.
// Never include input values in configuration errors: URLs contain credentials.
function postgresUrl(value: string | undefined): URL | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const valid = ["postgres:", "postgresql:"].includes(url.protocol)
      && Boolean(url.hostname && url.username && url.pathname.length > 1)
      && !url.hash;
    return valid ? url : undefined;
  } catch {
    return undefined;
  }
}

const postgresUrlSchema = z.string().trim().min(1).refine(
  (value) => Boolean(postgresUrl(value)), "Expected a PostgreSQL connection URL",
);

const optionalPostgresUrl = z.preprocess(
  (value) => value === "" ? undefined : value,
  postgresUrlSchema.optional(),
);

const environmentSchema = z.object({
  ...authEnvironmentShape,
  DATABASE_URL: optionalPostgresUrl,
  DIRECT_URL: optionalPostgresUrl,
  SHADOW_DATABASE_URL: optionalPostgresUrl,
  PHASE3_STORY_READ_SOURCE: z.enum(["json", "prisma"]).default("json"),
  PHASE3_STORY_WRITE_SOURCE: z.enum(["json", "prisma"]).default("json"),
  PHASE3_SCENE_READ_SOURCE: z.enum(["json", "prisma"]).default("json"),
  PHASE3_SHADOW_READ: z.enum(["false", "true"]).default("false"),
}).superRefine((env, ctx) => {
  const direct = postgresUrl(env.DIRECT_URL);
  if (direct?.hostname.endsWith(".neon.tech") && direct.hostname.includes("-pooler.")) {
    ctx.addIssue({ code: "custom", path: ["DIRECT_URL"], message: "Migrations require the direct Neon endpoint" });
  }
  const shadow = postgresUrl(env.SHADOW_DATABASE_URL);
  if (shadow) {
    const databaseTarget = (url: URL) => {
      return `${url.hostname.replace("-pooler.", ".")}:${url.port || "5432"}${url.pathname}`;
    };
    const shadowTarget = databaseTarget(shadow);
    if ([postgresUrl(env.DATABASE_URL), direct].some((url) => url && databaseTarget(url) === shadowTarget)) {
      ctx.addIssue({ code: "custom", path: ["SHADOW_DATABASE_URL"], message: "Shadow database must be separate from the application database" });
    }
  }
  if (env.PHASE3_STORY_WRITE_SOURCE !== "json") {
    ctx.addIssue({
      code: "custom",
      path: ["PHASE3_STORY_WRITE_SOURCE"],
      message: "Prisma writes are not available yet",
    });
  }
  const prismaReadEnabled = env.PHASE3_STORY_READ_SOURCE === "prisma"
    || env.PHASE3_SCENE_READ_SOURCE === "prisma"
    || env.PHASE3_SHADOW_READ === "true";
  if (prismaReadEnabled && !env.DATABASE_URL) {
    ctx.addIssue({
      code: "custom",
      path: ["DATABASE_URL"],
      message: "Prisma and shadow reads require DATABASE_URL",
    });
  }
});

export function parseEnvironment(source: Record<string, string | undefined>) {
  const result = environmentSchema.safeParse(source);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Invalid server environment: ${keys.join(", ")}`);
  }
  return Object.freeze(result.data);
}

export function requireDatabaseUrl(env: ReturnType<typeof parseEnvironment>): string {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required to initialize Prisma");
  return env.DATABASE_URL;
}
