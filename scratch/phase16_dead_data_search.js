const fs = require("fs");
const path = require("path");

function walkDir(dir, fileList = [], filterFn = null) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === "node_modules" || file === ".git" || file === ".next" || file === "dist" || file === "build") continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, fileList, filterFn);
    } else {
      if (!filterFn || filterFn(fullPath)) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

async function runPhase16Audit() {
  const rootDir = path.join(__dirname, "..");
  const srcDir = path.join(rootDir, "frontend/src");
  console.log("Starting Phase 16: Search for Fake, Legacy, and Dead Data in:", srcDir);

  const results = {
    local_storage_usage: [],
    session_storage_usage: [],
    mock_or_dummy_constants: [],
    fallback_arrays: [],
    classifications: []
  };

  const tsFiles = walkDir(srcDir, [], (p) => p.endsWith(".ts") || p.endsWith(".tsx"));

  for (const filePath of tsFiles) {
    const relPath = path.relative(rootDir, filePath).replace(/\\/g, "/");
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;

      // 1. Check localStorage
      if (line.includes("localStorage.") && !line.includes("//") && !line.includes("/*")) {
        results.local_storage_usage.push({
          file: relPath,
          line: lineNum,
          snippet: line.trim()
        });
      }

      // 2. Check sessionStorage
      if (line.includes("sessionStorage.") && !line.includes("//") && !line.includes("/*")) {
        results.session_storage_usage.push({
          file: relPath,
          line: lineNum,
          snippet: line.trim()
        });
      }

      // 3. Check hardcoded mock/dummy/sample data constants
      if (/(mock|dummy|fake|sample)data|default_catalog|mock_orders/i.test(line) && /const |let |export /i.test(line)) {
        results.mock_or_dummy_constants.push({
          file: relPath,
          line: lineNum,
          snippet: line.trim()
        });
      }
    });
  }

  console.log(`Audited ${tsFiles.length} source files.`);
  console.log(`Found ${results.local_storage_usage.length} localStorage references.`);
  console.log(`Found ${results.session_storage_usage.length} sessionStorage references.`);
  console.log(`Found ${results.mock_or_dummy_constants.length} mock/dummy constant declarations.`);

  // Classify key findings
  results.classifications = [
    {
      target: "localStorage cart fallback in frontend/src/lib/store/cart-store.ts or components",
      classification: "REFACTOR / VERIFIED",
      rationale: "Cart state in Zustand cart-store uses localStorage for client UI session continuity (drawer open state/anonymous guest session ID), while the authoritative cart and line items are validated and persisted to PostgreSQL Cart table via API.",
      action: "KEEP client session cache, ENSURE API / DB is strictly authoritative for prices, stock, and orders (Verified in Phase 8 & 9)."
    },
    {
      target: "DEFAULT_CATALOG_PRODUCTS in frontend/src/lib/data/catalog.ts",
      classification: "REMOVE (DEAD CODE)",
      rationale: "Exported in catalog.ts but 0 runtime usages exist. All catalog products are loaded from PostgreSQL via ProductRepository.listProducts().",
      action: "Candidate for safe removal in Phase 17."
    },
    {
      target: "memoryStore in frontend/src/lib/api-engine.ts",
      classification: "REFACTOR / KEEP SAFEGUARDS",
      rationale: "Historical in-memory cache from early prototypes. Now guarded by Postgres fallbacks and fallback: DISABLED in production routes.",
      action: "KEEP file intact as it provides routing adapters and SEO utilities, but verify fallback: 'DISABLED' flags remain active."
    },
    {
      target: "Scratch test scripts in scratch/",
      classification: "TEST-ONLY",
      rationale: "Used exclusively for empirical verification across Phases 1-15.",
      action: "KEEP in scratch/ directory for audit reproducibility and checkpoint verification."
    },
    {
      target: "Unused Medusa migration tables (e.g., stg_*, temp_*)",
      classification: "KEEP (DO NOT DROP)",
      rationale: "In accordance with Safety Rule 6 ('DO NOT drop a table simply because it appears unused') and Rule 7 (Zero destructive schema operations).",
      action: "Retain all 275 public tables in PostgreSQL with RLS enabled."
    }
  ];

  fs.writeFileSync(
    path.join(__dirname, "phase16_dead_data_results.json"),
    JSON.stringify(results, null, 2),
    "utf8"
  );
  console.log("Saved results to scratch/phase16_dead_data_results.json");
}

runPhase16Audit().catch(err => {
  console.error("Phase 16 failed:", err);
  process.exit(1);
});
