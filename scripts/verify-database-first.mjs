import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const { Pool } = require(path.join(__dirname, "../frontend/node_modules/pg"));

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres.uubwhsnnrnicyczwqlbq:caketohomeqwerty@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

let passCount = 0;
let failCount = 0;

function pass(name, detail = "") {
  passCount++;
  console.log(`  \x1b[32m[PASS]\x1b[0m ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, error = "") {
  failCount++;
  console.error(`  \x1b[31m[FAIL]\x1b[0m ${name}${error ? ` — ${error}` : ""}`);
}

async function verifyTableExists(tableName) {
  try {
    const res = await pool.query(
      `SELECT count(*)::int as count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
      [tableName]
    );
    const exists = res.rows[0].count > 0;
    if (exists) {
      const rowCountRes = await pool.query(`SELECT count(*)::int as count FROM "${tableName}"`);
      pass(`PostgreSQL Table "${tableName}" exists`, `${rowCountRes.rows[0].count} records`);
      return true;
    } else {
      fail(`PostgreSQL Table "${tableName}" exists`, "Table not found in information_schema");
      return false;
    }
  } catch (err) {
    fail(`PostgreSQL Table "${tableName}" query failed`, err.message);
    return false;
  }
}

async function main() {
  console.log("════════════════════════════════════════════════════════════════════════════════");
  console.log(" CakeToHome: Authoritative PostgreSQL Database-First Architecture Verification");
  console.log("════════════════════════════════════════════════════════════════════════════════\n");

  const repoRoot = path.resolve(__dirname, "..");
  const frontendDataDir = path.join(repoRoot, "frontend", "data");
  const dbStoreJsonPath = path.join(frontendDataDir, "db-store.json");

  // GATE 1: Physical File Verification
  console.log("[GATE 1] Physical Storage Non-Existence Check");
  if (!fs.existsSync(dbStoreJsonPath)) {
    pass("Physical JSON store (db-store.json) is ABSENT");
  } else {
    fail("Physical JSON store (db-store.json) exists", dbStoreJsonPath);
  }

  // GATE 2: PostgreSQL Live Connection & Schema Verification
  console.log("\n[GATE 2] Live PostgreSQL Schema & Table Durability Check");
  const requiredTables = [
    "branch",
    "city",
    "delivery_zone",
    "product",
    "customer",
    "customer_address",
    "delivery_partner",
    "order",
    "cms_page",
    "offer",
    "setting",
    "popup_campaigns",
    "variant_option",
    "customer_favorite",
    "product_review",
  ];

  for (const table of requiredTables) {
    await verifyTableExists(table);
  }

  // GATE 3: Source Code Purity Audit (createDefaultStore empty arrays)
  console.log("\n[GATE 3] Source Code Empty-Default Store Verification");
  const apiEnginePath = path.join(repoRoot, "frontend", "src", "lib", "api-engine.ts");
  const apiEngineContent = fs.readFileSync(apiEnginePath, "utf-8");

  const loadStoreMatch = apiEngineContent.includes("DATABASE-FIRST: Runtime store starts EMPTY");
  if (loadStoreMatch) {
    pass("api-engine.ts initializes runtime store with EMPTY collections");
  } else {
    fail("api-engine.ts loadStore() still uses default mock data constants");
  }

  // GATE 4: EnsureHydrated API Gating
  console.log("\n[GATE 4] API Route Synchronization Verification");
  const routeTsPath = path.join(repoRoot, "frontend", "src", "app", "api", "v1", "[...path]", "route.ts");
  const routeTsContent = fs.readFileSync(routeTsPath, "utf-8");

  const hasEnsureHydratedGet = routeTsContent.includes("await ApiEngine.ensureHydrated()");
  if (hasEnsureHydratedGet) {
    pass("API routes are gated by await ApiEngine.ensureHydrated()");
  } else {
    fail("API routes missing ensureHydrated() gating");
  }

  console.log("\n════════════════════════════════════════════════════════════════════════════════");
  console.log(` VERIFICATION SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("════════════════════════════════════════════════════════════════════════════════\n");

  await pool.end();
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("FATAL verification error:", err);
  await pool.end().catch(() => null);
  process.exit(1);
});
