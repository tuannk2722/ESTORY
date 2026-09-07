import { loadEnvConfig } from "@next/env";
import pg from "pg";
import { parseEnvironment } from "../src/lib/config/environment";

async function run(): Promise<void> {
  let client: pg.Client | undefined;
  try {
    loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
    const env = parseEnvironment(process.env);
    if (!env.DIRECT_URL) throw new Error("DIRECT_URL is required");
    client = new pg.Client({
      connectionString: env.DIRECT_URL,
      connectionTimeoutMillis: 10_000,
    });
    await client.connect();
    const result = await client.query<{ count: number }>(`
      SELECT count(*)::int AS count
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
        AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
    `);
    if (result.rows[0].count !== 0) {
      console.error(
        "Database is not empty. Initial-migration verification requires a separate empty development database.",
      );
      process.exitCode = 1;
    } else {
      console.log(
        "Database preflight passed: no user tables, views or sequences. No changes made.",
      );
    }
  } catch {
    console.error(
      "Database preflight failed. Check DIRECT_URL and database access; credentials are not logged.",
    );
    process.exitCode = 1;
  } finally {
    try {
      await client?.end();
    } catch {
      console.error(
        "Database preflight failed during cleanup; credentials are not logged.",
      );
      process.exitCode = 1;
    }
  }
}

void run();
