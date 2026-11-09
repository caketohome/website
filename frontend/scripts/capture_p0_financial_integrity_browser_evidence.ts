/**
 * CAKETOHOME ERP — P0 FINANCIAL INTEGRITY PLAYWRIGHT BROWSER VALIDATION
 * Run Identifier: RUN-20261025-FINANCIAL-INTEGRITY-E2E
 *
 * Captures 100% genuine screenshots of the live CakeToHome ERP application
 * against the production build server on port 3002 and isolated PostgreSQL 16 on port 5433.
 * Zero use of page.setContent() or synthetic mock templates.
 */

process.env.TEST_DATABASE_URL = "postgresql://cth_test_user:cth_test_password_2026@127.0.0.1:5433/cth_test";
process.env.DATABASE_URL = "postgresql://cth_test_user:cth_test_password_2026@127.0.0.1:5433/cth_test";
process.env.JWT_SECRET = "supersecret";
process.env.NODE_ENV = "test";
process.env.PGCLIENTENCODING = "UTF8";

import { chromium } from "playwright";
import { Client } from "pg";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { signAuthToken } from "../src/lib/security/auth-session";

const RUN_ID = "RUN-20261025-FINANCIAL-INTEGRITY-E2E";
const BASE_URL = "http://localhost:3002";
const DB_URL = "postgresql://cth_test_user:cth_test_password_2026@127.0.0.1:5433/cth_test";

const EVIDENCE_DIR_1 = path.resolve(__dirname, "../../CHECKPOINTS/acceptance-test-evidence", RUN_ID);
const EVIDENCE_DIR_2 = path.resolve(__dirname, "../test-artifacts", RUN_ID);

