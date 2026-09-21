import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
async function run() {
  const { freesoundClient } = await import("@/lib/integrations/freesound/runtime");
  const result = await freesoundClient().search("rain", 1);
  console.log(JSON.stringify({ search: "pass", returned: result.results.length, hasMore: result.hasMore }));
}
run().catch((e: unknown) => {
  const error = e as { name?: string; body?: { error?: { code?: string } }; issues?: { path: (string | number)[]; code: string }[] };
  console.error("Freesound live search failed", error.name, error.body?.error?.code,
    error.issues?.map((issue) => ({ path: issue.path, code: issue.code })));
  process.exitCode = 1;
});
