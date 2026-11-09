const { Client } = require("../frontend/node_modules/pg");
const path = require("path");
const fs = require("fs");

const envPath = path.join(__dirname, "../frontend/.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const ts = require("../frontend/node_modules/typescript");
require.extensions[".ts"] = function(module, filename) {
  const content = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    }
  });
  return module._compile(compiled.outputText, filename);
};

const { TaxResolverService } = require("../frontend/src/lib/services/tax-resolver.service");

async function backfill() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log("================================================================================");
  console.log("AUDITING & BACKFILLING CANONICAL TAX EVIDENCE IN POSTGRESQL");
  console.log("================================================================================\n");

  const verifiedMappings = [
    { id: "acc_01", taxRateId: "txr_gst_18_in", reason: "Existing metadata: gst_rate=18, tax_class=GST_STANDARD_18" },
    { id: "acc_02", taxRateId: "txr_gst_18_in", reason: "Existing metadata: gst_rate=18, tax_class=GST_STANDARD_18" },
    { id: "prod_01KXYMAJKNWZCFXJHESPTZE01G", taxRateId: "txr_01KY2B1R7WKC3Z3MMQ85EEH8X6", reason: "Existing metadata: gst_rate=5, tax_class=GST_FOOD_5, txcfg_food_5" },
    { id: "prod_01KXYMAJKNXGS5WT4R0QNQGV5F", taxRateId: "txr_01KY2B1R7WKC3Z3MMQ85EEH8X6", reason: "Existing metadata: gst_rate=5, tax_class=GST_FOOD_5, txcfg_food_5" },
    { id: "prod_1788960228243", taxRateId: "txr_01KY2B1R7WKC3Z3MMQ85EEH8X6", reason: "Existing metadata: gst_rate=5, tax_class=GST_FOOD_5, txcfg_food_5" },
    { id: "prod_1788960313218", taxRateId: "txr_01KY2B1R7WKC3Z3MMQ85EEH8X6", reason: "Existing metadata: gst_rate=5, tax_class=GST_FOOD_5, txcfg_food_5" },
    { id: "prod_1788960554491", taxRateId: "txr_01KY2B1R7WKC3Z3MMQ85EEH8X6", reason: "Existing metadata: gst_rate=5, tax_class=GST_FOOD_5, txcfg_food_5" },
    { id: "prod_1788960674375", taxRateId: "txr_01KY2B1R7WKC3Z3MMQ85EEH8X6", reason: "Existing metadata: gst_rate=5, tax_class=GST_FOOD_5, txcfg_food_5" },
    { id: "prod_bouquet_carnation_01", taxRateId: "txr_01KY2B1R7WKC3Z3MMQ85EEH8X6", reason: "Existing metadata: gst_rate=5" },
    { id: "prod_bouquet_rose_01", taxRateId: "txr_01KY2B1R7WKC3Z3MMQ85EEH8X6", reason: "Existing metadata: gst_rate=5" },
  ];

  await client.query("BEGIN");
  try {
    for (const m of verifiedMappings) {
      console.log(`Backfilling canonical mapping for [${m.id}] -> [${m.taxRateId}] (${m.reason})...`);
      const res = await TaxResolverService.assignProductTax(m.id, m.taxRateId, "migration_tax_evidence", client);
      console.log(`  Done: rule ${res.rule_id}, rate ${res.rate}%, code ${res.code}`);
    }

    await client.query("COMMIT");
    console.log("\n✅ COMMIT: All 10 verified products successfully mapped in public.tax_rate_rule and product.metadata!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ ROLLBACK due to error:", err);
    throw err;
  } finally {
    await client.end();
  }
}

backfill().catch(console.error);
