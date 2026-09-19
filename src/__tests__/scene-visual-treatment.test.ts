import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SceneCatalogPreview from "@/components/admin/scene-library/SceneCatalogPreview";
import SceneLayer from "@/components/scenes/SceneLayer";
import {
  isSceneRenderConfigV1,
  isSceneRenderConfigV2,
  parseSceneRenderConfig,
} from "@/lib/scenes/scene-render-config";
import {
  DEFAULT_SCENE_ACCENT_COLOR,
  SCENE_BODY_TEXT_COLOR,
  SCENE_READABILITY_MIN_OPACITY,
  SCENE_READABILITY_SCRIM_RGB,
  createOriginalVisualTreatment,
  deriveVisualTreatmentFromBackground,
  deriveVisualTreatmentFromPixels,
} from "@/lib/scenes/visual-treatment";
import type {
  BackgroundRenderSnapshot,
  SceneRenderConfigV2,
} from "@/types/scene";
import { snapshotConfig } from "./fixtures/scene-fixtures";

function pixels(...colors: Array<[number, number, number, number?]>) {
  const data = new Uint8ClampedArray(colors.length * 4);
  colors.forEach(([red, green, blue, alpha = 255], index) => {
    data.set([red, green, blue, alpha], index * 4);
  });
  return { data, width: colors.length, height: 1 };
}

function hexRgb(color: string): [number, number, number] {
  return [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16)) as [number, number, number];
}

function luminance(color: readonly number[]) {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return linear(color[0]) * 0.2126 + linear(color[1]) * 0.7152 + linear(color[2]) * 0.0722;
}

function contrastAfterWeakestScrim(background: readonly number[]) {
  const composited = background.map((channel, index) =>
    Math.round(
      SCENE_READABILITY_SCRIM_RGB[index] * SCENE_READABILITY_MIN_OPACITY +
      channel * (1 - SCENE_READABILITY_MIN_OPACITY)
    )
  );
  const body = luminance(hexRgb(SCENE_BODY_TEXT_COLOR));
  const backdrop = luminance(composited);
  return (Math.max(body, backdrop) + 0.05) / (Math.min(body, backdrop) + 0.05);
}

