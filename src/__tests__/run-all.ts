import "./reader-metrics.test";
import "./public-access.test";
import "./effect-playback.test";
import "./effect-manifest.test";
import "./scene-contracts.test";
import "./database-foundation.test";
import { runSceneRepositoryTests } from "./scene-repository.test";
import { runAuthTests } from "./auth.test";

Promise.all([runSceneRepositoryTests(), runAuthTests()]).then(() => {
  console.log("All Reader, Effect, Scene and repository tests completed successfully");
}).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
