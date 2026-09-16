/* eslint-disable @typescript-eslint/no-require-imports */
// Optional local browser gate. Playwright remains outside the application tree.
const assert = require("node:assert/strict");
const { mkdir } = require("node:fs/promises");
const { resolve } = require("node:path");

exports.runP312BrowserSmoke = async function ({ origin, adminToken, effectId, authorToken, editorPath, keywordQuery, sceneKeywordQuery, effectLabel, sceneEffectLabel }) {
  const modulePath = process.env.P3_12_PLAYWRIGHT_MODULE;
  const { chromium } = require(resolve(modulePath));
  const browser = await chromium.launch({
    channel: process.env.P3_12_BROWSER_CHANNEL || "msedge",
    headless: true,
  });
  const artifacts = resolve("../.tools/p3-07-browser/artifacts/p3-12");
  await mkdir(artifacts, { recursive: true });
  const errors = [];
  let stage = "responsive list";

  const noOverflow = async (page, label) => {
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      true,
      `${label} has horizontal overflow`,
    );
  };

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
    page.on("pageerror", (error) => errors.push(error.name));
    assert.equal((await page.goto(`${origin}/admin/effects?category=visual&status=all`)).status(), 200);
    await page.getByRole("heading", { name: "Thư viện hiệu ứng", exact: true }).waitFor();
    await page.getByRole("button", { name: /Chỉnh sửa hiệu ứng/ }).first().waitFor();
    await noOverflow(page, "Effect Admin at 375px");
    assert.equal(await page.locator("table").evaluate((node) => getComputedStyle(node.parentElement).display), "none");
    assert.equal(await page.getByText("Create Effect", { exact: false }).count(), 0);
    await page.screenshot({ path: resolve(artifacts, "effect-list-mobile-reduced.png"), fullPage: true });

    for (const width of [768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await noOverflow(page, `Effect Admin at ${width}px`);
    }
    assert.notEqual(await page.locator("table").evaluate((node) => getComputedStyle(node.parentElement).display), "none");
    await page.screenshot({ path: resolve(artifacts, "effect-list-desktop-reduced.png"), fullPage: true });

    stage = "drawer focus and technical isolation";
    const searchInput = page.locator("#admin-effect-search");
    assert.equal(await page.locator('#effect-category-filter option[value="audio"]').count(), 0);
    await searchInput.fill(keywordQuery);
    await page.waitForURL((url) => url.searchParams.get("q") === keywordQuery);
    await page.getByText("Hiển thị 1 trong 1 hiệu ứng", { exact: true }).waitFor();
    await searchInput.fill("screen");
    await page.waitForURL((url) => url.searchParams.get("q") === "screen");
    assert.equal(await searchInput.evaluate((node) => node === document.activeElement), true, "Debounced search must retain input focus");
    await searchInput.press("End");
    await searchInput.pressSequentially(effectId.slice("screen".length));
    await page.waitForURL((url) => url.searchParams.get("q") === effectId);
    await page.getByText("Hiển thị 1 trong 1 hiệu ứng", { exact: true }).waitFor();
    const editTrigger = page.getByRole("button", { name: /Chỉnh sửa hiệu ứng/ }).first();
    await editTrigger.click();
    const drawer = page.locator('[role="dialog"][aria-labelledby="effect-drawer-title"]');
    await drawer.waitFor();
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "dialog");
    assert.equal(await drawer.locator('input[type="range"]').count(), 0);
    assert.equal(await drawer.getByText("Technical ID", { exact: true }).count(), 1);
    assert.equal(await drawer.getByText("Category", { exact: true }).count(), 0);
    await page.keyboard.press("Shift+Tab");
    assert.equal(await drawer.evaluate((node) => node.contains(document.activeElement)), true, "Drawer must trap backward focus");
    await page.keyboard.press("Tab");
    assert.equal(await drawer.evaluate((node) => node.contains(document.activeElement)), true, "Drawer must trap forward focus");

    stage = "inline duplicate and error-summary focus";
    const firstKeyword = drawer.locator('li[id^="keyword-"] p').first();
    assert.ok(await firstKeyword.count(), "Browser fixture must exercise keyword regressions");
    if (await firstKeyword.count()) {
      await drawer.locator("#new-keyword").fill((await firstKeyword.textContent()) || "");
      await drawer.getByRole("button", { name: "Thêm", exact: true }).click();
      await drawer.locator("#effect-errors-title").waitFor();
      assert.equal(
        await drawer.locator("#effect-errors-title").locator("..").evaluate((node) => node === document.activeElement),
        true,
        "Invalid keyword must focus the error summary",
      );
      assert.equal(await drawer.locator("#new-keyword-error").count(), 1);
      await drawer.locator("#new-keyword").fill("");
    }

    stage = "keyword Enter validation stays in the keyword editor";
    await drawer.locator("#new-keyword").press("Enter");
    await drawer.locator("#new-keyword-error").waitFor();
    assert.match(await drawer.locator("#new-keyword-error").textContent(), /Nhập từ khóa/);

    stage = "nested keyword delete confirmation isolates Escape and focus";
    const removeTrigger = drawer.getByRole("button", { name: /^Xóa từ khóa / }).first();
    if (await removeTrigger.count()) {
      await removeTrigger.click();
      const deletion = page.getByRole("dialog", { name: /^Xóa từ khóa/ });
      await deletion.waitFor();
      assert.equal(await drawer.evaluate((node) => node.inert), true);
      await deletion.getByRole("button", { name: "Giữ lại", exact: true }).focus();
      await page.keyboard.press("Shift+Tab");
      assert.equal(await deletion.evaluate((node) => node.contains(document.activeElement)), true);
      await page.keyboard.press("Escape");
      await deletion.waitFor({ state: "detached" });
      await drawer.waitFor();
      await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label")?.startsWith("Xóa từ khóa "));
      assert.equal(await drawer.evaluate((node) => node.inert), false);
    }

    stage = "reduced-motion preview and Stop";
    await drawer.getByRole("button", { name: "Preview", exact: true }).click();
    await drawer.getByText(/Khung tĩnh/).waitFor();
    await drawer.getByRole("button", { name: "Dừng", exact: true }).click();
    await drawer.getByText("Đã dừng", { exact: true }).waitFor();
    await drawer.screenshot({ path: resolve(artifacts, "effect-drawer-reduced.png") });

    stage = "dirty close confirmation and focus return";
    const label = drawer.locator("#effect-label");
    const originalLabel = await label.inputValue();
    await label.fill(`${originalLabel} draft`);
    await page.evaluate(() => window.history.back());
    const confirmation = page.getByRole("dialog", { name: "Bỏ thay đổi?" });
    await confirmation.waitFor();
    await confirmation.getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true }).click();
    await drawer.waitFor();
    assert.equal(await label.inputValue(), `${originalLabel} draft`, "Back cancellation retains unsaved metadata");
    await label.fill(originalLabel);
    await drawer.getByText("Mọi thay đổi đã được lưu", { exact: true }).waitFor();
    await drawer.getByRole("button", { name: "Đóng", exact: true }).click();
    await drawer.waitFor({ state: "detached" });
    assert.equal(await editTrigger.evaluate((node) => node === document.activeElement), true, "Closing must return focus to the edited row");

    stage = "stale keyword editing locks writes and retains reload errors in drawer";
    await editTrigger.click();
    await drawer.waitFor();
    const keywordEdit = drawer.getByRole("button", { name: /^Sửa từ khóa / }).first();
    if (await keywordEdit.count()) {
      await keywordEdit.click();
      const keywordInput = drawer.locator('input[id^="edit-keyword-"]');
      const keywordSave = drawer.getByRole("button", { name: /^Lưu từ khóa / });
      await keywordInput.fill("p312 browser stale draft");
      const keywordRoute = "**/api/admin/effects/*/keywords";
      await page.route(keywordRoute, (route) => route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "STALE_UPDATE", message: "Stale revision" } }),
      }));
      await keywordSave.click();
      const reload = drawer.getByRole("button", { name: "Tải dữ liệu mới", exact: true });
      await reload.waitFor();
      assert.equal(await keywordSave.isDisabled(), true);
      assert.equal(await keywordInput.isDisabled(), true);
      await page.unroute(keywordRoute);

      await reload.click();
      const discard = page.getByRole("dialog", { name: "Bỏ thay đổi?" });
      await discard.waitFor();
      await discard.getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true }).click();
      assert.equal(await keywordInput.inputValue(), "p312 browser stale draft");

      const catalogRoute = "**/api/admin/effects?*";
      await page.route(catalogRoute, (route) => route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "UNAVAILABLE", message: "Unavailable" } }),
      }));
      await reload.click();
      await discard.getByRole("button", { name: "Tải và bỏ thay đổi", exact: true }).click();
      await drawer.getByRole("link", { name: /tạm khóa/ }).waitFor();
      await page.unroute(catalogRoute);
      await drawer.getByRole("button", { name: "Đóng", exact: true }).click();
      await discard.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
    } else {
      await drawer.getByRole("button", { name: "Đóng", exact: true }).click();
    }
    await drawer.waitFor({ state: "detached" });

    stage = "mobile navigation sheet";
    await page.setViewportSize({ width: 375, height: 812 });
    const menu = page.getByRole("button", { name: "Mở menu quản trị", exact: true });
    await menu.click();
    const navigation = page.getByRole("dialog", { name: "Menu quản trị" });
    await navigation.waitFor();
    assert.equal(await navigation.getByRole("link", { name: "Hiệu ứng", exact: true }).count(), 1);
    await page.keyboard.press("Escape");
    await navigation.waitFor({ state: "detached" });
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Mở menu quản trị");
    assert.equal(await menu.evaluate((node) => node === document.activeElement), true);

    stage = "author audio and keyword search";
    await context.addCookies([{ name: "authjs.session-token", value: authorToken, url: origin, httpOnly: true, sameSite: "Lax" }]);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(origin + editorPath);
    await page.getByRole("button", { name: /Chỉnh sửa hiệu ứng Tiếng Mưa/ }).click();
    const picker = page.getByRole("dialog", { name: "Chỉnh Sửa Hiệu Ứng", exact: true });
    await picker.waitFor();
    await picker.getByRole("button", { name: "Tìm kiếm hiệu ứng", exact: true }).click();
    const pickerSearch = picker.getByPlaceholder(/Tìm theo tên/);
    await pickerSearch.fill("lop dop");
    await picker.getByText("Tiếng Mưa Rơi (Gentle Rain)", { exact: true }).waitFor();
    assert.equal(await picker.getByText("Sấm Rền Vang (Thunder Rumble)", { exact: true }).count(), 0);
    await picker.getByRole("button", { name: "Hình Ảnh", exact: true }).click();
    await pickerSearch.fill(keywordQuery);
    await picker.getByText(effectLabel, { exact: true }).waitFor();
    await page.screenshot({ path: resolve(artifacts, "author-block-keyword-search.png"), fullPage: true });
    // Only search changed; dismiss without changing the author's snapshot.
    await page.keyboard.press("Escape");
    await picker.waitFor({ state: "detached" });
    const sceneEdit = page.locator('.scene-panel-expanded article button[aria-label^="Chỉnh sửa "]');
    await sceneEdit.first().click();
    const scenePicker = page.getByRole("dialog", { name: "Chỉnh Sửa Scene", exact: true });
    await scenePicker.waitFor();
    await scenePicker.getByRole("button", { name: /Thêm hiệu ứng\.\.\./ }).click();
    await scenePicker.getByPlaceholder("Tìm hiệu ứng...").fill(sceneKeywordQuery);
    const sceneResult = scenePicker.getByRole("option").filter({ hasText: sceneEffectLabel.split(" (")[0] });
    await sceneResult.scrollIntoViewIfNeeded();
    assert.equal(await sceneResult.isVisible(), true);
    await page.screenshot({ path: resolve(artifacts, "author-scene-keyword-search.png"), fullPage: true });
    await scenePicker.getByRole("button", { name: /Tiếng Mưa Rơi/ }).click();
    await scenePicker.getByPlaceholder("Tìm hiệu ứng...").waitFor({ state: "detached" });
    await scenePicker.getByPlaceholder("Tìm âm thanh...").fill("lop dop");
    assert.equal(await scenePicker.getByText("Sấm Rền Vang (Thunder Rumble)", { exact: true }).count(), 0);
    await page.screenshot({ path: resolve(artifacts, "author-scene-audio-search.png"), fullPage: true });
    assert.deepEqual(errors, []);
    await context.close();
    console.log("P3-12 browser smoke passed: responsive Admin, keyword search in Admin/block/scene pickers, per-source audio search, focus/confirm/stale/Back guards and reduced-motion preview.");
  } catch (error) {
    console.error(`P3-12 browser smoke failed at: ${stage}`);
    console.error(String(error.message).slice(0, 1600));
    for (const activeContext of browser.contexts()) {
      const activePage = activeContext.pages().at(-1);
      if (activePage) await activePage.screenshot({ path: resolve(artifacts, "failure.png"), fullPage: true }).catch(() => {});
    }
    if (error instanceof assert.AssertionError) console.error(error.message);
    const location = error.stack?.split("\n").find((line) => line.includes("p3-12-browser-smoke.cjs:"));
    if (location) console.error(location.trim());
    throw new Error("P3_12_BROWSER_SMOKE_FAILED");
  } finally {
    await browser.close();
  }
};
