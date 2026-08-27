import { execSync } from "child_process";
import * as path from "path";

interface SuiteResult {
  name: string;
  file: string;
  status: "PASS" | "FAIL";
  durationMs: number;
  outputSnippet: string;
  error?: string;
}

const suites = [
  { name: "Authoritative Multi-State Server Audit", file: "scripts/audit-real-server-endpoints.ts" },
  { name: "Multi-State & Map-Fence Delivery E2E", file: "scripts/test-multi-state-delivery-e2e.ts" },
  { name: "Auth Role Isolation & RBAC", file: "scripts/test-auth-role-isolation.ts" },
  { name: "Master Identity Chain", file: "scripts/test-master-identity-chain-e2e.ts" },
  { name: "Customer Account & Profiles", file: "scripts/test-customer-account-e2e.ts" },
  { name: "Customer Favorites & Wishlist", file: "scripts/test-favorites-e2e.ts" },
  { name: "CRM Complete Engine", file: "scripts/test-crm-complete-engine-e2e.ts" },
  { name: "Abandoned Cart Recovery Engine", file: "scripts/test-abandoned-cart-engine-e2e.ts" },
  { name: "Telemarketing Reorder Engine", file: "scripts/test-telemarketing-reorder-engine-e2e.ts" },
  { name: "PIM Weights & Pricing Matrix", file: "scripts/test-pim-weight-matrix-e2e.ts" },
  { name: "Enterprise Search & Typeahead", file: "scripts/test-enterprise-search-e2e.ts" },
  { name: "Product Store Availability Matrix", file: "scripts/test-product-store-availability-matrix.ts" },
  { name: "Product Reviews Engine", file: "scripts/test-product-reviews-e2e.ts" },
  { name: "Product Delivery Restrictions", file: "scripts/test-product-delivery-restrictions.ts" },
  { name: "Checkout Verification Engine", file: "scripts/test-checkout-verification.ts" },
  { name: "Fulfillment Engine Lifecycle", file: "scripts/test-fulfillment-engine.ts" },
  { name: "Master Fulfillment Ordering", file: "scripts/test-master-fulfillment-ordering.ts" },
  { name: "Branch Manager Operations", file: "scripts/test-branch-manager.ts" },
  { name: "Branch Creation E2E", file: "scripts/test-branch-creation-e2e.ts" },
  { name: "Geospatial Map Fencing", file: "scripts/test-map-fencing-e2e.ts" },
  { name: "Multi-City Geographic Hierarchy", file: "scripts/test-multicity-e2e.ts" },
  { name: "CMS Complete Engine", file: "scripts/test-cms-complete-e2e.ts" },
  { name: "Hero Banner CMS Binding", file: "scripts/test-hero-banner-cms-binding-e2e.ts" },
  { name: "Kitchen Story CMS Engine", file: "scripts/test-kitchen-story-live-homepage-e2e.ts" },
  { name: "n8n Transactional Outbox Engine", file: "scripts/test-n8n-outbox-complete-e2e.ts" },
  { name: "n8n Event Gateway & Webhooks", file: "scripts/test-n8n-event-gateway-e2e.ts" },
  { name: "Business Compliance & Invoicing", file: "scripts/test-business-compliance-e2e.ts" },
  { name: "GST Reports & Statutory Engine", file: "scripts/test-gst-excel-export.ts" },
  { name: "ERP Analytics & Daily Metrics", file: "scripts/test-erp-analytics-v2.ts" },
];

async function main() {
  console.log("===============================================================================");
  console.log("🚀 CAKETOHOME — FULL SYSTEM REGRESSION RUNNER");
  console.log(`📦 Running ${suites.length} comprehensive subsystem test suites`);
  console.log("===============================================================================\n");

  const results: SuiteResult[] = [];
  let passedCount = 0;
  let failedCount = 0;

  for (const s of suites) {
    const start = Date.now();
    process.stdout.write(`▶ Running: ${s.name} (${s.file})... `);
    try {
      const stdout = execSync(`npx tsx ${s.file}`, {
        encoding: "utf-8",
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 120000,
      });
      const durationMs = Date.now() - start;
      console.log(`✅ PASS (${durationMs}ms)`);
      passedCount++;
      results.push({
        name: s.name,
        file: s.file,
        status: "PASS",
        durationMs,
        outputSnippet: stdout.slice(-300).trim(),
      });
    } catch (err: any) {
      const durationMs = Date.now() - start;
      console.log(`❌ FAIL (${durationMs}ms)`);
      failedCount++;
      const stderr = err.stderr ? err.stderr.toString() : err.message;
      const stdout = err.stdout ? err.stdout.toString() : "";
      console.error(`   Error snippet: ${stderr.slice(-400)}`);
      results.push({
        name: s.name,
        file: s.file,
        status: "FAIL",
        durationMs,
        outputSnippet: stdout.slice(-300).trim(),
        error: stderr.slice(-400).trim(),
      });
    }
  }

  console.log("\n===============================================================================");
  console.log(`🏁 FULL REGRESSION SUMMARY: Total: ${suites.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log(`📊 OVERALL SUCCESS RATE: ${((passedCount / suites.length) * 100).toFixed(1)}%`);
  console.log("===============================================================================");

  if (failedCount > 0) {
    console.log("\n❌ FAILED SUITES:");
    results.filter(r => r.status === "FAIL").forEach(r => {
      console.log(`  - ${r.name} (${r.file}) -> ${r.error || "Execution failed"}`);
    });
    process.exit(1);
  } else {
    console.log("\n✨ ALL SUBSYSTEM REGRESSION SUITES PASSED CLEANLY WITH ZERO REGRESSIONS!");
    process.exit(0);
  }
}

main();
