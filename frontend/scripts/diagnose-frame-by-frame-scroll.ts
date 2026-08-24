import { chromium, Browser, Page } from "playwright";

async function diagnoseFrameByFrame() {
  console.log("================================================================================");
  console.log("🔬 LIVE HOMEPAGE FRAME-BY-FRAME SCROLL & VISUAL SURFACE DIAGNOSTIC");
  console.log("================================================================================\n");

  const baseUrl = "http://localhost:3000";
  const browser: Browser = await chromium.launch({ headless: true });
  const page: Page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const networkRequests: { url: string; time: number }[] = [];
  page.on("request", (req) => {
    if (req.url().includes("unsplash.com") || req.url().includes("/images/") || req.url().includes("/frames/")) {
      networkRequests.push({ url: req.url(), time: Date.now() });
    }
  });

  console.log("1️⃣  Loading Homepage...");
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);

  const initialRequestsCount = networkRequests.length;
  console.log(`  • Initial asset requests on boot: ${initialRequestsCount}`);

  // 2. Measure section scroll metrics
  const metrics = await page.evaluate(() => {
    const el = document.querySelector(".scroll-frame-section") as HTMLElement;
    const sticky = document.querySelector(".scroll-frame-sticky") as HTMLElement;
    const cv = document.querySelector("canvas.scroll-frame-canvas") as HTMLCanvasElement;
    return {
      sectionHeight: el ? el.offsetHeight : 0,
      stickyHeight: sticky ? sticky.offsetHeight : 0,
      viewportHeight: window.innerHeight,
      scrollable: el ? el.offsetHeight - window.innerHeight : 0,
      canvasWidth: cv ? cv.width : 0,
      canvasHeight: cv ? cv.height : 0,
      hasCanvas: !!cv,
    };
  });

  console.log(`\n2️⃣  Story & Viewport Metrics:`);
  console.log(`  • Section Height: ${metrics.sectionHeight}px`);
  console.log(`  • Viewport Height: ${metrics.viewportHeight}px`);
  console.log(`  • Scrollable Track Distance: ${metrics.scrollable}px`);
  console.log(`  • Canvas Buffer Resolution: ${metrics.canvasWidth}x${metrics.canvasHeight}`);

  // 3. Human-Scale Incremental Scroll: Step by 15px from 0 to scrollable
  console.log(`\n3️⃣  Executing Human-Scale Incremental Scroll (15px steps across ${metrics.scrollable}px)...`);

  let blankFrames = 0;
  let totalTicks = 0;
  let prevSample = "";
  let frameChanges = 0;

  const requestCountBeforeScroll = networkRequests.length;

  for (let scrollY = 0; scrollY <= metrics.scrollable; scrollY += 15) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(20); // simulate 50 FPS human scroll cadence
    totalTicks++;

    const tickInfo = await page.evaluate(() => {
      const cv = document.querySelector("canvas.scroll-frame-canvas") as HTMLCanvasElement;
      if (!cv) return { isBlank: true, sample: "", stickyTop: -1 };
      const ctx = cv.getContext("2d");
      if (!ctx || cv.width === 0 || cv.height === 0) return { isBlank: true, sample: "", stickyTop: -1 };

      const p = ctx.getImageData(Math.floor(cv.width / 2), Math.floor(cv.height / 2), 1, 1).data;
      const sticky = document.querySelector(".scroll-frame-sticky");
      const stickyTop = sticky ? sticky.getBoundingClientRect().top : -1;

      // Blank if alpha is 0 or all zeros
      const isBlank = p[3] === 0 || (p[0] === 0 && p[1] === 0 && p[2] === 0 && p[3] === 0);
      return {
        isBlank,
        sample: `${p[0]},${p[1]},${p[2]},${p[3]}`,
        stickyTop,
      };
    });

    if (tickInfo.isBlank) blankFrames++;
    if (tickInfo.sample !== prevSample) {
      frameChanges++;
      prevSample = tickInfo.sample;
    }
  }

  const requestCountAfterScroll = networkRequests.length;
  const requestsDuringScroll = requestCountAfterScroll - requestCountBeforeScroll;

  console.log(`\n4️⃣  Audit Results:`);
  console.log(`  • Total Scroll Ticks Sampled: ${totalTicks}`);
  console.log(`  • Frame Transitions Detected: ${frameChanges}`);
  console.log(`  • Blank / Transparent / Zero-Alpha Frames: ${blankFrames}`);
  console.log(`  • New Network Requests During Active Scroll: ${requestsDuringScroll}`);

  await browser.close();

  console.log("\n================================================================================");
  console.log(blankFrames === 0 && requestsDuringScroll === 0 ? "✅ DIAGNOSTIC PASSED" : "⚠️ DIAGNOSTIC DETECTED ISSUES");
  console.log("================================================================================");
}

diagnoseFrameByFrame().catch(console.error);
