/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { resolve } = require("node:path");
const { mkdir } = require("node:fs/promises");

// Fresh fixture-only contexts; never use a personal browser profile.
exports.runP308BrowserSmoke = async function ({ origin, storyId, chapterId, blockIds, users, renewSession }) {
  const { chromium } = require(resolve(process.env.P3_08_PLAYWRIGHT_MODULE));
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const artifacts = resolve("../.tools/p3-07-browser/artifacts/p3-08");
  await mkdir(artifacts, { recursive: true });
  const errors = [];
  const requests = [];
  const watch = (page) => {
    page.on("pageerror", error => errors.push(error.message.slice(0, 200)));
    page.on("response", response => {
      const path = new URL(response.url()).pathname;
      if (path === "/api/auth/session" || path === "/api/reader-state") requests.push(`${response.request().method()} ${path} ${response.status()}`);
    });
  };
  const cacheKey = id => `story_reader_account_v1:${id}`;
  const setSession = async (context, index) => {
    // Each login/device gets its own session, just like a real OAuth login.
    // Settle previous Auth responses before replacing a fixture cookie.
    for (const page of context.pages()) await page.waitForLoadState("networkidle");
    const token = await renewSession(index);
    await context.addCookies([{ name: "authjs.session-token", value: token, url: origin, httpOnly: true, sameSite: "Lax" }]);
    const session = await (await context.request.get(`${origin}/api/auth/session`)).json();
    assert.equal(session?.user?.id, users[index], "Fixture login must establish the intended account");
  };
  const waitCache = (page, id, condition) => page.waitForFunction(({ key, condition }) => {
    const data = JSON.parse(localStorage.getItem(key) || "null");
    if (!data) return false;
    if (condition === "empty") return data.bookmarks.length === 0;
    if (condition === "saved") return data.bookmarks.length === 1;
    if (condition === "light") return data.settings.theme === "light";
    return true;
  }, { key: cacheKey(id), condition });
  let stage = "guest bookmark / first-login";
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
    context.setDefaultTimeout(20_000);
    const page = await context.newPage(); watch(page);
    assert.equal((await page.goto(`${origin}/stories/${storyId}`)).status(), 200);
    await page.getByRole("button", { name: "Lưu Đọc Sau", exact: true }).click();
    await page.getByRole("button", { name: "Đã Lưu Truyện", exact: true }).waitFor();
    await page.evaluate(({ storyId, chapterId, blockId }) => {
      localStorage.setItem("story_reader_settings", JSON.stringify({ theme: "sepia" }));
      localStorage.setItem("story_reading_progress", JSON.stringify([{ story_id: storyId, chapter_id: chapterId, block_id: blockId, status: "reading", updated_at: "2026-09-08T01:00:00.000Z" }]));
    }, { storyId, chapterId, blockId: blockIds[2] });
    await setSession(context, 2); await page.reload();
    await waitCache(page, users[2], "saved");
    await page.waitForFunction(() => document.documentElement.dataset.theme === "sepia");
    const first = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), cacheKey(users[2]));
    assert.equal(first.settings.reduced_motion, true);
    assert.equal(first.progress[0].block_id, blockIds[2]);
    assert.equal(await page.evaluate(() => localStorage.getItem("story_reading_progress")), null);

    stage = "two live tabs / unbookmark propagation";
    const tab = await context.newPage(); watch(tab);
    await tab.goto(`${origin}/library/bookmarks`);
    await tab.getByRole("button", { name: "Bỏ lưu Sync fixture 0", exact: true }).waitFor();
    await page.getByRole("button", { name: "Đã Lưu Truyện", exact: true }).click();
    await waitCache(page, users[2], "empty");
    await tab.getByText("Chưa có tác phẩm nào trong danh sách đã lưu.").waitFor();
    assert.equal((await page.evaluate(key => JSON.parse(localStorage.getItem(key)), cacheKey(users[2]))).progress.length, 1);

    stage = "second device / DB empty and preferences win";
    const device = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: "no-preference" });
    device.setDefaultTimeout(20_000);
    await setSession(device, 2);
    const other = await device.newPage(); watch(other);
    await other.goto(`${origin}/stories/${storyId}`);
    await other.evaluate(({ storyId, chapterId, blockId }) => {
      localStorage.setItem("story_bookmarks", JSON.stringify([{ user_id: "guest_user", story_id: storyId, created_at: "2026-09-08T01:00:00.000Z" }]));
      localStorage.setItem("story_reading_progress", JSON.stringify([{ story_id: storyId, chapter_id: chapterId, block_id: blockId, status: "reading", updated_at: "2026-09-08T01:00:00.000Z" }]));
    }, { storyId, chapterId, blockId: blockIds[0] });
    await other.reload(); await waitCache(other, users[2], "empty");
    await other.getByRole("button", { name: "Lưu Đọc Sau", exact: true }).waitFor();
    const second = await other.evaluate(key => JSON.parse(localStorage.getItem(key)), cacheKey(users[2]));
    assert.equal(second.settings.reduced_motion, true);
    assert.equal(second.progress[0].block_id, blockIds[2]);
    assert.equal(await other.getByRole("link", { name: "Đọc Tiếp", exact: true }).getAttribute("href"), `/stories/${storyId}/${chapterId}#${blockIds[2]}`);

    stage = "Reader restore / real progress writes";
    await page.goto(`${origin}/stories/${storyId}/${chapterId}`);
    await page.waitForFunction(blockId => {
      const element = document.querySelector(`[data-reader-block-id="${blockId}"]`);
      return element && element.getBoundingClientRect().top < window.innerHeight;
    }, blockIds[2]);
    await page.locator(`[data-reader-block-id="${blockIds[4]}"]`).scrollIntoViewIfNeeded();
    await page.waitForFunction(({ key, blockId }) => JSON.parse(localStorage.getItem(key) || "null")?.progress[0]?.block_id === blockId, { key: cacheKey(users[2]), blockId: blockIds[4] });
    await page.getByRole("button", { name: "Cài đặt đọc truyện", exact: true }).click();
    await page.getByRole("button", { name: "Paper Light", exact: true }).click();
    await waitCache(page, users[2], "light");
    await page.getByRole("button", { name: "Đóng bảng cài đặt", exact: true }).click();
    await other.reload(); await waitCache(other, users[2], "light");
    await other.waitForFunction(() => document.documentElement.dataset.theme === "light");
    for (const width of [375, 768, 1024, 1440]) {
      await other.setViewportSize({ width, height: 900 });
      assert.equal(await other.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
    }
    await other.setViewportSize({ width: 375, height: 812 });
    await other.screenshot({ path: resolve(artifacts, "second-device-375.png"), fullPage: true });

    stage = "network failure rollback and recovery";
    await other.route("**/api/reader-state", route => route.request().method() === "PATCH" ? route.abort() : route.continue());
    await other.getByRole("button", { name: "Lưu Đọc Sau", exact: true }).click();
    await other.getByText("Chưa đồng bộ được dữ liệu. Kiểm tra kết nối rồi thử lại.").waitFor();
    await other.getByRole("button", { name: "Lưu Đọc Sau", exact: true }).waitFor();
    await other.unroute("**/api/reader-state");
    await other.getByRole("button", { name: "Thử lại", exact: true }).click();
    await other.waitForFunction(() => [...document.querySelectorAll("button")].some(button => button.textContent.includes("Lưu Đọc Sau") && !button.disabled));

    stage = "actual sign-out / guest and switch-account isolation";
    await tab.close();
    await page.goto(`${origin}/api/auth/signout`);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.waitForURL(url => !url.pathname.startsWith("/api/auth/"));
    await page.goto(`${origin}/stories/${storyId}`);
    await page.getByRole("button", { name: "Lưu Đọc Sau", exact: true }).waitFor();
    await page.getByRole("link", { name: "Bắt Đầu Đọc", exact: true }).waitFor();
    await setSession(context, 1); await page.reload(); await waitCache(page, users[1], "empty");
    await page.getByRole("link", { name: "Bắt Đầu Đọc", exact: true }).waitFor();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    await page.screenshot({ path: resolve(artifacts, "account-switch-1440.png"), fullPage: true });
    stage = "cookie account change while a tab stays mounted";
    await setSession(context, 2);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
    await page.getByRole("link", { name: "Đọc Tiếp", exact: true }).waitFor();
    stage = "Reader account switch resets the previous account location";
    await page.goto(`${origin}/stories/${storyId}/${chapterId}`);
    await page.waitForFunction(blockId => document.querySelector(`[data-reader-block-id="${blockId}"]`)?.getBoundingClientRect().top < window.innerHeight, blockIds[4]);
    await setSession(context, 1);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    await page.waitForFunction(blockId => {
      const top = document.querySelector(`[data-reader-block-id="${blockId}"]`)?.getBoundingClientRect().top;
      return top !== undefined && top > -100 && top < window.innerHeight;
    }, blockIds[0]);
    assert.deepEqual(errors, []);
    console.log("P3-08 browser: guest/import, two tabs/devices, reduced motion, Reader progress/settings, offline recovery, sign-out/switch, responsive passed");
  } catch (error) {
    console.error(`P3-08 browser failed at: ${stage}`);
    console.error(JSON.stringify({ errors, requests: requests.slice(-15) }));
    for (const [index, context] of browser.contexts().entries()) {
      const page = context.pages()[0];
      if (page) {
        await page.screenshot({ path: resolve(artifacts, `failure-${index}.png`), fullPage: true }).catch(() => {});
        console.error(JSON.stringify(await page.locator("button").evaluateAll(buttons => buttons.slice(0, 12).map(button => ({ text: button.textContent, disabled: button.disabled }))).catch(() => [])));
        console.error(JSON.stringify(await page.evaluate(keys => keys.map(key => {
          const data = JSON.parse(localStorage.getItem(key) || "null");
          return { present: Boolean(data), bookmarks: data?.bookmarks.length, progress: data?.progress.length };
        }), users.map(cacheKey)).catch(() => [])));
      }
    }
    // Only the fixture stage and code location are reported; no cookies/request bodies.
    const location = error.stack?.split("\n").find(line => line.includes("p3-08-browser-smoke.cjs:"));
    if (location) console.error(location.trim());
    throw new Error("P3_08_BROWSER_SMOKE_FAILED");
  } finally { await browser.close(); }
};
