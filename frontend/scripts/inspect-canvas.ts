/**
 * Inspect canvas state and draw direct in browser
 */
import { chromium } from "playwright";
import path from "path";

const ARTIFACT_DIR = "C:\\Users\\alexc\\.gemini\\antigravity-ide\\brain\\494e1f14-65a8-4093-9062-5bdf6f901811";

async function inspectCanvas() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on("console", (msg) => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
  page.on("pageerror", (err) => console.log(`[Browser Error]: ${err.message}`));

  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const diag = await page.evaluate(async () => {
    const canvas = document.querySelector("canvas.scroll-frame-canvas") as HTMLCanvasElement;
    if (!canvas) return { error: "No canvas element found" };

    const ctx = canvas.getContext("2d");
    const debug = (window as any).__cakeToHomeDebug;

    // Test loading image 1 directly
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "https://res.cloudinary.com/r0k56n3j/image/upload/f_auto,q_auto/v1786881616/frames1_0001.jpg";

    await new Promise((res) => {
      if (img.complete) return res(true);
      img.onload = () => res(true);
      img.onerror = (e) => res(false);
    });

    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }

    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
      imgLoaded: img.complete,
      imgNaturalWidth: img.naturalWidth,
      imgNaturalHeight: img.naturalHeight,
      debugAvailable: !!debug,
      loadedCount: debug?.getLoadedCount?.(),
      hasFrame1: debug?.hasFrame?.(1),
    };
  });

  console.log("Canvas Diagnostic Output:", diag);

  const shot = path.join(ARTIFACT_DIR, "direct_draw_test.png");
  await page.screenshot({ path: shot });
  console.log(`Saved ${shot}`);

  await browser.close();
}

inspectCanvas().catch((e) => console.error(e));
