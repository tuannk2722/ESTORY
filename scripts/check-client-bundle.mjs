import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(".next/static");
const files = await readdir(root, { recursive: true });
const scripts = files.filter((file) => file.endsWith(".js"));
assert.ok(scripts.length > 0, "Run pnpm build before checking the browser bundle");
for (const file of scripts) {
  const source = await readFile(path.join(root, file), "utf8");
  assert.ok(!/PrismaClient|PrismaPg|@prisma\/client|freesoundAccessTokenCiphertext|DATABASE_URL|AUTH_SECRET|AUTH_GOOGLE_SECRET|AUTH_GITHUB_SECRET|BOOTSTRAP_ADMIN_/.test(source), `Server database/auth code found in browser bundle: ${file}`);
}
console.log(`Browser bundle passed: ${scripts.length} JavaScript files contain no Prisma client or database environment markers.`);