// Run renderer checks while the module loads, before asynchronous test suites
// temporarily install browser globals for their own client tests.
function assertRendererPaths() {
  const originalConfig: SceneRenderConfigV2 = {
    schema_version: 2,
    background: {
      render_data: { kind: "image", media_url: "/background.webp" },
      motion: "static",
    },
    visual_treatment: createOriginalVisualTreatment(),
    ambient_effects: [],
  };
  const autoConfig: SceneRenderConfigV2 = {
    ...originalConfig,
    visual_treatment: {
      mode: "auto",
      accent_color: "#f59e0b",
      atmosphere: { color: "#92400e", opacity: 0.12 },
      derivation_version: 1,
    },
  };

  const originalHtml = renderToStaticMarkup(
    createElement(SceneLayer, { renderConfig: originalConfig, reducedMotion: true }, "Readable")
  );
  assert.match(originalHtml, /data-scene-visual-treatment="original"/);
  assert.match(originalHtml, /data-scene-readability-scrim="true"/);
  assert.ok(!originalHtml.includes("data-scene-atmosphere"));
  assert.ok(!originalHtml.includes("mix-blend-mode:color"));
  assert.match(originalHtml, new RegExp(DEFAULT_SCENE_ACCENT_COLOR));
  assert.ok(originalHtml.includes(`--scene-accent-color:${DEFAULT_SCENE_ACCENT_COLOR}`));
  assert.ok(originalHtml.includes(`--scene-heading-text-color:${SCENE_BODY_TEXT_COLOR}`));
  assert.ok(originalHtml.includes(`--scene-dropcap-text-color:${SCENE_BODY_TEXT_COLOR}`));
  assert.ok(originalHtml.includes(`--scene-detail-text-color:${SCENE_BODY_TEXT_COLOR}`));
  assert.ok(!originalHtml.includes("--color-primary:"), "v2 does not recolor Reader controls");
  assert.ok(!originalHtml.includes("--color-accent:"), "v2 does not recolor Reader controls");
  assert.ok(originalHtml.includes("mask-image:linear-gradient(to right"));
  assert.ok(originalHtml.includes("black calc(50% - 21rem), black calc(50% + 21rem)"));

  const adminPreviewHtml = renderToStaticMarkup(
    createElement(SceneCatalogPreview, { background: originalConfig.background })
  );
  assert.ok(!adminPreviewHtml.includes('aria-pressed='), "static Background has no playback control");
  assert.match(adminPreviewHtml, /data-scene-visual-treatment="original"/);
  assert.match(adminPreviewHtml, /data-scene-readability-scrim="true"/);
  assert.ok(adminPreviewHtml.includes(`--scene-accent-color:${DEFAULT_SCENE_ACCENT_COLOR}`));
  assert.ok(adminPreviewHtml.includes(`color:${SCENE_BODY_TEXT_COLOR}`));
  assert.match(adminPreviewHtml, /class="scene-layer[^\"]*h-full"/);
  assert.ok(!adminPreviewHtml.includes('class="fixed inset-0 z-0'), "contained preview does not cover the page");
  assert.ok(adminPreviewHtml.includes("mask-image:none"), "contained preview protects the full sample width");
  assert.ok(!adminPreviewHtml.includes("#8B5CF6"), "Background preview has no arbitrary Palette");
  assert.ok(!adminPreviewHtml.includes("background-color:#0F172A"), "Background preview has no Palette tint");

  const staticGradientPreviewHtml = renderToStaticMarkup(createElement(SceneCatalogPreview, {
    background: {
      render_data: { kind: "gradient", angle_deg: 180, stops: [
        { color: "#0f172a", position: 0 }, { color: "#f59e0b", position: 1 },
      ] },
      motion: "static",
    },
  }));
  assert.ok(!staticGradientPreviewHtml.includes('aria-pressed='), "static gradient has no playback control");
  assert.ok(staticGradientPreviewHtml.includes("linear-gradient(180deg"), "static gradient uses its source colors");
  assert.ok(staticGradientPreviewHtml.includes("Khu rừng sau cơn mưa"), "static gradient keeps the Reader sample");
  assert.match(staticGradientPreviewHtml, /data-scene-readability-scrim="true"/);

  const stoppedVideoPreviewHtml = renderToStaticMarkup(createElement(SceneCatalogPreview, {
    background: {
      render_data: { kind: "video", media_url: "/loop.mp4" },
      motion: "looping",
      poster_frame: "/poster.webp",
    },
  }));
  assert.match(stoppedVideoPreviewHtml, /aria-pressed="false"/);
  assert.match(stoppedVideoPreviewHtml, /data-scene-readability-scrim="true"/);
  assert.ok(stoppedVideoPreviewHtml.includes("/poster.webp"), "stopped preview shows the poster");
  assert.ok(!stoppedVideoPreviewHtml.includes("<video"), "stopped preview never mounts autoplay video");
  assert.ok(!stoppedVideoPreviewHtml.includes('src="/loop.mp4"'), "stopped preview does not request the video source");

  const compactAdminPreviewHtml = renderToStaticMarkup(
    createElement(SceneCatalogPreview, { background: originalConfig.background, compact: true })
  );
  assert.ok(!compactAdminPreviewHtml.includes('aria-pressed='), "card thumbnail has no playback controls");
  assert.ok(!compactAdminPreviewHtml.includes("data-scene-readability-scrim"), "thumbnail shows the ungraded Background");

  const autoHtml = renderToStaticMarkup(
    createElement(SceneLayer, { renderConfig: autoConfig, reducedMotion: true }, "Readable")
  );
  assert.match(autoHtml, /data-scene-visual-treatment="auto"/);
  assert.match(autoHtml, /data-scene-atmosphere="true"/);
  assert.match(autoHtml, /data-scene-readability-scrim="true"/);
  assert.ok(!autoHtml.includes("mix-blend-mode:color"));

  const clampedHtml = renderToStaticMarkup(createElement(SceneLayer, {
    renderConfig: {
      ...autoConfig,
      visual_treatment: {
        mode: "auto",
        accent_color: "#f59e0b",
        atmosphere: { color: "#0f172a", opacity: 0.9 },
        derivation_version: 1,
      },
    },
  }));
  assert.ok(clampedHtml.includes("opacity:0.18"));

  const legacyHtml = renderToStaticMarkup(
    createElement(SceneLayer, { renderConfig: snapshotConfig(), reducedMotion: true })
  );
  assert.match(legacyHtml, /mix-blend-mode:color/);
  assert.ok(legacyHtml.includes("--color-primary:#ffffff"));
  assert.ok(legacyHtml.includes("--color-accent:#ffaa00"));
  assert.ok(!legacyHtml.includes("--scene-accent-color:"));
  assert.ok(legacyHtml.includes("--scene-detail-text-color:#ffaa00"));

  const legacyPalettePreviewHtml = renderToStaticMarkup(
    createElement(SceneCatalogPreview, { palette: snapshotConfig().palette })
  );
  assert.ok(legacyPalettePreviewHtml.includes("rgb(5, 30, 15)"));
  assert.ok(legacyPalettePreviewHtml.includes("#ffaa00"));
  assert.ok(!legacyPalettePreviewHtml.includes('data-scene-visual-treatment="original"'));
}

