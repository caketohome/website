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

const { SalesPostingService, SalesPostingError } = require("../frontend/src/lib/services/sales-posting.service");

async function reproduce() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    await client.query("BEGIN");

    // Get branch
    const bRes = await client.query("SELECT * FROM public.branch WHERE deleted_at IS NULL LIMIT 1");
    const branch = bRes.rows[0];

    // Pick product without gst_rate in metadata: prod_5 (Butterscotch Caramel Crunch Cake)
    const pRes = await client.query("SELECT id, title, metadata FROM public.product WHERE id = 'prod_5'");
    const prod = pRes.rows[0];
    console.log("Selected product:", prod.id, prod.title, "Metadata:", prod.metadata);

    // Create test customer
    const custId = "cust_repro_test";
    await client.query(`
      INSERT INTO public.customer (id, first_name, last_name, email, phone, has_account, created_at, updated_at)
      VALUES ($1, 'Test', 'Customer', 'repro@example.com', '9999988888', true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [custId]);

    // Create an order without manually supplying tax_rate or gst_rate on the item
    const orderId = "ord_repro_missing_tax";
    const orderMetadata = {
      is_ledger_eligible: true,
      branch_id: branch.id,
      delivery_address: { state: "Karnataka", pincode: "560001" },
      payment_method: "online",
      items: [
        {
          product_id: prod.id,
          quantity: 1,
          unit_price: 599,
          // Notice: NO tax_rate or gst_rate supplied on rawItem!
        }
      ]
    };

    await client.query(`
      INSERT INTO public."order" (id, status, customer_id, email, currency_code, metadata, created_at, updated_at)
      VALUES ($1, 'completed', $2, 'repro@example.com', 'inr', $3, NOW(), NOW())
    `, [orderId, custId, JSON.stringify(orderMetadata)]);

    console.log("Attempting createSalesVoucherDraft for order with prod_5...");
    const draftRes = await SalesPostingService.createSalesVoucherDraft({
      orderId,
      createdBy: "usr_test_clerk",
      branchId: branch.id,
      client,
    });

    console.log("Result:", draftRes);

  } catch (err) {
    console.log("CAUGHT ERROR AS EXPECTED:", err.name, err.code, err.message);
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
}

reproduce().catch(console.error);
