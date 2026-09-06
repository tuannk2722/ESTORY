export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { serverEnv } = await import("./lib/env");
    const { requireAuthEnvironment } = await import("./lib/config/auth-environment");
    requireAuthEnvironment(serverEnv);
  }
}
