export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Validate at server startup without loading Prisma into the JSON app.
    await import("./lib/env");
  }
}
