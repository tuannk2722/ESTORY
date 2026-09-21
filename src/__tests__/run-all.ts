import "./reader-metrics.test";
import { runQuotaServiceTests } from "./quota-service.test";
import { runPersonalAudioTests } from "./p3-15-audio.test";
import "./public-access.test";
import "./effect-playback.test";
import "./effect-manifest.test";
import "./scene-contracts.test";
import "./database-foundation.test";
import { runSceneRepositoryTests } from "./scene-repository.test";
import { runAuthTests } from "./auth.test";
import { runPhase3MigrationTests } from "./phase3-migration.test";
import { runShadowReadTests } from "./shadow-read.test";
import { runStoryCommandTests } from "./story-command.test";
import { runP307ClientTests } from "./p3-07-client.test";
import { runReaderSyncTests } from "./reader-sync.test";
import { runMediaUploadTests } from "./media-upload.test";
import { runP310AuthorClientTests } from "./p3-10-author-client.test";
import { runP311SearchTests } from "./p3-11-search.test";
import { runP311ModerationTests } from "./p3-11-moderation.test";
import { runP312EffectAdminTests } from "./p3-12-effect-admin.test";
import { runP313SceneCatalogTests } from "./p3-13-scene-catalog.test";
import { runSceneVisualTreatmentTests } from "./scene-visual-treatment.test";

Promise.all([runPersonalAudioTests(), runQuotaServiceTests(), runSceneRepositoryTests(), runAuthTests(), runPhase3MigrationTests(), runShadowReadTests(), runStoryCommandTests(), runP307ClientTests(), runReaderSyncTests(), runMediaUploadTests(), runP310AuthorClientTests(), runP311SearchTests(), runP311ModerationTests(), runP312EffectAdminTests(), runP313SceneCatalogTests(), runSceneVisualTreatmentTests()]).then(() => {
  console.log("All Reader, Effect, Scene and repository tests completed successfully");
}).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
