import { chromium } from "playwright";

async function runReproductionDiagnosis() {
  console.log("===============================================================");
  console.log("🔍 PHASE 1: REPRODUCE CHUNKLOADERROR & BRANCH POST FAILURES");
  console.log("===============================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  await context.addCookies([
    { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
    { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
    { name: "_cth_jwt", value: "mock_admin_jwt_token_super_admin_2026", domain: "localhost", path: "/" },
  ]);

  const page = await context.newPage();

  const consoleLogs: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: Array<{ url: string; status: number; method: string }> = [];

  page.on("console", (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on("pageerror", (err) => {
    pageErrors.push(err.message + "\n" + (err.stack || ""));
  });

  page.on("response", (res) => {
    if (res.status() >= 400) {
      failedRequests.push({ url: res.url(), status: res.status(), method: res.request().method() });
    }
  });

  // ── TEST A: Open Settings Panel (?tab=settings) ──
  console.log("Testing A: GET http://localhost:3000/dashboard?tab=settings...");
  try {
    const resA = await page.goto("http://localhost:3000/dashboard?tab=settings", { waitUntil: "networkidle", timeout: 15000 });
    console.log(`  Page Response Status: ${resA?.status()}`);
    await page.waitForTimeout(2000);
  } catch (err: any) {
    console.log(`  Navigation Error on settings: ${err.message}`);
  }

  console.log("\n--- Settings Tab Page Errors ---");
  if (pageErrors.length === 0) {
    console.log("  None recorded by pageerror listener");
  } else {
    pageErrors.forEach((e) => console.log(`  ❌ ${e}`));
  }

  console.log("\n--- Settings Tab Failed Network Requests (>= 400) ---");
  if (failedRequests.length === 0) {
    console.log("  None recorded");
  } else {
    failedRequests.forEach((r) => console.log(`  ❌ [${r.method}] ${r.url} -> HTTP ${r.status}`));
  }

  // ── TEST B: Open Branches Panel (?tab=branches) ──
  console.log("\nTesting B: GET http://localhost:3000/dashboard?tab=branches...");
  const errorsB: string[] = [];
  const failedB: Array<{ url: string; status: number; method: string }> = [];
  page.on("pageerror", (err) => errorsB.push(err.message));
  page.on("response", (res) => {
    if (res.status() >= 400) failedB.push({ url: res.url(), status: res.status(), method: res.request().method() });
  });

  try {
    const resB = await page.goto("http://localhost:3000/dashboard?tab=branches", { waitUntil: "networkidle", timeout: 15000 });
    console.log(`  Page Response Status: ${resB?.status()}`);
    await page.waitForTimeout(2000);
  } catch (err: any) {
    console.log(`  Navigation Error on branches: ${err.message}`);
  }

  // ── TEST C: POST /api/v1/admin/branches Direct Probe ──
  console.log("\nTesting C: Direct POST http://localhost:3000/api/v1/admin/branches probe...");
  try {
    const postRes = await fetch("http://localhost:3000/api/v1/admin/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: `HUB-PROBE-${Date.now().toString().slice(-4)}`,
        name: "Probe Hub",
        city: "Bengaluru",
        pincode: "560038",
      }),
    });
    console.log(`  POST /api/v1/admin/branches -> Status: HTTP ${postRes.status}`);
    const postBody = await postRes.text();
    console.log(`  POST Response Body: ${postBody.slice(0, 300)}`);
  } catch (err: any) {
    console.log(`  POST Probe Error: ${err.message}`);
  }

  await browser.close();
}

runReproductionDiagnosis();