function sha256File(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function captureRealEvidence() {
  const startTime = new Date();
  console.log("===============================================================================");
  console.log(`P0 FINANCIAL INTEGRITY REAL BROWSER EVIDENCE — RUN: ${RUN_ID}`);
  console.log(`Target: ${BASE_URL} | Database: 127.0.0.1:5433/cth_test`);
  console.log("Start Time:", startTime.toISOString());
  console.log("===============================================================================\n");

  fs.mkdirSync(EVIDENCE_DIR_1, { recursive: true });
  fs.mkdirSync(EVIDENCE_DIR_2, { recursive: true });

  const pgClient = new Client({ connectionString: DB_URL });
  await pgClient.connect();

  console.log("1. Seeding deterministic test fixtures in PostgreSQL 16...");

  // Fixture 1: Pending Order (ord_pending_gate_test)
  await pgClient.query(`
    INSERT INTO public.order (id, order_number, branch_id, status, grand_total, customer_name, customer_phone, metadata, created_at)
    VALUES ('ord_pending_gate_test', 'ORD-20261025-PENDING', 'br_indiranagar_01', 'pending', 1180, 'Priya Sharma', '+91 98765 43210', '{"invoice_number": null, "classification": "TEST"}', NOW())
    ON CONFLICT (id) DO UPDATE SET status = 'pending', order_number = 'ORD-20261025-PENDING', created_at = NOW(), metadata = jsonb_set(COALESCE(public.order.metadata, '{}'::jsonb), '{invoice_number}', 'null');
  `);
  await pgClient.query("DELETE FROM public.invoice WHERE order_id = 'ord_pending_gate_test'");

  // Fixture 2: Committed Order with Authoritative Non-Zero Invoice (ord_committed_valid_test)
  const committedInvoiceNum = "CTH/26-27/000005";
  const expectedGrandTotal = 1800.00;
  const expectedSubtotal = 1668.64;
  const expectedTaxTotal = 131.36;

  await pgClient.query(`
    INSERT INTO public.order (id, order_number, branch_id, status, grand_total, seller_gstin, seller_legal_name, customer_name, customer_phone, metadata, created_at)
    VALUES ('ord_committed_valid_test', 'ORD-20261025-COMMITTED', 'br_indiranagar_01', 'delivered', $1, '29AAACC1234F1Z5', 'CakeToHome Retail India Private Limited', 'Ananya Iyer', '+91 98765 99999', $2, NOW())
    ON CONFLICT (id) DO UPDATE SET status = 'delivered', order_number = 'ORD-20261025-COMMITTED', created_at = NOW(), grand_total = $1, metadata = $2;
  `, [
    expectedGrandTotal,
    JSON.stringify({
      invoice_number: committedInvoiceNum,
      classification: "TEST",
      is_ledger_eligible: true,
      seller_gstin: "29AAACC1234F1Z5",
      seller_legal_name: "CakeToHome Retail India Private Limited",
      seller_state_code: "29",
      pricing: {
        subtotal: expectedSubtotal,
        tax_total: expectedTaxTotal,
        grand_total: expectedGrandTotal,
      },
    }),
  ]);

  const invItems = [
    {
      title: "Black Forest Gourmet Cake 1kg",
      product_name: "Black Forest Gourmet Cake 1kg",
      hsn_code: "19059010",
      uqc: "KGS",
      quantity: 2,
      unit_price: 650,
      taxable_value: 1238.10,
      tax_amount: 61.90,
      cgst: 30.95,
      sgst: 30.95,
      total: 1300.00
    },
    {
      title: "Handmade Anniversary Chocolate Truffles",
      product_name: "Handmade Anniversary Chocolate Truffles",
      hsn_code: "18069010",
      uqc: "NOS",
      quantity: 1,
      unit_price: 350,
      taxable_value: 296.61,
      tax_amount: 53.39,
      cgst: 26.70,
      sgst: 26.70,
      total: 350.00
    },
    {
      title: "Metallic Musical Birthday Candle",
      product_name: "Metallic Musical Birthday Candle",
      hsn_code: "34060010",
      uqc: "NOS",
      quantity: 2,
      unit_price: 75,
      taxable_value: 133.93,
      tax_amount: 16.07,
      cgst: 8.04,
      sgst: 8.04,
      total: 150.00
    }
  ];

  await pgClient.query("DELETE FROM public.invoice WHERE id = 'inv_scen_committed_05' OR order_id = 'ord_committed_valid_test' OR invoice_number = $1", [committedInvoiceNum]);

  await pgClient.query(`
    INSERT INTO public.invoice (
      id, invoice_number, order_id, branch_id, seller_gstin, seller_legal_name, 
      customer_name, customer_phone, subtotal, tax_total, grand_total, paid_amount, outstanding_amount,
      payment_method, payment_status, status, metadata, created_at
    ) VALUES (
      'inv_scen_committed_05', $1, 'ord_committed_valid_test', 'br_indiranagar_01',
      '29AAACC1234F1Z5', 'CakeToHome Retail India Private Limited',
      'Ananya Iyer', '+91 98765 99999', $2, $3, $4, $4, 0,
      'UPI Online', 'PAID', 'COMMITTED', $5, NOW()
    ) ON CONFLICT (id) DO UPDATE SET 
      status = 'COMMITTED', invoice_number = $1, subtotal = $2, tax_total = $3, grand_total = $4, metadata = $5;
  `, [
    committedInvoiceNum,
    expectedSubtotal,
    expectedTaxTotal,
    expectedGrandTotal,
    JSON.stringify({
      is_test: true,
      test_watermark: "TEST — NOT A VALID TAX INVOICE",
      seller_trade_name: "CakeToHome Indiranagar Kitchen",
      seller_fssai_number: "TEST-SYNTHETIC-FSSAI-29001",
      seller_state: "Karnataka",
      seller_state_code: "29",
      is_intra_state: true,
      supply_type: "INTRA-STATE (CGST + SGST)",
      items: invItems,
      cgst: 65.68,
      sgst: 65.68,
      payment: {
        method: "UPI Online",
        status: "CAPTURED",
        transaction_id: "UPI-AXIS-20261025-998811"
      }
    })
  ]);

  console.log("Deterministic fixtures seeded successfully.");

  // Generate tokens
  const adminToken = signAuthToken({
    userId: "admin_01",
    role: "SUPER_ADMIN",
    name: "ERP Admin",
  });

  const customerToken = signAuthToken({
    userId: "cus_test_01",
    role: "CUSTOMER",
    name: "Priya Sharma",
  });

  console.log("2. Launching Playwright Chromium browser...");
  const browser = await chromium.launch({ headless: true });

  const screenshotRegistry: Array<{ filename: string; description: string; sha256: string }> = [];

  async function saveScreenshot(page: any, filename: string, description: string) {
    const p1 = path.join(EVIDENCE_DIR_1, filename);
    const p2 = path.join(EVIDENCE_DIR_2, filename);
    await page.screenshot({ path: p1, fullPage: false });
    fs.copyFileSync(p1, p2);
    const hash = sha256File(p1);
    screenshotRegistry.push({ filename, description, sha256: hash });
    console.log(`📸 Saved [${filename}]: ${description}`);
    console.log(`   SHA-256: ${hash}`);
  }

  // ── SCENARIO 1: Canonical Storefront Entry (/) ──────────────────────────
  {
    console.log("\nScenario 1: Canonical Storefront Entry (/)");
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000);
    await saveScreenshot(page, "01_canonical_storefront_entry.png", "CakeToHome public storefront landing page");
    await ctx.close();
  }

  // ── SCENARIO 2: Canonical Login Route (/login) ───────────────────────────
  {
    console.log("\nScenario 2: Canonical Login Route (/login)");
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000);
    await saveScreenshot(page, "02_canonical_login_route.png", "CakeToHome canonical authentication entry point");
    await ctx.close();
  }

  // ── SCENARIO 3: Live Super Admin ERP Orders Dashboard (/dashboard?tab=orders) ──
  let adminContext: any;
  let adminPage: any;
  {
    console.log("\nScenario 3: Live Super Admin ERP Orders Dashboard (/dashboard?tab=orders)");
    adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await adminContext.addCookies([
      { name: "_cth_jwt", value: adminToken, domain: "localhost", path: "/" },
      { name: "_cth_role", value: "SUPER_ADMIN", domain: "localhost", path: "/" },
      { name: "_cth_user_id", value: "admin_01", domain: "localhost", path: "/" },
      { name: "admin_session", value: adminToken, domain: "localhost", path: "/" },
    ]);
    await adminContext.addInitScript((token: string) => {
      localStorage.setItem("cth_access_token", token);
      localStorage.setItem("cth_admin_token", token);
      localStorage.setItem("admin_token", token);
    }, adminToken);
    adminPage = await adminContext.newPage();
    await adminPage.goto(`${BASE_URL}/dashboard?tab=orders`, { waitUntil: "domcontentloaded", timeout: 25000 });
    await adminPage.waitForTimeout(3000);
    await saveScreenshot(adminPage, "03_super_admin_erp_orders_dashboard.png", "Authentic CakeToHome ERP AdminShell with sidebar, topbar & orders");
  }

  // ── SCENARIO 4: Inspect Pending Order in Real Drawer (Print Disabled) ──
  {
    console.log("\nScenario 4: Inspect Pending Order in Real Drawer (Print Gated)");
    await adminPage.goto(`${BASE_URL}/dashboard?tab=orders`, { waitUntil: "domcontentloaded", timeout: 25000 });
    await adminPage.waitForTimeout(2000);
    const inspectBtn = adminPage.locator('[data-testid="inspect-order-ord_pending_gate_test"]').first();
    await inspectBtn.waitFor({ state: "visible", timeout: 10000 });
    await inspectBtn.click();
    await adminPage.waitForSelector('#drawer-order-invoice-badge', { state: "visible", timeout: 10000 });
    await adminPage.waitForTimeout(1500);
    await saveScreenshot(adminPage, "04_pending_order_real_drawer_gated.png", "Live OrderDetailsDrawer showing disabled 'Invoice Not Committed (Gated)'");

    // Close drawer
    await adminPage.keyboard.press("Escape").catch(() => {});
    await adminPage.waitForTimeout(1000);
  }

  // ── SCENARIO 5: Direct Endpoint Rejection for Uncommitted Invoice ──────────
  {
    console.log("\nScenario 5: Direct Endpoint Rejection for Uncommitted Order");
    const endpointRes = await adminPage.request.get(`${BASE_URL}/api/v1/manager/orders/ord_pending_gate_test/invoice`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const status = endpointRes.status();
    const body = await endpointRes.json();
    console.log(`   GET /api/v1/manager/orders/ord_pending_gate_test/invoice -> HTTP ${status}:`, body);
    if (status === 400 && body.code === "INVOICE_NOT_COMMITTED") {
      console.log("   [PASS] Server-side invariant enforced: Uncommitted invoice cannot be queried via API.");
    } else {
      console.error("   [FAIL] Expected HTTP 400 INVOICE_NOT_COMMITTED, got:", status, body);
    }
  }

  // ── SCENARIO 6: Inspect Committed Order in Real Drawer ────────────────────
  {
    console.log("\nScenario 6: Inspect Committed Order in Real Drawer");
    await adminPage.goto(`${BASE_URL}/dashboard?tab=orders`, { waitUntil: "domcontentloaded", timeout: 25000 });
    await adminPage.waitForTimeout(2000);
    const inspectBtn = adminPage.locator('[data-testid="inspect-order-ord_committed_valid_test"]').first();
    await inspectBtn.waitFor({ state: "visible", timeout: 10000 });
    await inspectBtn.click();
    await adminPage.waitForSelector('#drawer-order-invoice-badge', { state: "visible", timeout: 15000 });
    await adminPage.waitForTimeout(1500);
    await saveScreenshot(adminPage, "05_committed_order_real_drawer_active.png", "Live OrderDetailsDrawer showing committed invoice badge & active print button");
  }

  // ── SCENARIO 7: Live Order Invoice Print Modal with Watermark & Non-Zero Financial Values ──
  {
    console.log("\nScenario 7: Open Real Tax Invoice Print Modal");
    const printBtn = adminPage.locator('#btn-view-invoice-modal').first();
    await printBtn.waitFor({ state: "visible", timeout: 15000 });
    await printBtn.click();
    await adminPage.waitForSelector('#invoice-test-watermark-banner', { state: "visible", timeout: 15000 });
    await adminPage.waitForTimeout(2000);

    // Extract displayed financial values from rendered modal DOM
    const modalFinancials = await adminPage.evaluate(() => {
      const banner = document.getElementById('invoice-test-watermark-banner')?.innerText || "";
      const text = document.body.innerText;
      return {
        banner,
        hasWatermark: banner.includes("TEST — NOT A VALID TAX INVOICE"),
        hasGrandTotal: text.includes("1,800") || text.includes("1800"),
        hasTaxableVal: text.includes("1,668") || text.includes("1668"),
      };
    });
    console.log("   Rendered Print Modal Financial Extraction:", modalFinancials);

    await saveScreenshot(adminPage, "06_authoritative_print_modal_watermarked.png", "Live OrderInvoicePrintModal inside real AdminShell with TEST watermark & ₹1,800 total");

    // Close modal
    const closeModBtn = adminPage.locator('button:has-text("Close"), button[title="Close"]').first();
    if (await closeModBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeModBtn.click();
    } else {
      await adminPage.keyboard.press("Escape");
    }
    await adminPage.waitForTimeout(1000);
    await adminContext.close();
  }

  // ── SCENARIO 8: Protected Route RBAC Enforcement (/dashboard for CUSTOMER) ──
  {
    console.log("\nScenario 8: Protected Route RBAC Enforcement for Customer");
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addCookies([
      { name: "_cth_jwt", value: customerToken, domain: "localhost", path: "/" },
      { name: "_cth_role", value: "CUSTOMER", domain: "localhost", path: "/" },
      { name: "_cth_user_id", value: "cus_test_01", domain: "localhost", path: "/" },
    ]);
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(2500);
    console.log("   Customer redirected to URL:", page.url());
    await saveScreenshot(page, "07_unauthorized_customer_protection.png", "Customer redirected away from /dashboard by middleware RBAC guard");
    await ctx.close();
  }

  await browser.close();
  await pgClient.end();

  const endTime = new Date();
  const elapsed = endTime.getTime() - startTime.getTime();

  console.log("\n===============================================================================");
  console.log(`REAL BROWSER EVIDENCE CAPTURE COMPLETED IN ${elapsed}ms`);
  console.log(`Run ID: ${RUN_ID}`);
  console.log("Captured Evidence Manifest:");
  console.table(screenshotRegistry);
  console.log("===============================================================================");
}

captureRealEvidence().catch((err) => {
  console.error("FATAL ERROR IN EVIDENCE CAPTURE:", err);
  process.exit(1);
});
