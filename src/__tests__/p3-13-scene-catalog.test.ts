import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BACKGROUND_VIDEO_MAX_BYTES, IMAGE_MAX_BYTES } from "@/lib/media/constants";
import { validateSceneCatalogMediaFile } from "@/lib/media/scene-catalog-file";
import { backgroundRenderSnapshotSchema } from "@/lib/scenes/scene-render-config";
import {
  backgroundMutationSchema,
  createBackgroundSchema,
  createPaletteSchema,
  parseBackgroundAdminSearchParams,
  parsePaletteAdminSearchParams,
} from "@/lib/validation/scene-catalog-schema";

const revision = "2026-09-16T00:00:00.000Z";
const base = { label: "  Rừng   đêm  ", moodTags: [" huyền bí ", "đêm"] };
const stops = [{ color: "#172554", position: 0 }, { color: "rgba(2, 6, 23, .9)", position: 1 }];

export async function runP313SceneCatalogTests() {
  assert.deepEqual(parseBackgroundAdminSearchParams({}), {
    q: "",
    type: "all",
    motion: "all",
    status: "all",
    cursor: null,
  });
  assert.deepEqual(parseBackgroundAdminSearchParams({
    q: ["  Rừng   đêm  ", "ignored"],
    type: ["radial_gradient", "video"],
    motion: ["looping", "static"],
    status: ["archived", "active"],
    cursor: ["valid_cursor-123", "ignored"],
  }), {
    q: "Rừng đêm",
    type: "radial_gradient",
    motion: "looping",
    status: "archived",
    cursor: "valid_cursor-123",
  });
  assert.deepEqual(parsePaletteAdminSearchParams({ status: "bad", cursor: "not valid" }), {
    q: "",
    status: "all",
    cursor: null,
  });

  for (const render of [
    { kind: "image", uploadId: "image-upload" },
    { kind: "video", uploadId: "video-upload" },
    { kind: "gradient", angleDeg: 135, stops },
    { kind: "radial_gradient", shape: "ellipse", center: { x: 0.5, y: 0.35 }, stops },
    { kind: "particle_composition", compositionKey: "fireflies_green", config: {}, motion: "static" },
    { kind: "particle_composition", compositionKey: "abyss_particles", config: {}, motion: "looping", posterUploadId: "poster-upload" },
  ]) {
    const result = createBackgroundSchema.parse({ ...base, render });
    assert.equal(result.label, "Rừng đêm");
    assert.deepEqual(result.moodTags, ["huyền bí", "đêm"]);
  }

  for (const invalid of [
    { ...base, render: { kind: "image", media_url: "https://example.invalid/image.webp" } },
    { ...base, render: { kind: "image", uploadId: "upload", motion: "looping" } },
    { ...base, render: { kind: "gradient", angleDeg: 361, stops } },
    { ...base, render: { kind: "gradient", angleDeg: 90, stops: [stops[1], stops[0]] } },
    { ...base, render: { kind: "gradient", angleDeg: 90, stops: [{ color: "url(evil)", position: 0 }, stops[1]] } },
    { ...base, render: { kind: "radial_gradient", shape: "circle", center: { x: 1.1, y: 0 }, stops } },
    { ...base, render: { kind: "particle_composition", compositionKey: "unknown", config: {}, motion: "static" } },
    { ...base, render: { kind: "particle_composition", compositionKey: "fireflies_green", config: { raw: "json" }, motion: "static" } },
    { ...base, render: { kind: "particle_composition", compositionKey: "fireflies_green", config: {}, motion: "looping" } },
    { ...base, ownerId: "forbidden", render: { kind: "image", uploadId: "upload" } },
    { ...base, scope: "personal", render: { kind: "image", uploadId: "upload" } },
    { ...base, source: "ai_generated", render: { kind: "image", uploadId: "upload" } },
  ]) assert.equal(createBackgroundSchema.safeParse(invalid).success, false);

  assert.equal(backgroundMutationSchema.safeParse({
    action: "update",
    ...base,
    render: { kind: "image" },
    expectedUpdatedAt: revision,
  }).success, true, "An edit may preserve a previously claimed image");
  assert.equal(backgroundMutationSchema.safeParse({
    action: "transition",
    status: "draft",
    expectedUpdatedAt: revision,
  }).success, false);

  assert.equal(createPaletteSchema.safeParse({
    ...base,
    colors: {
      primary: "#8B5CF6",
      secondary: "#0EA5E9",
      accent: "#F59E0B",
      background_tint: { color: "#0F172A", opacity: 0.35 },
    },
  }).success, true);
  for (const invalidColor of ["var(--unsafe)", "url(evil)", "#12345"]) {
    assert.equal(createPaletteSchema.safeParse({
      ...base,
      colors: {
        primary: invalidColor,
        secondary: "#0EA5E9",
        accent: "#F59E0B",
        background_tint: { color: "#0F172A", opacity: 0.35 },
      },
    }).success, false);
  }
  assert.equal(createPaletteSchema.safeParse({
    ...base,
    colors: { primary: "#fff", secondary: "#fff", accent: "#fff", background_tint: { color: "#000", opacity: 1.1 } },
  }).success, false);

  assert.equal(backgroundRenderSnapshotSchema.safeParse({
    render_data: { kind: "image", media_url: "/legacy.webp" },
    motion: "looping",
    poster_frame: "/legacy-poster.webp",
  }).success, true, "Legacy image-looping snapshots remain readable");

  assert.equal(validateSceneCatalogMediaFile({ type: "image/webp", size: 1 }, "image"), null);
  assert.equal(validateSceneCatalogMediaFile({ type: "video/webm", size: 1 }, "video"), null);
  assert.match(validateSceneCatalogMediaFile({ type: "text/plain", size: 1 }, "image") ?? "", /JPG/);
  assert.match(validateSceneCatalogMediaFile({ type: "image/png", size: IMAGE_MAX_BYTES + 1 }, "image") ?? "", /5 MiB/);
  assert.match(validateSceneCatalogMediaFile({ type: "video/mp4", size: BACKGROUND_VIDEO_MAX_BYTES + 1 }, "video") ?? "", /50 MiB/);
  assert.match(validateSceneCatalogMediaFile({ type: "video/mp4", size: 0 }, "video") ?? "", /trống/);

  const authorRoute = readFileSync("src/app/api/scene-library/route.ts", "utf8");
  const readerLayer = readFileSync("src/components/scenes/SceneLayer.tsx", "utf8");
  assert.ok(authorRoute.includes('requireRole("author")'));
  assert.ok(authorRoute.includes("getActiveGlobalBackgrounds"));
  assert.equal(authorRoute.includes("getActivePalettes"), false);
  assert.equal(authorRoute.includes("getActiveScenePresets"), false);
  assert.ok(authorRoute.includes("sceneAuthoringLibraryDataSchema"));
  assert.equal(authorRoute.includes("getBackgrounds()"), false);
  assert.equal(readerLayer.includes("sceneLibraryRepository"), false, "Reader must render snapshots without catalog fetches");
  assert.equal(readerLayer.includes("/visual-treatment"), false, "Reader must not import Author pixel-derivation code");

  console.log("p3-13-scene-catalog.test.ts: strict admin DTOs, all background kinds, palette validation and snapshot boundaries passed");
}