assertRendererPaths();

export async function runSceneVisualTreatmentTests() {
  const v1 = parseSceneRenderConfig(snapshotConfig());
  assert.ok(isSceneRenderConfigV1(v1));
  assert.deepEqual(v1, snapshotConfig(), "v1 snapshots keep their exact parsed shape");

  const originalConfig: SceneRenderConfigV2 = {
    schema_version: 2,
    background: {
      render_data: { kind: "image", media_url: "/background.webp" },
      motion: "static",
    },
    visual_treatment: createOriginalVisualTreatment(),
    ambient_effects: [],
  };
  const parsedOriginal = parseSceneRenderConfig(originalConfig);
  assert.ok(isSceneRenderConfigV2(parsedOriginal));
  assert.deepEqual(parsedOriginal, originalConfig);

  const autoConfig: SceneRenderConfigV2 = {
    ...originalConfig,
    visual_treatment: {
      mode: "auto",
      accent_color: "#f59e0b",
      atmosphere: { color: "#92400e", opacity: 0.12 },
      derivation_version: 1,
    },
  };
  assert.deepEqual(parseSceneRenderConfig(autoConfig), autoConfig);
  const highAtmosphereConfig: SceneRenderConfigV2 = {
    ...autoConfig,
    visual_treatment: {
      mode: "auto",
      accent_color: "#f59e0b",
      atmosphere: { color: "#0f172a", opacity: 0.9 },
      derivation_version: 1,
    },
  };
  assert.deepEqual(
    parseSceneRenderConfig(highAtmosphereConfig),
    highAtmosphereConfig,
    "v2 stores contract opacity 0..1 and lets the renderer clamp its visual output",
  );

  for (const visual_treatment of [
    { mode: "original", accent_color: "#38BDF8" },
    { mode: "original", accent_color: "rgb(56, 189, 248)" },
    { mode: "auto", accent_color: "#38bdf8", atmosphere: { color: "#0f172a", opacity: 1.001 }, derivation_version: 1 },
    { mode: "auto", accent_color: "#38bdf8", atmosphere: { color: "#0f172a", opacity: 0.1 }, derivation_version: 2 },
  ]) {
    assert.throws(() => parseSceneRenderConfig({ ...originalConfig, visual_treatment }));
  }
  assert.throws(() => parseSceneRenderConfig({ ...originalConfig, palette: snapshotConfig().palette }));

  assert.deepEqual(createOriginalVisualTreatment("#ABC"), {
    mode: "original",
    accent_color: "#aabbcc",
  });

  const colorfulPixels = pixels(
    [226, 88, 34], [226, 88, 34], [226, 88, 34], [26, 45, 88], [255, 255, 255, 0]
  );
  const derived = deriveVisualTreatmentFromPixels(colorfulPixels);
  assert.equal(derived.mode, "auto");
  assert.deepEqual(deriveVisualTreatmentFromPixels(colorfulPixels), derived, "pixel derivation is deterministic");
  assert.match(derived.accent_color, /^#[0-9a-f]{6}$/);
  if (derived.mode === "auto") {
    assert.match(derived.atmosphere.color, /^#[0-9a-f]{6}$/);
    assert.ok(derived.atmosphere.opacity >= 0.08 && derived.atmosphere.opacity <= 0.16);
    assert.equal(derived.derivation_version, 1);
  }
  assert.deepEqual(
    deriveVisualTreatmentFromPixels(pixels([255, 255, 255, 0])),
    createOriginalVisualTreatment(),
    "fully transparent media falls back safely"
  );
  assert.deepEqual(
    deriveVisualTreatmentFromPixels(pixels([128, 128, 128], [128, 128, 128])),
    createOriginalVisualTreatment(),
    "near-neutral media has no source hue and falls back without inventing an aura",
  );

  const gradient: BackgroundRenderSnapshot = {
    render_data: {
      kind: "gradient",
      angle_deg: 120,
      stops: [
        { color: "#0f172a", position: 0 },
        { color: "rgb(245, 158, 11)", position: 1 },
      ],
    },
    motion: "static",
  };
  assert.equal((await deriveVisualTreatmentFromBackground(gradient)).mode, "auto");

  let loadedUrl = "";
  const image: BackgroundRenderSnapshot = {
    render_data: { kind: "image", media_url: "/selected.webp" },
    motion: "static",
  };
  const imageTreatment = await deriveVisualTreatmentFromBackground(image, {
    loadPixels: async (url) => {
      loadedUrl = url;
      return colorfulPixels;
    },
  });
  assert.equal(loadedUrl, "/selected.webp");
  assert.equal(imageTreatment.mode, "auto");

  const video: BackgroundRenderSnapshot = {
    render_data: { kind: "video", media_url: "/loop.mp4" },
    motion: "looping",
    poster_frame: "/poster.webp",
  };
  await deriveVisualTreatmentFromBackground(video, {
    loadPixels: async (url) => {
      loadedUrl = url;
      return colorfulPixels;
    },
  });
  assert.equal(loadedUrl, "/poster.webp", "video derivation reads its stable poster only");

  const particle: BackgroundRenderSnapshot = {
    render_data: { kind: "particle_composition", composition_key: "fireflies_green", config: {} },
    motion: "static",
  };
  assert.deepEqual(
    await deriveVisualTreatmentFromBackground(particle),
    createOriginalVisualTreatment()
  );
  assert.deepEqual(
    await deriveVisualTreatmentFromBackground(image, {
      loadPixels: async () => { throw new Error("CORS"); },
    }),
    createOriginalVisualTreatment(),
    "decode and CORS failures do not block saving"
  );

  for (const representativeBackground of [
    [255, 255, 255], // brightest possible image region
    [0, 0, 0],
    [128, 128, 128],
    [255, 240, 160], // bright warm detail
    [210, 235, 255], // bright cool detail
  ]) {
    assert.ok(
      contrastAfterWeakestScrim(representativeBackground) >= 4.5,
      `body text remains WCAG AA at the weakest scrim point over ${representativeBackground.join(",")}`
    );
  }

  console.log("scene-visual-treatment.test.ts: v1/v2 contract, derivation and renderer passed");
}
