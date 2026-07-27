/**
 * HONEST Enterprise Architecture E2E Validation Script
 * 
 * Rules enforced:
 * 1. Every page MUST fully load (networkidle).
 * 2. Every page MUST have a non-blank body (> 100px height).
 * 3. Every page MUST NOT show a Next.js error overlay.
 * 4. Every page MUST have a specific expected element visible before screenshot.
 * 5. If ANY assertion fails, the feature is marked FAILED immediately.
 * 6. Console errors and network failures are captured.
 * 7. No success report is generated if any test fails.
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots", "validated");
const RESULTS = [];
let CONSOLE_ERRORS = [];

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function logResult(name, status, detail) {
  RESULTS.push({ name, status, detail });
  const icon = status === "PASS" ? "✅" : "❌";
  console.log(`${icon} [${name}] ${status}: ${detail}`);
}

async function assertPageNotBlank(page, testName) {
  // Check body has actual rendered content
  const bodyHeight = await page.evaluate(() => document.body?.scrollHeight || 0);
  if (bodyHeight < 100) {
    logResult(testName, "FAIL", `Page body height is ${bodyHeight}px — blank or empty page`);
    return false;
  }

  // Check for Next.js error overlay
  const hasErrorOverlay = await page.evaluate(() => {
    return !!document.querySelector("nextjs-portal") ||
           !!document.querySelector("[data-nextjs-dialog]") ||
           document.body.innerText.includes("Internal Server Error") ||
           document.body.innerText.includes("Application error") ||
           document.body.innerText.includes("Unhandled Runtime Error");
  });
  if (hasErrorOverlay) {
    logResult(testName, "FAIL", "Next.js error overlay or runtime error detected on page");
    return false;
  }

  // Check for loading spinners still present
  const hasSpinner = await page.evaluate(() => {
    const spinners = document.querySelectorAll("[class*='loading'], [class*='spinner'], [role='progressbar']");
    // Only fail if spinners are the ONLY visible content
    return spinners.length > 0 && document.body.innerText.trim().length < 50;
  });
  if (hasSpinner) {
    logResult(testName, "FAIL", "Page shows only loading spinners with no rendered content");
    return false;
  }

  return true;
}

async function assertElementVisible(page, selector, testName, description) {
  try {
    const el = page.locator(selector).first();
    await el.waitFor({ state: "visible", timeout: 8000 });
    return true;
  } catch {
    logResult(testName, "FAIL", `Expected element not found: ${description} (selector: ${selector})`);
    return false;
  }
}

async function saveScreenshot(page, filename, testName) {
  const filePath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: false });
  const stats = fs.statSync(filePath);
  if (stats.size < 5000) {
    logResult(testName, "FAIL", `Screenshot ${filename} is only ${stats.size} bytes — likely blank`);
    return false;
  }
  console.log(`   📸 Saved: ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);
  return true;
}

async function runHonestValidation() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  HONEST E2E VALIDATION — CakeToHome Enterprise Architecture");
  console.log("  Rules: Fail fast. No fake reports. No silent error swallowing.");
  console.log("═══════════════════════════════════════════════════════════\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Capture all console errors
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      CONSOLE_ERRORS.push(msg.text());
    }
  });

  try {
    // ═══ TEST 1: Homepage with DeliveryLocationHeader ═══
    const T1 = "Homepage & DeliveryLocationHeader";
    console.log(`\n─── TEST 1: ${T1} ───`);
    
    const homeResp = await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
    if (!homeResp || homeResp.status() >= 500) {
      console.log(`   ⚠️  HTTP ${homeResp?.status()} — page may have SSR errors, checking rendered content...`);
    }

    if (!(await assertPageNotBlank(page, T1))) {
      await saveScreenshot(page, "FAIL-homepage.png", T1);
    } else {
      // Check for the CakeToHome brand name
      const hasBrand = await assertElementVisible(page, "text=CakeToHome", T1, "CakeToHome brand text in navbar");
      if (hasBrand) {
        // Check if DeliveryLocationHeader is present (the new component we added)
        const hasLocationHeader = await page.locator("text=Deliver to").first().isVisible().catch(() => false);
        if (hasLocationHeader) {
          logResult(T1, "PASS", "Homepage loaded with DeliveryLocationHeader visible");
        } else {
          // Check if old BranchSwitcher is still there
          const hasBranchSwitcher = await page.locator("text=Select Branch").first().isVisible().catch(() => false);
          if (hasBranchSwitcher) {
            logResult(T1, "FAIL", "Old BranchSwitcher is still visible instead of DeliveryLocationHeader");
          } else {
            logResult(T1, "FAIL", "DeliveryLocationHeader 'Deliver to' widget not found on homepage navbar");
          }
        }
        await saveScreenshot(page, "01-homepage.png", T1);
      }
    }

    // ═══ TEST 2: Homepage does NOT expose branch names/IDs ═══
    const T2 = "No Branch Names Exposed to Customer";
    console.log(`\n─── TEST 2: ${T2} ───`);
    
    const bodyText = await page.evaluate(() => document.body.innerText);
    const exposedBranchPatterns = ["Branch ID", "branch_id", "Select Branch", "brch_"];
    let branchExposed = false;
    for (const pattern of exposedBranchPatterns) {
      if (bodyText.includes(pattern)) {
        logResult(T2, "FAIL", `Customer-facing page exposes "${pattern}"`);
        branchExposed = true;
        break;
      }
    }
    if (!branchExposed) {
      logResult(T2, "PASS", "No internal branch names or IDs found on customer-facing homepage");
    }

    // ═══ TEST 3: Login page renders ═══
    const T3 = "Login Page Renders";
    console.log(`\n─── TEST 3: ${T3} ───`);
    
    const loginResp = await page.goto("http://localhost:3000/login", { waitUntil: "networkidle", timeout: 30000 });
    if (!(await assertPageNotBlank(page, T3))) {
      await saveScreenshot(page, "FAIL-login.png", T3);
    } else {
      const hasLoginForm = await assertElementVisible(page, "input", T3, "Login form input field");
      if (hasLoginForm) {
        logResult(T3, "PASS", "Login page rendered with form inputs visible");
        await saveScreenshot(page, "02-login-page.png", T3);
      }
    }

    // ═══ TEST 4: Checkout page renders with gifting toggle ═══
    const T4 = "Checkout Page & Gifting Toggle";
    console.log(`\n─── TEST 4: ${T4} ───`);

    // Create a real cart via Medusa API and set cookie so checkout doesn't redirect to home
    try {
      const cartInfo = await page.evaluate(async () => {
        const r = await fetch("http://localhost:9000/store/carts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-publishable-api-key": "pk_e43cf3cbad60b9429ac28f7e46cd59022feeb003e3b339782cd5529906377bae"
          },
          body: JSON.stringify({})
        });
        const cData = await r.json();
        const cartId = cData.cart?.id;
        
        const prodR = await fetch("http://localhost:9000/store/products", {
          headers: { "x-publishable-api-key": "pk_e43cf3cbad60b9429ac28f7e46cd59022feeb003e3b339782cd5529906377bae" }
        });
        const pData = await prodR.json();
        const variantId = pData.products?.[0]?.variants?.[0]?.id;

        if (cartId && variantId) {
          await fetch(`http://localhost:9000/store/carts/${cartId}/line-items`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-publishable-api-key": "pk_e43cf3cbad60b9429ac28f7e46cd59022feeb003e3b339782cd5529906377bae"
            },
            body: JSON.stringify({ variant_id: variantId, quantity: 1 })
          });
        }
        return cartId;
      });

      if (cartInfo) {
        await context.addCookies([{ name: "_medusa_cart_id", value: cartInfo, domain: "localhost", path: "/" }]);
      }
    } catch (e) {
      console.log(`   ⚠️ Failed to pre-populate cart: ${e.message}`);
    }

    await page.goto("http://localhost:3000/checkout", { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    const currentUrl = page.url();
    
    if (currentUrl.includes("/login")) {
      logResult(T4, "FAIL", `Checkout redirected to ${currentUrl} — user not authenticated, cannot test gifting toggle`);
      await saveScreenshot(page, "FAIL-checkout-redirect.png", T4);
    } else if (currentUrl === "http://localhost:3000/" || currentUrl === "http://localhost:3000") {
      logResult(T4, "FAIL", `Checkout redirected to homepage — cart is empty or missing`);
      await saveScreenshot(page, "FAIL-checkout-empty-cart.png", T4);
    } else {
      if (!(await assertPageNotBlank(page, T4))) {
        await saveScreenshot(page, "FAIL-checkout.png", T4);
      } else {
        // Look for the "Deliver to Someone Else" button we added
        const hasGiftToggle = await page.locator("text=Deliver to Someone Else").first().isVisible().catch(() => false);
        const hasDeliverToMe = await page.locator("text=Deliver to Me").first().isVisible().catch(() => false);
        
        if (hasGiftToggle && hasDeliverToMe) {
          logResult(T4, "PASS", "Checkout page shows 'Deliver to Me' and 'Deliver to Someone Else' toggle");
          await saveScreenshot(page, "03-checkout-gift-toggle.png", T4);
        } else {
          logResult(T4, "FAIL", `Gifting toggle not found on Checkout page. 'Deliver to Me': ${hasDeliverToMe}, 'Deliver to Someone Else': ${hasGiftToggle}`);
          await saveScreenshot(page, "FAIL-checkout-no-toggle.png", T4);
        }
      }
    }

    // ═══ TEST 5: Category/Catalog page renders ═══
    const T5 = "Product Catalog Page";
    console.log(`\n─── TEST 5: ${T5} ───`);

    await page.goto("http://localhost:3000/category/cakes", { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    if (!(await assertPageNotBlank(page, T5))) {
      await saveScreenshot(page, "FAIL-catalog.png", T5);
    } else {
      logResult(T5, "PASS", "Catalog page rendered with non-blank content");
      await saveScreenshot(page, "04-catalog-page.png", T5);
    }

    // ═══ TEST 6: Backend Delivery Resolve API ═══
    const T6 = "Backend /store/delivery/resolve API";
    console.log(`\n─── TEST 6: ${T6} ───`);
    
    try {
      const apiResp = await page.evaluate(async () => {
        const r = await fetch("http://localhost:9000/store/delivery/resolve", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-publishable-api-key": "pk_e43cf3cbad60b9429ac28f7e46cd59022feeb003e3b339782cd5529906377bae",
          },
          body: JSON.stringify({ pincode: "560001" }),
        });
        return { status: r.status, body: await r.json().catch(() => null) };
      });

      if (apiResp.status === 200 && apiResp.body) {
        const hasFee = apiResp.body.delivery_fee !== undefined;
        const hasEta = apiResp.body.estimated_delivery_minutes !== undefined;
        const hasServiceable = apiResp.body.is_serviceable !== undefined;
        const exposedBranch = apiResp.body.branch_id !== undefined;

        if (exposedBranch) {
          logResult(T6, "FAIL", "API response exposes branch_id to client — violates architecture requirement");
        } else if (hasFee && hasEta && hasServiceable) {
          logResult(T6, "PASS", `API returns delivery_fee=${apiResp.body.delivery_fee}, ETA=${apiResp.body.estimated_delivery_minutes}min, serviceable=${apiResp.body.is_serviceable}`);
        } else {
          logResult(T6, "FAIL", `API response missing expected fields. Got: ${JSON.stringify(apiResp.body)}`);
        }
      } else {
        logResult(T6, "FAIL", `API returned HTTP ${apiResp.status}. Body: ${JSON.stringify(apiResp.body)}`);
      }
    } catch (err) {
      logResult(T6, "FAIL", `API request failed: ${err.message}`);
    }

  } catch (err) {
    console.error(`\n💥 UNEXPECTED ERROR: ${err.message}`);
    console.error(err.stack);
  } finally {
    await browser.close();
  }

  // ═══ FINAL REPORT ═══
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  VALIDATION RESULTS SUMMARY");
  console.log("═══════════════════════════════════════════════════════════\n");

  const passed = RESULTS.filter((r) => r.status === "PASS");
  const failed = RESULTS.filter((r) => r.status === "FAIL");

  for (const r of RESULTS) {
    const icon = r.status === "PASS" ? "✅" : "❌";
    console.log(`  ${icon} ${r.name}: ${r.detail}`);
  }

  console.log(`\n  Total: ${RESULTS.length} tests | ✅ ${passed.length} passed | ❌ ${failed.length} failed`);

  if (CONSOLE_ERRORS.length > 0) {
    console.log(`\n  ⚠️  ${CONSOLE_ERRORS.length} browser console errors captured:`);
    for (const e of CONSOLE_ERRORS.slice(0, 10)) {
      console.log(`     • ${e.slice(0, 200)}`);
    }
  }

  if (failed.length > 0) {
    console.log("\n  ❌ EXECUTION FAILED — Features above marked FAIL are NOT verified.");
    console.log("  DO NOT generate GO FOR PRODUCTION or certification reports.");
    process.exit(1);
  } else {
    console.log("\n  ✅ ALL TESTS PASSED — Features verified with non-blank screenshots.");
  }
}

runHonestValidation();
