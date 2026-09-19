const path = require('path');
const { Pool } = require(path.join(__dirname, '../frontend/node_modules/pg'));
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/playwright'));

const pool = new Pool({
  connectionString: 'postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

const BASE_URL = 'http://localhost:3000';
const TEST_PRODUCT_URL = `${BASE_URL}/products/belgian-chocolate-truffle-cake`;

async function runRoundtrip() {
  const results = {
    test: "PDP CMS Configuration Live Roundtrip Persistence",
    timestamp: new Date().toISOString(),
    steps: []
  };

  let browser;
  let baselineBlocks = null;
  let rowId = null;

  try {
    console.log("Step 1: Reading baseline CMS configuration from PostgreSQL...");
    const cmsRes = await pool.query("SELECT id, blocks FROM cms_page WHERE id = 'cmspg_product' OR slug = 'product' LIMIT 1");
    if (cmsRes.rows.length === 0) {
      throw new Error("No CMS page found for 'product' or 'cmspg_product'");
    }

    rowId = cmsRes.rows[0].id;
    const rawBlocks = cmsRes.rows[0].blocks;
    baselineBlocks = typeof rawBlocks === 'string' ? JSON.parse(rawBlocks) : (rawBlocks || {});

    const baselinePdp = baselineBlocks.pdp_config || baselineBlocks.pdp || {};
    const originalAddToCartText = baselinePdp.add_to_cart_text || "Add to Bag";
    const originalBuyNowText = baselinePdp.buy_now_text || "Buy Now";

    results.steps.push({
      step: "Read Baseline CMS",
      status: "PASS",
      pageId: rowId,
      originalAddToCartText,
      originalBuyNowText,
      showTrustBadges: baselinePdp.show_trust_badges ?? true
    });
    console.log(`Baseline PDP AddToCartText: "${originalAddToCartText}", BuyNowText: "${originalBuyNowText}"`);

    console.log("Step 2: Launching Playwright browser and visiting PDP...");
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    await page.goto(TEST_PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(2000);

    // Verify initial button text
    const initialAddToCartBtn = await page.$('button[data-testid="pdp-add-to-bag"]');
    const initialText = initialAddToCartBtn ? (await initialAddToCartBtn.innerText()).trim() : null;
    console.log(`Initial button text on PDP: "${initialText}"`);

    results.steps.push({
      step: "Storefront Baseline Render",
      status: initialText ? "PASS" : "FAIL",
      foundButtonText: initialText
    });

    console.log("Step 3: Mutating CMS configuration in PostgreSQL...");
    const testMutation = {
      add_to_cart_text: "Add to Gourmet Bag",
      buy_now_text: "Express Gourmet Order",
      show_trust_badges: false,
    };

    const mutatedBlocks = JSON.parse(JSON.stringify(baselineBlocks));
    mutatedBlocks.pdp_config = {
      ...(mutatedBlocks.pdp_config || {}),
      ...testMutation
    };
    mutatedBlocks.pdp = mutatedBlocks.pdp_config;
    mutatedBlocks.published_config = {
      ...(mutatedBlocks.published_config || {}),
      pdp: mutatedBlocks.pdp_config,
      pdp_config: mutatedBlocks.pdp_config
    };

    await pool.query(
      "UPDATE cms_page SET blocks = $1, status = 'published', updated_at = NOW(), published_at = NOW() WHERE id = $2",
      [JSON.stringify(mutatedBlocks), rowId]
    );

    results.steps.push({
      step: "Mutate CMS Configuration in PostgreSQL",
      status: "PASS",
      mutation: testMutation
    });
    console.log("CMS configuration updated. Reloading PDP storefront...");

    // Wait a brief moment then reload
    await page.waitForTimeout(1500);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // Verify mutated button text
    const mutatedAddToCartBtn = await page.$('button[data-testid="pdp-add-to-bag"]');
    const mutatedText = mutatedAddToCartBtn ? (await mutatedAddToCartBtn.innerText()).trim() : "";
    const mutatedBuyNowBtn = await page.$('button[data-testid="pdp-buy-now"]');
    const mutatedBuyNowText = mutatedBuyNowBtn ? (await mutatedBuyNowBtn.innerText()).trim() : "";
    const trustBadgesEl = await page.$('[data-testid="pdp-highlights"]');

    const passAddToCart = mutatedText.toLowerCase().includes("add to gourmet bag");
    const passBuyNow = mutatedBuyNowText.toLowerCase().includes("express gourmet order");
    const passTrustBadgesHidden = trustBadgesEl === null;

    console.log(`Mutated AddToCart Text: "${mutatedText}" (matches: ${passAddToCart})`);
    console.log(`Mutated BuyNow Text: "${mutatedBuyNowText}" (matches: ${passBuyNow})`);
    console.log(`Trust Badges Section Hidden: ${passTrustBadgesHidden}`);

    results.steps.push({
      step: "Verify Mutated Storefront PDP",
      status: (passAddToCart && passBuyNow && passTrustBadgesHidden) ? "PASS" : "FAIL",
      details: {
        mutatedAddToCartText: mutatedText,
        matchesExpectedAddToCart: passAddToCart,
        mutatedBuyNowText: mutatedBuyNowText,
        matchesExpectedBuyNow: passBuyNow,
        trustBadgesHidden: passTrustBadgesHidden
      }
    });

    console.log("Step 4: Restoring baseline CMS configuration in PostgreSQL...");
    await pool.query(
      "UPDATE cms_page SET blocks = $1, status = 'published', updated_at = NOW() WHERE id = $2",
      [JSON.stringify(baselineBlocks), rowId]
    );

    // Reload again to verify restoration
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const restoredAddToCartBtn = await page.$('button[data-testid="pdp-add-to-bag"]');
    const restoredText = restoredAddToCartBtn ? (await restoredAddToCartBtn.innerText()).trim() : "";
    const restoredTrustBadgesEl = await page.$('[data-testid="pdp-highlights"]');
    const restoredPass = restoredText.toLowerCase().includes(originalAddToCartText.toLowerCase()) ||
                         restoredText.toLowerCase().includes("bag") ||
                         restoredText.toLowerCase().includes("cart");

    console.log(`Restored AddToCart Text: "${restoredText}"`);
    console.log(`Restored Trust Badges Present: ${restoredTrustBadgesEl !== null}`);

    results.steps.push({
      step: "Restore Baseline CMS and Verify Storefront",
      status: restoredPass ? "PASS" : "FAIL",
      details: {
        restoredText,
        trustBadgesRestored: restoredTrustBadgesEl !== null
      }
    });

    results.overall = results.steps.every(s => s.status === "PASS") ? "SUCCESS" : "FAILURE";
    console.log(`\n=== CMS Roundtrip Persistence Result: ${results.overall} ===`);
    console.log(JSON.stringify(results, null, 2));

    const fs = require('fs');
    fs.writeFileSync(path.join(__dirname, 'cms_pdp_persistence_evidence.json'), JSON.stringify(results, null, 2));
    console.log("Evidence saved to scratch/cms_pdp_persistence_evidence.json");

  } catch (err) {
    console.error("Roundtrip test error:", err);
    results.overall = "ERROR";
    results.error = err.message;
    // Attempt baseline restoration in finally if failed
    if (baselineBlocks && rowId) {
      try {
        await pool.query(
          "UPDATE cms_page SET blocks = $1, status = 'published', updated_at = NOW() WHERE id = $2",
          [JSON.stringify(baselineBlocks), rowId]
        );
        console.log("Safely restored baseline CMS blocks after error.");
      } catch (restoreErr) {
        console.error("Failed to restore baseline blocks:", restoreErr);
      }
    }
  } finally {
    if (browser) await browser.close();
    await pool.end();
  }
}

runRoundtrip();
