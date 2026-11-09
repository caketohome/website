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

const { SalesPostingService } = require("../frontend/src/lib/services/sales-posting.service");

async function probe() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query("BEGIN");

  const bRes = await c.query("SELECT * FROM public.branch WHERE deleted_at IS NULL LIMIT 1");
  const branch = bRes.rows[0];

  const orderId = "ord_probe_tax_lines";
  await c.query(`
    INSERT INTO public."order" (id, status, customer_id, email, currency_code, metadata, created_at, updated_at)
    VALUES ($1, 'completed', null, 'probe@test.com', 'inr', $2, NOW(), NOW())
  `, [orderId, JSON.stringify({
    is_ledger_eligible: true,
    branch_id: branch.id,
    delivery_address: { state: "Maharashtra", pincode: "400001" },
    payment_method: "online",
    items: [{ product_id: "prod_01KXYMAJKNWZCFXJHESPTZE01G", quantity: 1, unit_price: 1000 }]
  })]);

  const draft = await SalesPostingService.createSalesVoucherDraft({ orderId, createdBy: "usr_probe", branchId: branch.id, client: c });
  const v = draft.voucher || draft.data;
  console.log("Tax calculation jurisdiction:", v.metadata?.tax_calculation?.jurisdiction);
  console.log("Proposed journal lines:");
  console.table(v.metadata?.proposed_journal_lines);

  await c.query("ROLLBACK");
  await c.end();
}

probe().catch(console.error);
