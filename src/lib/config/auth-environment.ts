import { z } from "zod";

const optionalText = (schema: z.ZodString = z.string().trim().min(1)) =>
  z.preprocess((value) => value === "" ? undefined : value, schema.optional());

const originSchema = z.string().url().refine((value) => {
  try {
    const url = new URL(value);
    return !url.username && !url.password && !url.search && !url.hash && url.pathname === "/"
      && (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)));
  } catch {
    return false;
  }
}, "Expected an HTTPS origin or local HTTP origin");

function allowlist(item: z.ZodString) {
  return z.preprocess(
    (value) => typeof value === "string" ? (value.trim() ? value.split(",").map((entry) => entry.trim()) : []) : value,
    z.array(item).default([]).transform((items) => [...new Set(items)]),
  );
}

export const authEnvironmentShape = {
  AUTH_SECRET: optionalText(z.string().trim().min(32)),
  AUTH_URL: optionalText(originSchema),
  AUTH_GOOGLE_ID: optionalText(),
  AUTH_GOOGLE_SECRET: optionalText(),
  AUTH_GITHUB_ID: optionalText(),
  AUTH_GITHUB_SECRET: optionalText(),
  BOOTSTRAP_ADMIN_EMAILS: allowlist(z.string().email().toLowerCase()),
  BOOTSTRAP_ADMIN_USER_IDS: allowlist(z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/)),
};

type AuthEnvironment = z.infer<z.ZodObject<typeof authEnvironmentShape>> & { DATABASE_URL?: string };

/** Required at server startup; parsing alone also supports build/CLI tooling. */
export function requireAuthEnvironment(env: AuthEnvironment) {
  const keys = ["DATABASE_URL", "AUTH_SECRET", "AUTH_URL", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"] as const;
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing server environment: ${missing.join(", ")}`);
  return env as AuthEnvironment & Record<typeof keys[number], string>;
}
