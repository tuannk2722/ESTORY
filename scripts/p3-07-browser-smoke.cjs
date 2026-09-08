/* eslint-disable @typescript-eslint/no-require-imports */
// Optional local browser gate. Tooling lives outside the application dependency tree.
const assert = require("node:assert/strict");
const { resolve } = require("node:path");
const { mkdir } = require("node:fs/promises");

exports.runP307BrowserSmoke = async function ({ origin, storyId, chapterId, token, makeDraft }) {
  const { chromium } = require(resolve(process.env.P3_07_PLAYWRIGHT_MODULE));
  const browser = await chromium.launch({ channel: process.env.P3_07_BROWSER_CHANNEL || "msedge", headless: true });
  const artifacts = resolve("../.tools/p3-07-browser/artifacts");
  await mkdir(artifacts, { recursive: true });
  let stage = "reader";
  const errors = [];
  const libraryRequests = [];
  function watch(page) {
    page.on("pageerror", () => errors.push("BROWSER_PAGE_ERROR"));
    page.on("request", request => {
      if (/\/api\/(scene-library|scenes)(?:\?|$)/.test(request.url())) libraryRequests.push(request.url().split("?")[0]);
    });
  }
  try {
    const fixture = await browser.newContext();
    await fixture.addCookies([{ name: "authjs.session-token", value: token, url: origin, httpOnly: true, sameSite: "Lax" }]);
    const fixtureUrl = `${origin}/api/stories/${storyId}/chapters/${chapterId}/editor`;
    const original = await (await fixture.request.get(fixtureUrl)).json();
    const firstBlock = original.data.chapter.blocks[0];
    const mediaBlocks = [firstBlock, ...Array.from({ length: 4 }, (_, index) => ({ ...firstBlock, id: `${chapterId}-browser-${index}`, text: (`Reader media block ${index + 2}. `).repeat(45) }))];
    const firstScene = { ...original.data.scenes[0], start_block_id: firstBlock.id, end_block_id: mediaBlocks[1].id, render_config: {
      schema_version: 1,
      background: { render_data: { kind: "video", media_url: "/scene-backgrounds/rain-loop.mp4" }, motion: "looping", poster_frame: "/scene-backgrounds/rain_poster.png" },
      palette: { primary: "#14233c", secondary: "#05070f", accent: "#d7a84b", background_tint: { color: "#05070f", opacity: .7 } },
      ambient_effects: [{ id: `${chapterId}-ambient-one`, type: "audio", category: "audio", audio_src: "/scene-backgrounds/rain_loop.mp3", intensity: .2, duration_ms: 0, loop: true }],
    } };
    const secondScene = { ...firstScene, id: `${chapterId}-browser-scene`, based_on_preset_id: undefined, start_block_id: mediaBlocks[2].id, end_block_id: mediaBlocks[4].id, render_config: {
      ...firstScene.render_config,
      background: { render_data: { kind: "image", media_url: "/scene-backgrounds/lighthouse-night.png" }, motion: "static" },
      ambient_effects: [{ ...firstScene.render_config.ambient_effects[0], id: `${chapterId}-ambient-two`, audio_src: "/audio/gentle_rain_falling.mp3" }],
    } };
    const fixtureSave = await fixture.request.put(fixtureUrl, { headers: { origin }, data: { blocks: mediaBlocks, scenes: [firstScene, secondScene], expectedUpdatedAt: original.meta.updatedAt } });
    assert.equal(fixtureSave.status(), 200);
    await fixture.close();
    const guest = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const reader = await guest.newPage();
    watch(reader);
    assert.equal((await reader.goto(`${origin}/stories/${storyId}/${chapterId}`)).status(), 200);
    await reader.locator(".scene-layer").waitFor();
    await reader.locator("main.prose-reader").waitFor();
    await reader.locator(".scene-background video").waitFor();
    await reader.locator(".scene-background video").evaluate(node => { node.dataset.smokeInstance = "original"; });
    await reader.locator(`[data-reader-block-id="${mediaBlocks[1].id}"]`).scrollIntoViewIfNeeded();
    assert.equal(await reader.locator(".scene-background video").getAttribute("data-smoke-instance"), "original", "Video must not remount inside one scene");
    await reader.locator(`[data-reader-block-id="${mediaBlocks[2].id}"]`).scrollIntoViewIfNeeded();
    await reader.locator('.scene-background img[src="/scene-backgrounds/lighthouse-night.png"]').waitFor();
    await reader.locator(".scene-background video").waitFor({ state: "detached" });
    await reader.evaluate(() => window.scrollTo(0, 0));
    await reader.locator(".scene-background video").waitFor();
    for (const width of [375, 768, 1024, 1440]) {
      await reader.setViewportSize({ width, height: 900 });
      assert.equal(await reader.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `Reader overflow at ${width}`);
    }
    const textColor = await reader.locator("main.prose-reader").evaluate(node => getComputedStyle(node).color);
    assert.equal(textColor, "rgb(248, 250, 252)");
    await reader.screenshot({ path: resolve(artifacts, "reader-desktop.png") });
    await guest.close();
    const reduced = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce" });
    const reducedPage = await reduced.newPage();
    watch(reducedPage);
    const reducedVideos = [];
    reducedPage.on("request", request => { if (request.url().includes("rain-loop.mp4")) reducedVideos.push(true); });
    await reducedPage.goto(`${origin}/stories/${storyId}/${chapterId}`);
    await reducedPage.locator('.scene-background[data-reduced-motion="true"]').waitFor();
    assert.equal(await reducedPage.locator(".scene-background video").count(), 0);
    assert.equal(reducedVideos.length, 0, "Reduced motion must not download the looping video before hydration");
    await reducedPage.locator('.scene-background img[src="/scene-backgrounds/rain_poster.png"]').waitFor();
    await reducedPage.screenshot({ path: resolve(artifacts, "reader-mobile-reduced.png") });
    await reduced.close();

    await makeDraft();
    stage = "owner editor";
    const owner = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    // Session belongs exclusively to this disposable integration fixture.
    await owner.addCookies([{ name: "authjs.session-token", value: token, url: origin, httpOnly: true, sameSite: "Lax" }]);
    const page = await owner.newPage();
    watch(page);
    const pageUrl = `${origin}/author/stories/${storyId}/${chapterId}`;
    const apiUrl = `${origin}/api/stories/${storyId}/chapters/${chapterId}/editor`;
    const read = async () => (await owner.request.get(apiUrl)).json();
    const before = await read();
    assert.equal((await page.goto(pageUrl)).status(), 200);
    await page.locator("textarea").first().waitFor();
    await page.getByRole("button", { name: /^Chỉnh sửa Scene #1$/ }).click();
    await page.getByRole("button", { name: "Cập Nhật Scene", exact: true }).waitFor();
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))), true);
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("button", { name: /^Chỉnh sửa Scene #1$/ }).evaluate(node => node === document.activeElement), true);
    await page.getByRole("button", { name: /^Chỉnh sửa Scene #1$/ }).click();
    assert.equal(await page.getByRole("button", { name: "Cập Nhật Scene", exact: true }).isEnabled(), true);
    await page.getByRole("button", { name: "Cập Nhật Scene", exact: true }).click();
    await page.locator("textarea").first().fill("P3-07 browser text save");
    const save = async (target, expectedStatus) => {
      const response = target.waitForResponse(response => response.url() === apiUrl && response.request().method() === "PUT");
      await target.getByRole("button", { name: /Lưu Thay Đổi/ }).click();
      assert.equal((await response).status(), expectedStatus);
    };
    await save(page, 200);
    const saved = await read();
    assert.deepEqual(saved.data.scenes, before.data.scenes, "No-op picker + text save preserves archived snapshot/provenance");
    assert.notEqual(saved.meta.updatedAt, before.meta.updatedAt);
    await page.reload();
    assert.equal(await page.locator("textarea").first().inputValue(), "P3-07 browser text save");
    await page.locator("textarea").first().fill("P3-07 preview save");
    await page.getByRole("button", { name: "Xem Trước", exact: true }).click();
    await page.locator(".reader-pane").waitFor();
    assert.equal(await page.locator(".reader-pane").getByText("P3-07 preview save", { exact: true }).count(), 1);
    await save(page, 200);
    assert.equal((await read()).data.chapter.blocks[0].text, "P3-07 preview save");
    await page.getByRole("button", { name: "Soạn Thảo", exact: true }).click();
    await page.getByRole("button", { name: /^Chỉnh sửa Scene #1$/ }).click();
    const volume = page.getByRole("dialog").getByRole("slider");
    await volume.press("End");
    const changedVolume = Number(await volume.inputValue());
    assert.notEqual(changedVolume, saved.data.scenes[0].render_config.ambient_effects[0].intensity);
    await page.getByRole("button", { name: "Cập Nhật Scene", exact: true }).click();
    await save(page, 200);
    const sceneEdited = await read();
    assert.equal(sceneEdited.data.scenes[0].render_config.ambient_effects[0].intensity, changedVolume);
    assert.deepEqual(sceneEdited.data.scenes[0].render_config.background, saved.data.scenes[0].render_config.background);
    assert.equal(sceneEdited.data.scenes[0].based_on_preset_id, saved.data.scenes[0].based_on_preset_id);
    await page.reload();
    await page.getByRole("button", { name: /^Chỉnh sửa Scene #1$/ }).click();
    assert.equal(Number(await page.getByRole("dialog").getByRole("slider").inputValue()), changedVolume);
    await page.keyboard.press("Escape");
    await page.screenshot({ path: resolve(artifacts, "editor-desktop.png") });
    for (const width of [375, 768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `Editor overflow at ${width}`);
      if (width === 375) await page.screenshot({ path: resolve(artifacts, "editor-mobile.png") });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });

    stage = "stale editor";
    const stale = await owner.newPage();
    watch(stale);
    await stale.goto(pageUrl);
    await stale.locator("textarea").first().fill("Stale tab text must not overwrite");
    await page.locator("textarea").first().fill("Winning browser edit");
    await save(page, 200);
    await save(stale, 409);
    assert.equal(await stale.locator("textarea").first().inputValue(), "Stale tab text must not overwrite");
    assert.equal((await read()).data.chapter.blocks[0].text, "Winning browser edit");
    assert.equal(libraryRequests.length, 0, "Reader/editor bootstrap never fetches legacy catalogs");
    assert.deepEqual(errors, []);
    await owner.close();
    console.log("P3-07 browser smoke passed: Reader snapshots/no-library, video continuity/Scene transition, reduced-motion poster/no video request, 375–1440px, owner editor picker/focus/text and Scene edit/reload/preview save and stale 409.");
  } catch (error) {
    console.error(`P3-07 browser smoke failed at ${stage}`);
    if (error instanceof assert.AssertionError) console.error(error.message);
    else console.error(error.name);
    console.error(error.stack?.split("\n").find(line => /p3-07-browser-smoke\.cjs:\d/.test(line))?.trim());
    throw error;
  } finally {
    await browser.close();
  }
};
