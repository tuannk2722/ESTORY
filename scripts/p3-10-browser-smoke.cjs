/* eslint-disable @typescript-eslint/no-require-imports */
// Optional local browser gate. Playwright stays outside the application tree.
const assert = require("node:assert/strict");
const { mkdir } = require("node:fs/promises");
const { resolve } = require("node:path");

exports.runP310BrowserSmoke = async function ({
  origin,
  readerToken,
  readerCoverUploadId,
  outsiderStoryId,
  adminToken,
  publicStoryId,
  publicCoverPosition,
}) {
  const modulePath = process.env.P3_10_PLAYWRIGHT_MODULE || process.env.P3_07_PLAYWRIGHT_MODULE;
  const { chromium } = require(resolve(modulePath));
  const browser = await chromium.launch({ channel: process.env.P3_10_BROWSER_CHANNEL || process.env.P3_07_BROWSER_CHANNEL || "msedge", headless: true });
  const artifacts = resolve("../.tools/p3-07-browser/artifacts/p3-10");
  await mkdir(artifacts, { recursive: true });
  const coverPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const pageErrors = [];
  let stage = "guest auth menu";

  const watch = page => page.on("pageerror", error => pageErrors.push(error.name));
  const noOverflow = async (page, label) => {
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      true,
      `${label} has horizontal overflow`,
    );
  };

  try {
    const guest = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce" });
    const guestPage = await guest.newPage();
    watch(guestPage);
    await guestPage.route("https://media.example.invalid/**", route => route.fulfill({
      status: 200,
      contentType: "image/png",
      body: coverPng,
    }));
    await guestPage.goto(origin);
    await noOverflow(guestPage, "Guest header at 375px");
    const publicCover = await guestPage.evaluate(({ storyId, position }) => {
      const link = document.querySelector(`a[href="/stories/${storyId}"]`);
      const image = link?.closest(".glass-card")?.querySelector("img");
      const frame = image?.parentElement?.getBoundingClientRect();
      return {
        objectPosition: image?.style.objectPosition,
        aspectRatio: frame && frame.height > 0 ? frame.width / frame.height : 0,
        expected: `${position.x}% ${position.y}%`,
      };
    }, { storyId: publicStoryId, position: publicCoverPosition });
    assert.equal(publicCover.objectPosition, publicCover.expected, "Home card must use the persisted author crop");
    assert.ok(Math.abs(publicCover.aspectRatio - (16 / 9)) < 0.03, "Home cover must use the same 16:9 viewport");
    const loginTrigger = guestPage.getByRole("button", { name: "Đăng nhập", exact: true });
    await loginTrigger.click();
    const loginDialog = guestPage.getByRole("dialog", { name: "Đăng nhập StoryVerse" });
    await loginDialog.waitFor();
    await guestPage.waitForFunction(() => document.activeElement?.textContent?.includes("Google"));
    assert.match(await guestPage.evaluate(() => document.activeElement?.textContent || ""), /Google/);
    await guestPage.keyboard.press("Shift+Tab");
    assert.match(await guestPage.evaluate(() => document.activeElement?.textContent || ""), /GitHub/);
    await guestPage.keyboard.press("Escape");
    assert.equal(await loginTrigger.evaluate(node => node === document.activeElement), true);
    await guest.close();

    stage = "live StoryCard preview themes";
    const themeAuthor = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await themeAuthor.addCookies([{ name: "authjs.session-token", value: readerToken, url: origin, httpOnly: true, sameSite: "Lax" }]);
    const themePage = await themeAuthor.newPage();
    themePage.setDefaultTimeout(60_000);
    watch(themePage);
    const themeStateReady = themePage.waitForResponse(async response => {
      if (!response.url().endsWith("/api/reader-state") || response.status() !== 200) return false;
      const payload = await response.json().catch(() => null);
      return Boolean(payload?.data);
    });
    assert.equal((await themePage.goto(`${origin}/author/stories/new`)).status(), 200);
    await themeStateReady;
    await noOverflow(themePage, "Story wizard live preview at 1440px");
    await themePage.locator("#story-cover").setInputFiles({ name: "p3-10-cover.png", mimeType: "image/png", buffer: coverPng });
    await themePage.locator("#story-title").fill("P3-10 browser story");
    await themePage.locator("#story-byline").fill("Tác giả browser");
    await themePage.locator("#story-description").fill("Câu chuyện được tạo xuyên suốt từ giao diện tác giả.");
    await themePage.locator("#story-genre").fill("Kỳ ảo");
    await themePage.locator("#story-genre").press("Enter");
    const themePreview = themePage.locator("[data-live-story-card-preview]");
    const compactThemeSwitcher = themePage.getByRole("button", { name: /Giao diện hiện tại:/ });
    await themePage.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    await themePreview.screenshot({ path: resolve(artifacts, "live-story-card-desktop-dark.png") });
    for (const theme of ["light", "sepia"]) {
      stage = `live preview ${theme} theme`;
      const settingsResponse = themePage.waitForResponse(response => response.url().endsWith("/api/reader-state") && response.request().method() === "PATCH");
      await compactThemeSwitcher.click();
      await themePage.waitForFunction((nextTheme) => document.documentElement.dataset.theme === nextTheme, theme);
      assert.equal((await settingsResponse).status(), 200, `Saving ${theme} theme must succeed`);
      await themePreview.screenshot({ path: resolve(artifacts, `live-story-card-desktop-${theme}.png`) });
    }
    const restoreThemeResponse = themePage.waitForResponse(response => response.url().endsWith("/api/reader-state") && response.request().method() === "PATCH");
    await compactThemeSwitcher.click();
    await themePage.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    assert.equal((await restoreThemeResponse).status(), 200, "Restoring dark theme must succeed");
    await themeAuthor.close();

    stage = "reader wizard";
    const author = await browser.newContext({ viewport: { width: 375, height: 900 } });
    await author.addCookies([{ name: "authjs.session-token", value: readerToken, url: origin, httpOnly: true, sameSite: "Lax" }]);
    const page = await author.newPage();
    page.setDefaultTimeout(60_000);
    await page.route("https://media.example.invalid/**", route => route.fulfill({
      status: 200,
      contentType: "image/png",
      body: coverPng,
    }));
    watch(page);
    await page.route("**/__p3-10-cover-upload", async route => {
      await new Promise(resolveDelay => setTimeout(resolveDelay, 1200));
      await route.fulfill({ status: 200, body: "" });
    });
    await page.route("**/api/upload/presign", route => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          uploadId: readerCoverUploadId,
          parts: [{ role: "primary", url: `${origin}/__p3-10-cover-upload`, headers: {} }],
        },
      }),
    }));
    const readerStateReady = page.waitForResponse(async response => {
      if (!response.url().endsWith("/api/reader-state") || response.status() !== 200) return false;
      const payload = await response.json().catch(() => null);
      return Boolean(payload?.data);
    });
    assert.equal((await page.goto(`${origin}/author/stories/new`)).status(), 200);
    await readerStateReady;
    await noOverflow(page, "Story wizard at 375px");
    assert.equal(await page.getByText(/Freesound/i).count(), 0);
    const liveStoryPreview = page.locator("[data-live-story-card-preview]");
    const liveStoryCard = liveStoryPreview.locator("[data-story-card-visual]");
    await liveStoryPreview.waitFor();
    assert.equal(await liveStoryPreview.locator("a, button").count(), 0, "Author card preview must remain inert");

    await page.locator("#story-cover").setInputFiles({ name: "p3-10-cover.png", mimeType: "image/png", buffer: coverPng });
    const coverPreview = page.getByAltText("Xem trước ảnh bìa truyện");
    await coverPreview.waitFor();
    const coverAdjuster = page.getByRole("group", { name: /Vùng căn ảnh bìa/ });
    await coverAdjuster.focus();
    await coverAdjuster.press("ArrowUp");
    assert.equal(await coverPreview.evaluate(node => node.style.objectPosition), "50% 45%", "Cover keyboard controls must update the preview crop");
    await liveStoryCard.locator("img").waitFor();
    assert.equal(await liveStoryCard.locator("img").evaluate(node => node.style.objectPosition), "50% 45%", "Live card must use the same focal point as the cover adjuster");
    await page.locator("#story-title").fill("P3-10 browser story");
    await page.locator("#story-byline").fill("Tác giả browser");
    await page.locator("#story-description").fill("Câu chuyện được tạo xuyên suốt từ giao diện tác giả.");
    await page.locator("#story-genre").fill("Kỳ ảo");
    await page.locator("#story-genre").press("Enter");
    assert.equal(await liveStoryCard.locator("h3").textContent(), "P3-10 browser story");
    assert.equal(await liveStoryCard.getByText("Tác giả browser", { exact: true }).count(), 1);
    assert.equal(await liveStoryCard.getByText("Kỳ ảo", { exact: true }).count(), 1);
    await liveStoryPreview.screenshot({ path: resolve(artifacts, "live-story-card-mobile-dark.png") });
    await page.getByRole("button", { name: /Tiếp tục/ }).click();
    assert.equal(await liveStoryPreview.count(), 0, "Live card preview must only appear on wizard step 1");

    await page.getByRole("button", { name: "Quay lại", exact: true }).click();
    await liveStoryPreview.waitFor();
    await coverPreview.waitFor();
    assert.equal(
      await coverPreview.evaluate(node => node.complete && node.naturalWidth > 0),
      true,
      "The selected blob preview must remain valid after returning from step 2",
    );
    assert.equal(await coverPreview.evaluate(node => node.style.objectPosition), "50% 45%", "Cover crop must survive wizard step changes");
    await page.screenshot({ path: resolve(artifacts, "story-wizard-cover-mobile.png") });
    await page.getByRole("button", { name: /Tiếp tục/ }).click();

    const saveStory = page.getByRole("button", { name: "Lưu truyện", exact: true });
    await saveStory.click();
    const summary = page.getByRole("alert").filter({ has: page.getByText("Hãy kiểm tra lại thông tin") });
    await summary.waitFor();
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "alert");
    assert.equal(await summary.evaluate(node => node === document.activeElement), true);
    await summary.getByRole("link").click();
    const chapterTitle = page.locator('[id^="wizard-"][id$="-title"]');
    assert.equal(await chapterTitle.evaluate(node => node === document.activeElement), true);
    await chapterTitle.fill("Chương mở đầu");
    await page.getByRole("button", { name: "Thêm chương", exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('[id^="wizard-"][id$="-title"]').length === 2);
    await page.locator('[id^="wizard-"][id$="-title"]').nth(1).fill("Chương kết");
    const wizardGapButton = page.getByRole("button", { name: "Thêm chương sau chương 1", exact: true });
    const wizardGapVisual = wizardGapButton.locator('span[aria-hidden="true"]').filter({ hasText: "Thêm chương" });
    assert.equal(await wizardGapVisual.count(), 1, "The chapter gap must retain one visual label");
    const wizardGapVisualHandle = await wizardGapVisual.elementHandle();
    assert.ok(wizardGapVisualHandle);
    await page.mouse.move(0, 0);
    await page.waitForFunction(element => getComputedStyle(element).opacity === "0", wizardGapVisualHandle);
    await wizardGapButton.hover();
    await page.waitForFunction(element => getComputedStyle(element).opacity === "1", wizardGapVisualHandle);
    await page.mouse.move(0, 0);
    await page.waitForFunction(element => getComputedStyle(element).opacity === "0", wizardGapVisualHandle);
    await page.keyboard.press("Shift+Tab");
    assert.equal(await wizardGapButton.evaluate(node => node === document.activeElement), true, "Keyboard focus must reach the visually hidden gap action");
    await page.waitForFunction(element => getComputedStyle(element).opacity === "1", wizardGapVisualHandle);
    await wizardGapButton.press("Enter");
    await page.waitForFunction(() => document.querySelectorAll('[id^="wizard-"][id$="-title"]').length === 3);
    const insertedChapterTitle = page.locator('[id^="wizard-"][id$="-title"]').nth(1);
    assert.equal(await insertedChapterTitle.evaluate(node => node === document.activeElement), true);
    await insertedChapterTitle.fill("Chương giữa");
    assert.deepEqual(
      await page.locator('[id^="wizard-"][id$="-title"]').evaluateAll(nodes => nodes.map(node => node.value)),
      ["Chương mở đầu", "Chương giữa", "Chương kết"],
    );

    stage = "wizard chapter deletion focus";
    const wizardDeleteFocusId = await page.locator('[id^="wizard-"][id$="-title"]').nth(2).getAttribute("id");
    assert.ok(wizardDeleteFocusId);
    await page.getByRole("button", { name: "Xóa chương 2", exact: true }).click();
    await page.waitForFunction(expectedId => (
      document.querySelectorAll('[id^="wizard-"][id$="-title"]').length === 2
      && document.activeElement?.id === expectedId
    ), wizardDeleteFocusId);
    assert.deepEqual(
      await page.locator('[id^="wizard-"][id$="-title"]').evaluateAll(nodes => nodes.map(node => node.value)),
      ["Chương mở đầu", "Chương kết"],
    );
    await page.getByRole("button", { name: "Thêm chương sau chương 1", exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('[id^="wizard-"][id$="-title"]').length === 3);
    await page.locator('[id^="wizard-"][id$="-title"]').nth(1).fill("Chương giữa");

    stage = "wizard chapter drag reorder";
    await page.setViewportSize({ width: 1440, height: 1000 });
    const wizardChapterList = page.getByRole("list", { name: "Danh sách chương", exact: true });
    const wizardRows = wizardChapterList.locator("[data-reorder-item]");
    await wizardRows.nth(1).locator("[data-reorder-handle]").dragTo(wizardRows.nth(0), {
      targetPosition: { x: 12, y: 2 },
    });
    await page.waitForFunction(() => (
      [...document.querySelectorAll('[id^="wizard-"][id$="-title"]')].map(node => node.value).join("|")
      === "Chương giữa|Chương mở đầu|Chương kết"
    ));
    const wizardSecondRowBox = await wizardRows.nth(1).boundingBox();
    assert.ok(wizardSecondRowBox);
    await wizardRows.nth(0).locator("[data-reorder-handle]").dragTo(wizardRows.nth(1), {
      targetPosition: { x: 12, y: wizardSecondRowBox.height - 2 },
    });
    await page.waitForFunction(() => (
      [...document.querySelectorAll('[id^="wizard-"][id$="-title"]')].map(node => node.value).join("|")
      === "Chương mở đầu|Chương giữa|Chương kết"
    ));

    const createdResponse = page.waitForResponse(response => response.url() === `${origin}/api/stories` && response.request().method() === "POST");
    await saveStory.click();
    const progress = page.getByRole("status").filter({ hasText: "Đang tải ảnh" });
    await progress.waitFor();
    assert.equal(await progress.getByRole("button", { name: "Hủy", exact: true }).isEnabled(), true, "Upload cancel must remain available while saving");
    assert.equal((await createdResponse).status(), 201);
    await page.waitForURL(url => /^\/author\/stories\/[^/]+$/.test(url.pathname) && url.pathname !== "/author/stories/new");
    const storyId = new URL(page.url()).pathname.split("/").at(-1);
    assert.ok(storyId);
    await page.getByRole("heading", { name: "P3-10 browser story", exact: true }).waitFor();
    assert.equal(
      await page.getByAltText("Xem trước ảnh bìa truyện").evaluate(node => node.style.objectPosition),
      "50% 45%",
      "The persisted crop must match the author preview",
    );
    assert.equal(
      await page.locator("[data-live-story-card-preview] [data-story-card-visual] img").evaluate(node => node.style.objectPosition),
      "50% 45%",
      "The management live card must start from the persisted focal point",
    );
    const persistedCoverAdjuster = page.getByRole("group", { name: /Vùng căn ảnh bìa/ });
    await persistedCoverAdjuster.focus();
    await persistedCoverAdjuster.press("ArrowDown");
    assert.equal(
      await page.getByAltText("Xem trước ảnh bìa truyện").evaluate(node => node.style.objectPosition),
      "50% 50%",
      "An existing persisted cover must remain adjustable without selecting a new file",
    );
    await persistedCoverAdjuster.press("ArrowUp");
    assert.equal(await page.getByText(/Freesound/i).count(), 0);

    const managedChapterList = page.getByRole("list", { name: "Danh sách chương của truyện", exact: true });
    const managedRows = managedChapterList.locator("[data-reorder-item]");
    assert.equal(await page.locator('main [aria-live]').count(), 0, "Management feedback must not add a competing live region beside the global toaster");

    stage = "managed end insertion disclosure";
    const managedEndAddButton = page.getByRole("button", { name: "Thêm chương", exact: true });
    assert.equal(await page.locator("[data-chapter-insertion-form]").count(), 0, "Management must show an add button rather than an always-open draft");
    const managedRowCountBeforeDraft = await managedRows.count();
    await managedEndAddButton.click();
    const managedEndInsertionTitle = page.locator("#insert-at-end");
    const managedEndInsertionForm = page.locator("[data-chapter-insertion-form]").filter({ has: managedEndInsertionTitle });
    await managedEndInsertionTitle.waitFor();
    assert.equal(await managedRows.count(), managedRowCountBeforeDraft, "Opening the end draft must not persist an empty chapter");
    assert.equal(await managedEndInsertionTitle.evaluate(node => node === document.activeElement), true, "The revealed end draft must receive focus");
    await page.screenshot({ path: resolve(artifacts, "chapter-insertion-draft-desktop.png") });
    await managedEndInsertionForm.getByRole("button", { name: "Thêm", exact: true }).click();
    assert.equal(await managedEndInsertionForm.getByRole("alert").textContent(), "Vui lòng nhập tên chương.");
    await managedEndInsertionTitle.focus();
    await managedEndInsertionTitle.press("Escape");
    await managedEndInsertionForm.waitFor({ state: "detached" });
    assert.equal(await managedEndAddButton.evaluate(node => node === document.activeElement), true, "Escape must return focus to the end insertion trigger");

    stage = "managed chapter rename normalization";
    const firstManagedTitle = managedRows.nth(0).locator('input[id^="manage-"][id$="-title"]');
    await firstManagedTitle.fill("  Chương mở đầu đã chuẩn hóa  ");
    const normalizedRename = page.waitForResponse(response => (
      /\/chapters\/[^/]+$/.test(new URL(response.url()).pathname)
      && response.request().method() === "PATCH"
    ));
    await managedRows.nth(0).getByRole("button", { name: "Lưu tên", exact: true }).click();
    assert.equal((await normalizedRename).status(), 200);
    await page.waitForFunction(() => (
      document.querySelector('[data-reorder-item] input[id^="manage-"]')?.value === "Chương mở đầu đã chuẩn hóa"
    ));
    assert.equal(await managedRows.nth(0).getByRole("button", { name: "Lưu tên", exact: true }).isDisabled(), true, "The normalized server title must replace the local draft");
    await firstManagedTitle.fill("Chương mở đầu");
    const restoredRename = page.waitForResponse(response => (
      /\/chapters\/[^/]+$/.test(new URL(response.url()).pathname)
      && response.request().method() === "PATCH"
    ));
    await managedRows.nth(0).getByRole("button", { name: "Lưu tên", exact: true }).click();
    assert.equal((await restoredRename).status(), 200);
    await page.waitForFunction(() => (
      document.querySelector('[data-reorder-item] input[id^="manage-"]')?.value === "Chương mở đầu"
    ));

    stage = "managed chapter deletion focus";
    const managedDeleteFocusId = await managedRows.nth(2).locator('input[id^="manage-"][id$="-title"]').getAttribute("id");
    assert.ok(managedDeleteFocusId);
    const managedDelete = page.waitForResponse(response => (
      /\/chapters\/[^/]+$/.test(new URL(response.url()).pathname)
      && response.request().method() === "DELETE"
    ));
    await managedRows.nth(1).getByRole("button", { name: "Xóa Chương giữa", exact: true }).click();
    assert.equal((await managedDelete).status(), 200);
    await page.waitForFunction(expectedId => (
      document.querySelectorAll('[data-reorder-item] input[id^="manage-"]').length === 2
      && document.activeElement?.id === expectedId
    ), managedDeleteFocusId);
    assert.deepEqual(
      await page.locator('[data-reorder-item] input[id^="manage-"]').evaluateAll(nodes => nodes.map(node => node.value)),
      ["Chương mở đầu", "Chương kết"],
    );
    await page.getByRole("button", { name: "Thêm chương sau Chương mở đầu", exact: true }).click();
    const managedInsertionTitle = page.locator('input[id^="insert-after-"]');
    const managedInsertionForm = page.locator("[data-chapter-insertion-form]").filter({ has: managedInsertionTitle });
    await managedInsertionForm.waitFor();
    await managedInsertionTitle.waitFor();
    assert.equal(await managedInsertionTitle.evaluate(node => node === document.activeElement), true);
    await managedInsertionTitle.fill("Chương giữa");
    const managedAnchorInputId = await managedRows.nth(0).locator('input[id^="manage-"][id$="-title"]').getAttribute("id");
    assert.ok(managedAnchorInputId);
    const managedAnchorChapterId = managedAnchorInputId.slice("manage-".length, -"-title".length);
    const managedCreateRequest = page.waitForRequest(request => (
      request.url() === `${origin}/api/stories/${storyId}/chapters`
      && request.method() === "POST"
    ));
    const managedCreate = page.waitForResponse(response => (
      response.url() === `${origin}/api/stories/${storyId}/chapters`
      && response.request().method() === "POST"
    ));
    await managedInsertionForm.getByRole("button", { name: "Thêm", exact: true }).click();
    assert.equal((await managedCreateRequest).postDataJSON().afterChapterId, managedAnchorChapterId, "Middle insertion must preserve its anchor in the create payload");
    assert.equal((await managedCreate).status(), 201);
    await page.waitForFunction(() => (
      [...document.querySelectorAll('[data-reorder-item] input[id^="manage-"]')].map(node => node.value).join("|")
      === "Chương mở đầu|Chương giữa|Chương kết"
      && document.activeElement?.value === "Chương giữa"
    ));

    stage = "managed chapter drag reorder";
    const managedReorder = page.waitForResponse(response => /\/chapters\/reorder$/.test(response.url()) && response.request().method() === "PATCH");
    await managedRows.nth(1).locator("[data-reorder-handle]").dragTo(managedRows.nth(0), {
      targetPosition: { x: 12, y: 2 },
    });
    assert.equal((await managedReorder).status(), 200);
    await page.waitForFunction(() => (
      [...document.querySelectorAll('[data-reorder-item] input[id^="manage-"]')].map(node => node.value).join("|")
      === "Chương giữa|Chương mở đầu|Chương kết"
    ));
    const managedSecondRowBox = await managedRows.nth(1).boundingBox();
    assert.ok(managedSecondRowBox);
    const restoreManagedOrder = page.waitForResponse(response => /\/chapters\/reorder$/.test(response.url()) && response.request().method() === "PATCH");
    await managedRows.nth(0).locator("[data-reorder-handle]").dragTo(managedRows.nth(1), {
      targetPosition: { x: 12, y: managedSecondRowBox.height - 2 },
    });
    assert.equal((await restoreManagedOrder).status(), 200);
    await page.waitForFunction(() => (
      [...document.querySelectorAll('[data-reorder-item] input[id^="manage-"]')].map(node => node.value).join("|")
      === "Chương mở đầu|Chương giữa|Chương kết"
    ));

    stage = "author editor and review submission";
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("link", { name: "Sửa nội dung", exact: true }).first().click();
    const addBlockAtEnd = page.getByRole("button", { name: "Thêm Đoạn Văn Mới", exact: true });
    const blockEditor = page.locator(".block-editor-container");
    const blockCards = blockEditor.locator(".block-card");
    const blockTextareas = blockCards.locator("textarea");
    await addBlockAtEnd.click();
    await page.waitForFunction(() => document.querySelectorAll(".block-editor-container .block-card").length === 1);
    await blockTextareas.nth(0).fill("Nội dung đầu tiên được lưu từ browser gate P3-10.");
    await addBlockAtEnd.click();
    await page.waitForFunction(() => document.querySelectorAll(".block-editor-container .block-card").length === 2);
    await blockTextareas.nth(1).fill("Nội dung thứ hai dùng để kiểm tra kéo thả block.");
    await addBlockAtEnd.click();
    await page.waitForFunction(() => document.querySelectorAll(".block-editor-container .block-card").length === 3);
    await blockTextareas.nth(2).fill("Nội dung thứ ba giữ ổn định khoảng chèn.");

    stage = "block editor drag gap stability";
    const blockGaps = blockEditor.locator("[data-reorder-gap]");
    assert.equal(await blockGaps.count(), 2);
    assert.equal(await blockGaps.getByRole("button").count(), 2);
    const idleGapHeights = await blockGaps.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
    const idleEditorHeight = await blockEditor.evaluate(node => node.getBoundingClientRect().height);
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await blockCards.nth(1).getByRole("button", { name: "Kéo thả block 2", exact: true }).dispatchEvent("mousedown", { button: 0 });
    await blockCards.nth(1).dispatchEvent("dragstart", { dataTransfer });
    await page.waitForFunction(() => (
      document.querySelectorAll(".block-editor-container [data-reorder-gap] button").length === 0
    ));
    const draggingGapHeights = await blockGaps.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
    const draggingEditorHeight = await blockEditor.evaluate(node => node.getBoundingClientRect().height);
    assert.equal(draggingGapHeights.length, idleGapHeights.length);
    idleGapHeights.forEach((height, index) => {
      assert.ok(Math.abs(draggingGapHeights[index] - height) <= 1, `Block gap ${index + 1} shifted while dragging`);
    });
    assert.ok(Math.abs(draggingEditorHeight - idleEditorHeight) <= 1, "Block editor height must remain stable while gap actions become drag placeholders");
    await blockCards.nth(1).dispatchEvent("dragend", { dataTransfer });
    await page.waitForFunction(() => (
      document.querySelectorAll(".block-editor-container [data-reorder-gap] button").length === 2
    ));
    await dataTransfer.dispose();

    stage = "block editor middle drag reorder";
    await blockCards.nth(1).getByRole("button", { name: "Kéo thả block 2", exact: true }).dragTo(blockCards.nth(0), {
      targetPosition: { x: 12, y: 2 },
    });
    await page.waitForFunction(() => (
      [...document.querySelectorAll(".block-editor-container .block-card textarea")].map(node => node.value).join("|")
      === "Nội dung thứ hai dùng để kiểm tra kéo thả block.|Nội dung đầu tiên được lưu từ browser gate P3-10.|Nội dung thứ ba giữ ổn định khoảng chèn."
    ));
    const secondBlockBox = await blockCards.nth(1).boundingBox();
    assert.ok(secondBlockBox);
    await blockCards.nth(0).getByRole("button", { name: "Kéo thả block 1", exact: true }).dragTo(blockCards.nth(1), {
      targetPosition: { x: 12, y: secondBlockBox.height - 2 },
    });
    await page.waitForFunction(() => (
      [...document.querySelectorAll(".block-editor-container .block-card textarea")].map(node => node.value).join("|")
      === "Nội dung đầu tiên được lưu từ browser gate P3-10.|Nội dung thứ hai dùng để kiểm tra kéo thả block.|Nội dung thứ ba giữ ổn định khoảng chèn."
    ));
    assert.equal(await blockGaps.getByRole("button").count(), 2, "Gap actions must remount after block drag completion");
    const [editorSave] = await Promise.all([
      page.waitForResponse(response => /\/editor$/.test(response.url()) && response.request().method() === "PUT"),
      page.getByRole("button", { name: "Lưu Thay Đổi", exact: true }).click(),
    ]);
    assert.equal(editorSave.status(), 200);
    await page.waitForFunction(() => Array.from(document.querySelectorAll("button")).some(button =>
      button.textContent?.includes("Lưu Thay Đổi") && button.disabled,
    ));
    assert.equal((await page.goto(`${origin}/author/stories/${storyId}`, { timeout: 60_000 })).status(), 200);
    const chapterSwitch = page.getByRole("switch", { name: "Publish Chương mở đầu", exact: true });
    const [publishChapterResponse] = await Promise.all([
      page.waitForResponse(response => response.url().endsWith("/publish") && response.request().method() === "PATCH"),
      chapterSwitch.click(),
    ]);
    assert.equal(publishChapterResponse.status(), 200);
    const publishedChapterSwitch = page.getByRole("switch", { name: "Gỡ publish Chương mở đầu", exact: true });
    assert.equal(await publishedChapterSwitch.getAttribute("aria-checked"), "true");
    await page.locator('section[aria-labelledby="story-chapters-title"]').screenshot({ path: resolve(artifacts, "chapter-list-published-desktop.png") });
    const submitButton = page.getByRole("button", { name: "Gửi duyệt", exact: true });
    await page.waitForTimeout(1_000);
    assert.equal(
      await submitButton.count(),
      1,
      `Missing submit at ${new URL(page.url()).pathname}: ${(await page.locator("body").innerText()).slice(0, 600)}`,
    );
    assert.equal(
      await submitButton.isEnabled(),
      true,
      `Submit button disabled: ${(await page.locator('[id^="submit-"][id$="-explanation"]').allTextContents()).join(" ")}`,
    );
    const [submitResponse] = await Promise.all([
      page.waitForResponse(response => response.url().endsWith(`/api/stories/${storyId}/submit-review`) && response.request().method() === "POST", { timeout: 60_000 }),
      submitButton.click(),
    ]);
    assert.equal(submitResponse.status(), 200);
    await page.getByText("Chờ duyệt", { exact: true }).first().waitFor();

    stage = "author dashboard, profile and ownership";
    await page.goto(`${origin}/author`);
    await page.getByRole("heading", { name: "Truyện của tôi", exact: true }).waitFor();
    await page.getByText("P3-10 browser story", { exact: true }).waitFor();
    const statusBadge = page.getByText("Chờ duyệt", { exact: true }).first();
    assert.equal(
      await statusBadge.evaluate(node => getComputedStyle(node).backgroundColor.startsWith("rgba(")
        ? !getComputedStyle(node).backgroundColor.endsWith(", 0)")
        : true),
      true,
      "Status badge on cover must render on an opaque surface",
    );
    await noOverflow(page, "Author dashboard at 375px");
    const menuTrigger = page.getByRole("button", { name: /Thêm hành động cho P3-10 browser story/ });
    await menuTrigger.click();
    const actionMenu = page.getByRole("menu");
    await actionMenu.waitFor();
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "menuitem");
    assert.equal(await actionMenu.getByRole("menuitem").first().evaluate(node => node === document.activeElement), true);
    await page.keyboard.press("Escape");
    assert.equal(await menuTrigger.evaluate(node => node === document.activeElement), true);

    const profileTrigger = page.getByRole("button", { name: "Mở hồ sơ cá nhân", exact: true });
    await profileTrigger.click();
    const profile = page.getByRole("dialog").filter({ hasText: "Tác giả" });
    await profile.waitFor();
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Đóng hồ sơ");
    assert.equal(await profile.getByRole("link", { name: /Truyện của tôi/ }).count(), 1);
    assert.equal(await profile.getByRole("button", { name: "Đóng hồ sơ", exact: true }).evaluate(node => node === document.activeElement), true);
    await page.keyboard.press("Escape");
    assert.equal(await profileTrigger.evaluate(node => node === document.activeElement), true);

    assert.equal((await author.request.get(`${origin}/author/stories/${outsiderStoryId}`)).status(), 404);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.reload();
    await noOverflow(page, "Author dashboard at 1440px");
    await page.screenshot({ path: resolve(artifacts, "author-dashboard-desktop.png") });
    await page.setViewportSize({ width: 375, height: 900 });
    await page.screenshot({ path: resolve(artifacts, "author-dashboard-mobile.png") });
    await author.close();

    stage = "admin landing";
    const admin = await browser.newContext({ viewport: { width: 375, height: 812 } });
    await admin.addCookies([{ name: "authjs.session-token", value: adminToken, url: origin, httpOnly: true, sameSite: "Lax" }]);
    const adminPage = await admin.newPage();
    watch(adminPage);
    assert.equal((await adminPage.goto(`${origin}/admin`)).status(), 200);
    await adminPage.getByRole("heading", { name: "Trang quản trị", exact: true }).waitFor();
    await noOverflow(adminPage, "Admin landing at 375px");
    await admin.close();

    assert.deepEqual(pageErrors, []);
    console.log("P3-10 browser smoke passed: auth focus, inert live StoryCard preview in dark/light/sepia, persistent cover crop and Home parity, shared middle/end chapter draft with validation and focus restoration, hover/focus gap disclosure, wizard/managed deletion focus, normalized chapter rename, chapter/block middle drag reorder with stable gaps, reader upload/promotion, stable published switch, editor/review, ownership, profile/menu keyboard, admin landing and 375/1440px layouts.");
  } catch (error) {
    console.error(`P3-10 browser smoke failed at ${stage}`);
    if (error instanceof assert.AssertionError) console.error(error.message);
    else console.error(error.name);
    console.error(error.stack?.split("\n").find(line => /p3-10-browser-smoke\.cjs:\d/.test(line))?.trim());
    throw error;
  } finally {
    await browser.close();
  }
};
