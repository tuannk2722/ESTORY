import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";
import { parseEnvironment } from "./src/lib/config/environment";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
const env = parseEnvironment(process.env);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // Offline format/validate/generate need no credentials. Database commands
    // fail if DIRECT_URL is absent; never fall back to the runtime pool.
    url: env.DIRECT_URL ?? "",
    shadowDatabaseUrl: env.SHADOW_DATABASE_URL,
  },
});
