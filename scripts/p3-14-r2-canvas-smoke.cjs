/* eslint-disable @typescript-eslint/no-require-imports */
const { resolve } = require("node:path");

exports.readCrossOriginCanvasPixel = async function ({
  appOrigin,
  imageUrl,
  playwrightModule,
  browserChannel = "msedge",
}) {
  const { chromium } = require(resolve(playwrightModule));
  const browser = await chromium.launch({ channel: browserChannel, headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const harnessUrl = `${appOrigin}/__p3-14-r2-canvas-smoke`;
    await page.route(harnessUrl, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: "<!doctype html><html><body>R2 canvas smoke</body></html>",
      });
    });
    await page.goto(harnessUrl);
    return await page.evaluate(async (url) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      await new Promise((resolveImage, rejectImage) => {
        image.onload = resolveImage;
        image.onerror = () => rejectImage(new Error("CROSS_ORIGIN_IMAGE_DECODE_FAILED"));
        image.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context2d = canvas.getContext("2d", { willReadFrequently: true });
      if (!context2d) throw new Error("CANVAS_2D_UNAVAILABLE");
      context2d.drawImage(image, 0, 0, 1, 1);
      return Array.from(context2d.getImageData(0, 0, 1, 1).data);
    }, imageUrl);
  } finally {
    await browser.close();
  }
};
