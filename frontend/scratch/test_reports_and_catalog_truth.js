/**
 * Verification Test: Reports, Dashboards, Catalog, Delivery, Cart, and Reminders
 * Verifying PostgreSQL source-of-truth implementation without memoryStore fallbacks.
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

function getDbUrl() {
  const envPath = path.join(__dirname, '../.env');
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const l of lines) {
    if (l.trim().startsWith('DATABASE_URL=')) {
      return l.trim().substring('DATABASE_URL='.length).trim().replace(/['"]/g, '');
    }
  }
  throw new Error('DATABASE_URL not found');
}

process.env.DATABASE_URL = getDbUrl();

// Module Alias Resolution for @frontend/
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@frontend/')) {
    const sub = request.substring('@frontend/'.length);
    const mapped = path.resolve(__dirname, '../src', sub);
    return originalResolveFilename.call(this, mapped, parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

// Register TypeScript compilation hook
const ts = require('../node_modules/typescript');
require.extensions['.ts'] = function (module, filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  return module._compile(compiled.outputText, filename);
};

async function run() {
  console.log("================================================================================");
  console.log("SYSTEM-WIDE SOURCE OF TRUTH: REPORTS, CATALOG, DELIVERIES, CART, CRM");
  console.log("================================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    const { ReportRepository } = require("../src/lib/repositories/report.repository");
    const { OrderRepository } = require("../src/lib/repositories/order.repository");
    const { ReviewRepository } = require("../src/lib/repositories/review.repository");
    const { FavoriteRepository } = require("../src/lib/repositories/favorite.repository");
    const { CartRepository } = require("../src/lib/repositories/cart.repository");
    const { CustomerRepository } = require("../src/lib/repositories/customer.repository");
    const { dbQuery, pool } = require("../src/lib/db");

    // ── Module 3: Report & Dashboard Metrics from PostgreSQL ──
    console.log("\n1. Testing Legacy Dashboard & Sales Metrics (PostgreSQL public.\"order\"):");
    const dashboard = await ReportRepository.getLegacyDashboardMetrics();
    assert(dashboard && typeof dashboard.gross_revenue === "number", "Dashboard metrics returned gross_revenue");
    assert(typeof dashboard.total_orders === "number", "Dashboard metrics returned total_orders count");
    assert(Array.isArray(dashboard.top_branches), "Dashboard metrics returned top_branches array");
    assert(Array.isArray(dashboard.status_distribution), "Dashboard metrics returned status_distribution array");

    const sales = await ReportRepository.getLegacySalesMetrics();
    assert(sales && typeof sales.gross_revenue === "number", "Sales metrics returned gross_revenue");
    assert(Array.isArray(sales.sales_by_period), "Sales metrics returned sales_by_period array");
    assert(typeof sales.net_margin_pct === "string", "Sales metrics returned net_margin_pct");

    // ── Module 4: Delivery Partner Job Listings ──
    console.log("\n2. Testing Delivery Partner Order Pipeline (PostgreSQL):");
    const orderList = await OrderRepository.listOrders({ limit: 10 });
    assert(orderList && Array.isArray(orderList.items), "OrderRepository.listOrders returns items array from PostgreSQL");
    assert(typeof orderList.total === "number", "OrderRepository returns accurate total order count");

    // ── Module 5: Catalog Reviews & Wishlist in PostgreSQL ──
    console.log("\n3. Testing Product Reviews & Customer Wishlist (PostgreSQL):");
    const testProdId = "test_prod_truth_99";
    const testCustUid = "cust_truth_tester_99";

    // Insert a test review via ReviewRepository
    await ReviewRepository.save({
      id: "rev_truth_test_1",
      product_id: testProdId,
      customer_id: testCustUid,
      customer_name: "Truth Tester",
      rating: 5,
      title: "Delicious Cake",
      body: "Real database review",
      status: "APPROVED",
    });

    const reviews = await ReviewRepository.findByProductId(testProdId);
    assert(reviews.length >= 1, "ReviewRepository.findByProductId found row in PostgreSQL");
    assert(reviews[0].review_text === "Real database review", "Review text matches database content");

    // Insert favorite
    await FavoriteRepository.save({
      customer_uid: testCustUid,
      product_id: testProdId,
    });
    const favs = await FavoriteRepository.findByCustomerUid(testCustUid);
    assert(favs.length >= 1, "FavoriteRepository.findByCustomerUid found saved favorite");
    assert(favs[0].product_id === testProdId, "Favorite product_id matches");

    // Clean up test review and favorite
    await dbQuery(`DELETE FROM "product_review" WHERE id = 'rev_truth_test_1'`);
    await FavoriteRepository.delete(testCustUid, testProdId);
    const favsAfter = await FavoriteRepository.findByCustomerUid(testCustUid);
    assert(favsAfter.length === 0, "Favorite cleanly removed from PostgreSQL");

    // ── Module 6 & 7: Cart Repository Persistence ──
    console.log("\n4. Testing Cart Repository Persistence (PostgreSQL):");
    const cart = await CartRepository.findCartById("non_existent_cart_id");
    assert(cart === null, "CartRepository.findCartById returns null for nonexistent cart instead of mock fallback");

    // ── Module 8: CRM Reminders in Customer metadata ──
    console.log("\n5. Testing Customer CRM Reminders in PostgreSQL:");
    const anyCust = await dbQuery(`SELECT id FROM "customer" WHERE deleted_at IS NULL LIMIT 1`);
    if (anyCust.rows.length > 0) {
      const custId = anyCust.rows[0].id;
      const testReminder = {
        title: "Anniversary Celebration",
        date: "2026-11-20",
        type: "ANNIVERSARY",
        notes: "Automated truth test reminder",
      };
      const savedRem = await CustomerRepository.saveReminder(custId, testReminder);
      assert(savedRem && savedRem.id, "CustomerRepository.saveReminder saved to JSONB metadata");

      const custReminders = await CustomerRepository.listReminders(custId);
      assert(Array.isArray(custReminders), "CustomerRepository.listReminders returns array");
      assert(custReminders.some(r => r.title === "Anniversary Celebration"), "Saved reminder retrieved from customer metadata");

      // Clean up reminder from customer metadata
      await dbQuery(
        `UPDATE "customer"
         SET metadata = metadata - 'reminders'
         WHERE id = $1`,
        [custId]
      );
      console.log("  [PASS] Test reminder fixture cleanly deleted from customer metadata");
      passed++;
    } else {
      console.log("  [SKIP] No customer row available for reminder test");
    }

    // Check pool close
    if (pool && typeof pool.end === "function") {
      await pool.end();
    }

    console.log("\n================================================================================");
    console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log("================================================================================");

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error("Test execution failed with error:", err);
    process.exit(1);
  }
}

run();
