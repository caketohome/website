import { chromium, Browser, Page } from "playwright";
import fs from "fs";
import path from "path";

async function runVisualDiffTest() {
  console.log("\n" + "=".repeat(80));
  console.log("📸 CAKETOHOME — VISUAL FRAME CAPTURE & DIFFERENCE PROOF AUDIT");
  console.log("=".repeat(80) + "\n");

  const baseUrl = "http://localhost:3000";
  const artifactsDir = path.join(__dirname, "../test-artifacts/scroll-hero");
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page: Page = await context.newPage();

  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  const sectionMetrics = await page.evaluate(() => {
    const el = document.querySelector(".scroll-frame-section");
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      height: rect.height,
      scrollable: rect.height - window.innerHeight,
    };
  });

  if (!sectionMetrics) throw new Error("Scroll section not found");

  const points = [
    { name: "00_pct", y: sectionMetrics.top },
    { name: "25_pct", y: sectionMetrics.top + sectionMetrics.scrollable * 0.25 },
    { name: "50_pct", y: sectionMetrics.top + sectionMetrics.scrollable * 0.50 },
    { name: "75_pct", y: sectionMetrics.top + sectionMetrics.scrollable * 0.75 },
    { name: "100_pct", y: sectionMetrics.top + sectionMetrics.scrollable },
  ];

  const bufferSizes: Record<string, number> = {};
  const canvasSnapshots: string[] = [];

  for (const pt of points) {
    await page.evaluate((targetY) => window.scrollTo({ top: targetY, behavior: "instant" }), pt.y);
    await page.waitForTimeout(400);

    const canvas = page.locator("canvas.scroll-frame-canvas").first();
    const screenshotPath = path.join(artifactsDir, `hero_${pt.name}.png`);
    await canvas.screenshot({ path: screenshotPath });

    const stats = fs.statSync(screenshotPath);
    bufferSizes[pt.name] = stats.size;

    // Get canvas data url hash
    const dataUrl = await page.evaluate(() => {
      const c = document.querySelector("canvas.scroll-frame-canvas") as HTMLCanvasElement;
      return c ? c.toDataURL("image/webp", 0.5) : "";
    });
    canvasSnapshots.push(dataUrl);

    console.log(`  📸 Captured ${pt.name} -> ${screenshotPath} (${stats.size} bytes)`);
  }

  await browser.close();

  const buf0 = fs.readFileSync(path.join(artifactsDir, "hero_00_pct.png"));
  const buf25 = fs.readFileSync(path.join(artifactsDir, "hero_25_pct.png"));
  const buf50 = fs.readFileSync(path.join(artifactsDir, "hero_50_pct.png"));
  const buf75 = fs.readFileSync(path.join(artifactsDir, "hero_75_pct.png"));
  const buf100 = fs.readFileSync(path.join(artifactsDir, "hero_100_pct.png"));

  const is0DiffFrom50 = Buffer.compare(buf0, buf50) !== 0;
  const is50DiffFrom100 = Buffer.compare(buf50, buf100) !== 0;
  const is0DiffFrom25 = Buffer.compare(buf0, buf25) !== 0;
  const is75DiffFrom100 = Buffer.compare(buf75, buf100) !== 0;

  console.log(`\n  • Visual difference (0% vs 25%): ${is0DiffFrom25 ? "✅ DIFFERENT FRAMES CONFIRMED" : "❌ IDENTICAL"}`);
  console.log(`  • Visual difference (0% vs 50%): ${is0DiffFrom50 ? "✅ DIFFERENT FRAMES CONFIRMED" : "❌ IDENTICAL"}`);
  console.log(`  • Visual difference (50% vs 100%): ${is50DiffFrom100 ? "✅ DIFFERENT FRAMES CONFIRMED" : "❌ IDENTICAL"}`);
  console.log(`  • Visual difference (75% vs 100%): ${is75DiffFrom100 ? "✅ DIFFERENT FRAMES CONFIRMED" : "❌ IDENTICAL"}`);

  if (!is0DiffFrom50 || !is50DiffFrom100 || !is0DiffFrom25 || !is75DiffFrom100) {
    throw new Error("Visual frame capture failed to detect frame changes across scroll range!");
  }

  console.log("\n" + "=".repeat(80));
  console.log("🎯 VISUAL PROGRESSION & FRAME VARIATION PROVEN ACROSS SCROLL RANGE (100% PASS)");
  console.log("=".repeat(80) + "\n");
}

runVisualDiffTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
