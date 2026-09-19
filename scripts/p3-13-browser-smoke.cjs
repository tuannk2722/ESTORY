/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { mkdir } = require("node:fs/promises");
const { resolve } = require("node:path");

exports.runP313BrowserSmoke = async function ({ origin, adminToken }) {
  const { chromium } = require(resolve(process.env.P3_13_PLAYWRIGHT_MODULE));
  const browser = await chromium.launch({
    channel: process.env.P3_13_BROWSER_CHANNEL || "msedge",
    headless: true,
  });
  const artifacts = resolve("../.tools/p3-07-browser/artifacts/p3-13");
  await mkdir(artifacts, { recursive: true });
  const pageErrors = [];
  let stage = "mobile catalog";

  const noOverflow = async (page, label) => assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    true,
    `${label} has horizontal overflow`,
  );

  try {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      reducedMotion: "reduce",
    });
    context.setDefaultTimeout(30_000);
    await context.addCookies([{
      name: "authjs.session-token",
      value: adminToken,
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    }]);
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.name));
    assert.equal((await page.goto(`${origin}/admin/scene-library?tab=backgrounds`)).status(), 200);
    await page.getByRole("heading", { name: "Thư viện bối cảnh", exact: true }).waitFor();
    await page.locator('[data-scene-catalog-panel="backgrounds"]').waitFor();
    await page.waitForFunction(() => document.querySelector('[data-scene-catalog-panel="backgrounds"]')?.getAttribute("aria-busy") === "false");
    await noOverflow(page, "Scene Catalog at 375px");
    await page.screenshot({ path: resolve(artifacts, "backgrounds-mobile-reduced.png"), fullPage: true });

    stage = "retired tabs and URL filters";
    assert.equal(await page.getByRole("tab", { name: "Backgrounds", exact: true }).count(), 0);
    assert.equal(await page.getByRole("tab", { name: "Palettes", exact: true }).count(), 0);
    assert.equal(await page.getByRole("tab", { name: /Presets/ }).count(), 0);
    const search = page.getByRole("searchbox", { name: "Tìm catalog" });
    await search.fill("browser query");
    await page.waitForURL((url) => url.searchParams.get("q") === "browser query");
    assert.equal(await search.evaluate((node) => node === document.activeElement), true);
    await search.fill("");
    await page.waitForURL((url) => !url.searchParams.has("q"));

    stage = "background drawer, conditional fields and error summary";
    const createBackground = page.getByRole("button", { name: "Tạo Background", exact: true });
    await createBackground.click();
    const drawer = page.getByRole("dialog", { name: "Bối cảnh mới" });
    await drawer.waitFor();
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "dialog");
    await drawer.locator("#catalog-label").fill(" ");
    await drawer.getByRole("button", { name: "Lưu nháp", exact: true }).click();
    const errorSummary = drawer.locator("#catalog-errors-title").locator("..");
    await errorSummary.waitFor();
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "alert");
    assert.equal(
      await errorSummary.evaluate((node) => node === document.activeElement),
      true,
      "Invalid form must focus the error summary",
    );
    const kind = drawer.locator("#background-kind");
    await kind.selectOption("video");
    assert.equal(await drawer.locator("#background-file").getAttribute("accept"), "video/mp4,video/webm");
    assert.equal(await drawer.locator("#background-poster").count(), 1);
    await kind.selectOption("radial_gradient");
    assert.equal(await drawer.getByText("Tâm X", { exact: false }).count(), 1);
    assert.equal(await drawer.getByRole("button", { name: "Thêm điểm màu" }).count(), 1);
    await page.keyboard.press("Shift+Tab");
    assert.equal(await drawer.evaluate((node) => node.contains(document.activeElement)), true);
    await drawer.screenshot({ path: resolve(artifacts, "background-drawer-mobile.png") });
    await drawer.getByRole("button", { name: "Hủy", exact: true }).click();
    const discard = page.getByRole("dialog", { name: "Bỏ thay đổi?" });
    await discard.waitFor();
    await discard.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
    await drawer.waitFor({ state: "detached" });
    await page.waitForFunction(() => document.activeElement?.textContent?.includes("Tạo Background"));
    assert.equal(await createBackground.evaluate((node) => node === document.activeElement), true);

    stage = "existing media, static thumbnails and dismissible menu";
    await page.locator("#background-type-filter").selectOption("image");
    await page.waitForURL((url) => url.searchParams.get("type") === "image");
    const backgroundPanel = page.locator('[data-scene-catalog-panel="backgrounds"]');
    await page.waitForFunction(() => document.querySelector('[data-scene-catalog-panel="backgrounds"]')?.getAttribute("aria-busy") === "false");
    await backgroundPanel.locator("article").first().waitFor();
    await backgroundPanel.locator("article").first().getByText(/^Ảnh ·/).waitFor();
    assert.equal(await backgroundPanel.locator("video").count(), 0, "Catalog thumbnails must never autoplay video");
    assert.ok(await backgroundPanel.locator('[data-reduced-motion="true"]').count() > 0, "Legacy looping thumbnails must use their static fallback");
    const legacyCards = backgroundPanel.locator("article").filter({ hasText: "Chuyển động legacy" });
    assert.ok(await legacyCards.count() > 0);
    const backgroundCard = legacyCards.first();
    const editExistingBackground = backgroundCard.getByRole("button", { name: "Chỉnh sửa", exact: true });
    await editExistingBackground.click();
    const existingBackgroundDrawer = page.locator('[role="dialog"][aria-labelledby="scene-catalog-drawer-title"]');
    const existingMediaField = existingBackgroundDrawer.locator("#background-file").locator("..");
    await existingMediaField.getByText("Đổi tệp", { exact: true }).waitFor();
    assert.equal(
      (await existingMediaField.textContent()).includes("Kéo thả ảnh vào đây"),
      false,
      "Existing media must render its current filename instead of an empty upload prompt",
    );
    await existingBackgroundDrawer.getByText(/bối cảnh ảnh từ dữ liệu legacy/, { exact: false }).waitFor();
    assert.equal(await existingBackgroundDrawer.locator("#background-file").getAttribute("accept"), "image/jpeg,image/png,image/webp");
    await existingBackgroundDrawer.screenshot({ path: resolve(artifacts, "background-existing-media.png") });
    await page.keyboard.press("Escape");
    await existingBackgroundDrawer.waitFor({ state: "detached" });
    assert.equal(await editExistingBackground.evaluate((node) => node === document.activeElement), true);
    const menuTrigger = backgroundCard.getByRole("button", { name: /Thao tác với/ });
    await menuTrigger.click();
    const actionMenu = page.getByRole("menu", { name: /Thao tác với/ });
    await actionMenu.waitFor();
    await page.getByRole("heading", { name: "Backgrounds global", exact: true }).click();
    await actionMenu.waitFor({ state: "detached" });
    await page.locator("#background-type-filter").selectOption("all");
    await page.waitForURL((url) => !url.searchParams.has("type"));
    await page.waitForFunction(() => document.querySelector('[data-scene-catalog-panel="backgrounds"]')?.getAttribute("aria-busy") === "false");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await noOverflow(page, "Background catalog at 1440px");
    await page.screenshot({ path: resolve(artifacts, "backgrounds-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });

    stage = "responsive background grid and pagination";
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForFunction(() => document.querySelector('[data-scene-catalog-panel="backgrounds"]')?.getAttribute("aria-busy") === "false");
    await noOverflow(page, "Background catalog at 1440px");
    const cards = page.locator('[data-scene-catalog-panel="backgrounds"]').locator("article");
    await cards.first().waitFor();
    assert.ok(await cards.count() > 0 && await cards.count() <= 12);
    const gridColumns = await cards.first().locator("..").evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length);
    assert.equal(gridColumns, 4);
    const nextPage = page.getByRole("button", { name: /Trang tiếp/ });
    if (await nextPage.count()) {
      await nextPage.click();
      await page.waitForURL((url) => Boolean(url.searchParams.get("cursor")));
      assert.ok(await cards.count() <= 12);
      const backgroundSearch = page.getByRole("searchbox", { name: "Tìm catalog" });
      await backgroundSearch.fill("không tồn tại browser smoke");
      await page.waitForURL((url) => url.searchParams.get("q") === "không tồn tại browser smoke" && !url.searchParams.has("cursor"));
      await backgroundSearch.fill("");
      await page.waitForURL((url) => !url.searchParams.has("q"));
      await page.waitForFunction(() => document.querySelector('[data-scene-catalog-panel="backgrounds"]')?.getAttribute("aria-busy") === "false");
      await cards.first().waitFor();
    }
    await page.screenshot({ path: resolve(artifacts, "backgrounds-pagination-desktop.png"), fullPage: true });

    stage = "mobile navigation exposes enabled catalog";
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole("button", { name: "Mở menu quản trị", exact: true }).click();
    const navigation = page.getByRole("dialog", { name: "Menu quản trị" });
    await navigation.waitFor();
    assert.equal(await navigation.getByRole("link", { name: "Bối cảnh", exact: true }).count(), 1);
    assert.equal(await navigation.getByRole("button", { name: /Bối cảnh, sắp có/ }).count(), 0);
    await page.keyboard.press("Escape");
    await navigation.waitFor({ state: "detached" });
    assert.deepEqual(pageErrors, []);
    await context.close();
    console.log("P3-13/P3-14 browser smoke passed: background-only catalog, responsive grid, URL search/cursor, static thumbnails, existing-media UX, menu dismissal and drawer focus/errors.");
  } catch (error) {
    console.error(`P3-13 browser smoke failed at: ${stage}`);
    console.error(String(error.message).slice(0, 1600));
    for (const context of browser.contexts()) {
      const page = context.pages().at(-1);
      if (page) await page.screenshot({ path: resolve(artifacts, "failure.png"), fullPage: true }).catch(() => {});
    }
    const location = error.stack?.split("\n").find((line) => line.includes("p3-13-browser-smoke.cjs:"));
    if (location) console.error(location.trim());
    throw new Error("P3_13_BROWSER_SMOKE_FAILED");
  } finally {
    await browser.close();
  }
};
