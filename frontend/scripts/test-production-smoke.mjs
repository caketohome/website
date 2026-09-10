import { spawn } from "child_process";
import http from "http";
import path from "path";
import { chromium } from "playwright";

const FRONTEND_DIR = path.resolve("e:/vig/cakes2home-main/cakes2home-main/frontend");
const PORT = 3006;
const BASE_URL = `http://localhost:${PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(maxAttempts = 50) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await new Promise((resolve, reject) => {
        const req = http.get(BASE_URL, (res) => resolve(res));
        req.on("error", reject);
        req.setTimeout(4000, () => {
          req.destroy();
          reject(new Error("Timeout"));
        });
      });
      if (res.statusCode) return true;
    } catch (e) {
      await sleep(1000);
    }
  }
  return false;
}

async function main() {
  console.log("==================================================");
  console.log("PRODUCTION SERVER ARTIFACT INTEGRITY VERIFICATION");
  console.log("==================================================");

  console.log(`Starting Next.js Production Server on port ${PORT}...`);
  const server = spawn("cmd.exe", ["/c", `npx next start -p ${PORT}`], {
    cwd: FRONTEND_DIR,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", (d) => console.log(`[Next.js stdout]: ${d.toString().trim()}`));
  server.stderr.on("data", (d) => console.error(`[Next.js stderr]: ${d.toString().trim()}`));

  console.log("Waiting for production server to be ready...");
  const isReady = await waitForServer(30);
  if (!isReady) {
    console.error("FATAL: Production server failed to start on port " + PORT);
    server.kill();
    process.exit(1);
  }
  console.log("Production server is LIVE on " + BASE_URL);

  const routes = [
    { path: "/", name: "Storefront Home", expectStatus: [200] },
    { path: "/products", name: "Products Catalog", expectStatus: [200] },
    { path: "/products/classic-chocolate-truffle-cake", name: "Product PDP", expectStatus: [200] },
    { path: "/login", name: "Login Page", expectStatus: [200] },
    { path: "/dashboard", name: "Dashboard (Protected)", expectStatus: [200, 307, 308] },
    { path: "/dashboard/shop", name: "PIM / Shop", expectStatus: [200, 307, 308] },
    { path: "/checkout", name: "Checkout", expectStatus: [200] },
    { path: "/api/v1/products", name: "API Products", expectStatus: [200] },
  ];

  console.log("\n1. Testing HTTP & HTML Artifacts...");
  const httpResults = [];
  for (const r of routes) {
    const start = Date.now();
    try {
      const res = await fetch(`${BASE_URL}${r.path}`, { redirect: "manual" });
      const duration = Date.now() - start;
      const text = await res.text();
      const statusOk = r.expectStatus.includes(res.status);
      const hasHtml = text.includes("<html") || text.includes("<body") || text.startsWith("{");
      const hasChunks = text.includes("/_next/static/chunks/") || text.startsWith("{");

      console.log(`  ${r.name} (${r.path}): Status ${res.status} [${duration}ms] | HTML: ${hasHtml} | Chunks: ${hasChunks}`);
      httpResults.push({ ...r, status: res.status, statusOk, duration, hasHtml, hasChunks });
    } catch (err) {
      console.error(`  ${r.name} (${r.path}) FAILED:`, err.message);
      httpResults.push({ ...r, status: 0, statusOk: false, error: err.message });
    }
  }

  console.log("\n2. Launching Headless Chromium for Real-Browser QA & Hydration...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const browserResults = [];
  for (const r of routes.filter(r => !r.path.startsWith("/api"))) {
    const consoleErrors = [];
    const failedRequests = [];

    const onConsole = (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    };
    const onRequestFailed = (req) => {
      failedRequests.push(`${req.url()} (${req.failure()?.errorText})`);
    };

    page.on("console", onConsole);
    page.on("requestfailed", onRequestFailed);

    console.log(`\n  Navigating to ${r.name} (${BASE_URL}${r.path})...`);
    try {
      const resp = await page.goto(`${BASE_URL}${r.path}`, { waitUntil: "domcontentloaded", timeout: 15000 });
      await sleep(1500); // Allow React hydration and micro-tasks to settle

      const finalUrl = page.url();
      const title = await page.title();
      
      // Filter critical 404 chunks
      const chunk404s = failedRequests.filter(url => url.includes("/_next/static/chunks/"));

      console.log(`    Loaded: Status ${resp?.status()} | Final URL: ${finalUrl}`);
      console.log(`    Title: "${title}"`);
      console.log(`    Console Errors: ${consoleErrors.length}`);
      console.log(`    Failed Requests: ${failedRequests.length} (404 Chunks: ${chunk404s.length})`);

      browserResults.push({
        route: r.path,
        name: r.name,
        status: resp?.status(),
        consoleErrors,
        failedRequests,
        chunk404s,
        success: chunk404s.length === 0,
      });
    } catch (e) {
      console.error(`    Browser navigation error on ${r.path}:`, e.message);
      browserResults.push({
        route: r.path,
        name: r.name,
        error: e.message,
        success: false,
      });
    } finally {
      page.off("console", onConsole);
      page.off("requestfailed", onRequestFailed);
    }
  }

  await browser.close();

  console.log("\nShutting down production server...");
  server.kill();

  console.log("\n==================================================");
  console.log("PRODUCTION ARTIFACT INTEGRITY VERIFICATION SUMMARY");
  console.log("==================================================");
  const allHttpPass = httpResults.every(r => r.statusOk);
  const allBrowserPass = browserResults.every(r => r.success);

  console.log(`HTTP/HTML Integrity Pass: ${allHttpPass}`);
  console.log(`Real Browser QA Pass:     ${allBrowserPass}`);
  console.log("==================================================");

  process.exit(allHttpPass && allBrowserPass ? 0 : 1);
}

main().catch((err) => {
  console.error("Integrity test runner encountered fatal error:", err);
  process.exit(1);
});
