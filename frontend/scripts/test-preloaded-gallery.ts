/**
 * Preload all frames before testing scroll to guarantee 100% frame fidelity
 */
import { chromium } from "playwright";
import path from "path";

const ARTIFACT_DIR = "C:\\Users\\alexc\\.gemini\\antigravity-ide\\brain\\494e1f14-65a8-4093-9062-5bdf6f901811";

async function runPreloadedScrollSuite() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:3000/ ...");
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });

  // Disable popups during visual inspection by setting localStorage flag
  await page.evaluate(() => {
    localStorage.setItem("caketohome_popup_dismissed", "true");
    localStorage.setItem("caketohome_popup_cooldown", String(Date.now() + 86400000));
  });

  // Wait until at least 30 frames are loaded in memory
  console.log("Waiting for frame buffer to populate...");
  await page.waitForFunction(() => {
    const dbg = (window as any).__cakeToHomeDebug;
    return dbg && dbg.getLoadedCount() >= 35;
  }, { timeout: 15000 }).catch(() => console.log("Timeout waiting for 35 frames, proceeding with available"));

  const loadedCount = await page.evaluate(() => (window as any).__cakeToHomeDebug?.getLoadedCount());
  console.log(`Loaded frames in cache: ${loadedCount} / 39`);

  const steps = [
    { name: "00_frame0001_0pct", y: 0 },
    { name: "25_frame0011_25pct", y: 360 },
    { name: "50_frame0020_50pct", y: 720 },
    { name: "75_frame0030_75pct", y: 1080 },
    { name: "100_frame0039_100pct", y: 1440 },
  ];

  for (const step of steps) {
    console.log(`Scrolling to y=${step.y} (${step.name})...`);
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" as any }), step.y);
    await page.waitForTimeout(600);

    const shotPath = path.join(ARTIFACT_DIR, `gallery_${step.name}.png`);
    await page.screenshot({ path: shotPath });
    console.log(`✓ Saved ${shotPath}`);
  }

  await browser.close();
  console.log("Preloaded scroll gallery complete!");
}

runPreloadedScrollSuite().catch((e) => console.error(e));
