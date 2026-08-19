/**
 * CakeToHome Automated Performance & Regression Matrix Benchmark Suite
 * Measures latency, execution duration, and assertion results across all core subsystems.
 */

import { performance } from "perf_hooks";
import { execSync } from "child_process";
import { ApiEngine } from "../src/lib/api-engine";
import { normalizePhone } from "../src/lib/crm/crm-engine";

interface BenchmarkResult {
  name: string;
  category: "API" | "State Machine" | "E2E Test" | "Memory" | "Routing";
  durationMs: number;
  status: "PASS" | "FAIL";
  details?: any;
}

const benchmarks: BenchmarkResult[] = [];

function runBenchmark(name: string, category: BenchmarkResult["category"], fn: () => void | Promise<void>) {
  const start = performance.now();
  try {
    fn();
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    benchmarks.push({ name, category, durationMs, status: "PASS" });
    console.log(`[PASS] [${category}] ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    benchmarks.push({ name, category, durationMs, status: "FAIL", details: err?.message });
    console.error(`[FAIL] [${category}] ${name} (${durationMs}ms) --> ${err?.message}`);
  }
}

async function runSuite() {
  console.log("══════════════════════════════════════════════════════════════════════════════");
  console.log("CAKETOHOME PRODUCTION PERFORMANCE MATRIX & REGRESSION BENCHMARK");
  console.log("══════════════════════════════════════════════════════════════════════════════\n");

  // 1. Phone Normalization Performance (10,000 operations)
  runBenchmark("Phone Normalization (10,000 iterations)", "API", () => {
    for (let i = 0; i < 10000; i++) {
      normalizePhone("+91 98765-43210");
    }
  });

  // 2. Product Catalog Query Benchmark (1,000 queries)
  runBenchmark("In-Memory Product Catalog Lookup (1,000 queries)", "API", () => {
    for (let i = 0; i < 1000; i++) {
      ApiEngine.getProducts();
    }
  });

  // 3. Payment Confirmation Gate Evaluation (1,000 orders)
  runBenchmark("Payment Confirmation Gate Filter (1,000 iterations)", "State Machine", () => {
    const sampleOrder = { payment_status: "captured", payment_method: "Razorpay" };
    for (let i = 0; i < 1000; i++) {
      ApiEngine.isPaymentConfirmed(sampleOrder);
    }
  });

  // 4. Branch Isolation & Delivery Scope Check (1,000 evaluations)
  runBenchmark("Delivery Partner Authorized Branch Check (1,000 iterations)", "State Machine", () => {
    const partner = {
      primary_branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
      associated_branches: ["res_01KXYMAHGFPRY1G9TZKEVGAGAT", "br_indiranagar"],
    };
    for (let i = 0; i < 1000; i++) {
      ApiEngine.getDeliveryPartnerAuthorizedBranches(partner);
    }
  });

  // 5. Run Store Manager & Delivery Workflow E2E
  runBenchmark("Workflow & State Machine E2E (test-store-manager-payment-delivery-e2e)", "E2E Test", () => {
    execSync("npx tsx scripts/test-store-manager-payment-delivery-e2e.ts", { stdio: "ignore" });
  });

  // 6. Run Checkout Verification E2E
  runBenchmark("Checkout Architecture Verification (test-checkout-verification)", "E2E Test", () => {
    execSync("npx tsx scripts/test-checkout-verification.ts", { stdio: "ignore" });
  });

  // 7. Run Master Customer Identity Chain E2E
  runBenchmark("Master Identity & Recovery Chain (test-master-identity-chain-e2e)", "E2E Test", () => {
    execSync("npx tsx scripts/test-master-identity-chain-e2e.ts", { stdio: "ignore" });
  });

  // 8. Run Scroll Frame Hero Animation Configuration Benchmark
  runBenchmark("Scroll Sequence Hero 22-Frame Clamping & Config", "E2E Test", () => {
    const { resolveFrameUrl, DEFAULT_SCROLL_SEQUENCE_CONFIG } = require("../src/components/store/animation/scroll-sequence-config");
    if (DEFAULT_SCROLL_SEQUENCE_CONFIG.frameCount !== 22) {
      throw new Error(`Expected 22 frames but got ${DEFAULT_SCROLL_SEQUENCE_CONFIG.frameCount}`);
    }
    // Test frame 1 URL
    const f1 = resolveFrameUrl(1);
    if (!f1.includes("frames1_0001.jpg")) throw new Error(`Invalid frame 1 URL: ${f1}`);
    // Test frame 22 URL
    const f22 = resolveFrameUrl(22);
    if (!f22.includes("frames1_0022.jpg")) throw new Error(`Invalid frame 22 URL: ${f22}`);
    // Test clamped bounds (>22 clamps to 22)
    const fOver = resolveFrameUrl(99);
    if (!fOver.includes("frames1_0022.jpg")) throw new Error(`Clamping failed for index > 22: ${fOver}`);
  });

  console.log("\n══════════════════════════════════════════════════════════════════════════════");
  console.log("BENCHMARK SUMMARY");
  console.log("══════════════════════════════════════════════════════════════════════════════");
  console.table(benchmarks.map((b) => ({ Name: b.name, Category: b.category, "Time (ms)": b.durationMs, Status: b.status })));

  const total = benchmarks.length;
  const passed = benchmarks.filter((b) => b.status === "PASS").length;
  console.log(`TOTAL BENCHMARKS: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
  if (passed !== total) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Benchmark suite execution error:", err);
  process.exit(1);
});
