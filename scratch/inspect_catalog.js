/**
 * Bounded Catalog, Product Variant & Customer Schema Inspection Script
 * Strictly read-only, timeout-guarded (max 30s), with clean resource teardown.
 * Verified against real PostgreSQL schema (CakeToHome Medusa/ERP catalog).
 */

const fs = require('fs');
const path = require('path');

// 1. Overall script deadline (max 30 seconds - within 60s requirement)
const OVERALL_TIMEOUT_MS = 30000;
let activeClient = null;

const overallTimer = setTimeout(async () => {
  console.error(`[TIMEOUT] inspect_catalog.js exceeded overall deadline of ${OVERALL_TIMEOUT_MS}ms. Forcing exit.`);
  if (activeClient) {
    try {
      await activeClient.end();
      console.error('[inspect_catalog] Connection closed cleanly on timeout.');
    } catch {}
  }
  process.exit(1);
}, OVERALL_TIMEOUT_MS);
if (overallTimer.unref) overallTimer.unref();

function getDbUrl() {
  const candidatePaths = [
    path.join(__dirname, '../.env'),
    path.join(__dirname, '../frontend/.env'),
    path.join(__dirname, '.env'),
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'frontend/.env'),
  ];

  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const l of lines) {
        const trimmed = l.trim();
        if (trimmed.startsWith('DATABASE_URL=')) {
          let val = trimmed.substring('DATABASE_URL='.length).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          if (val) return val;
        }
      }
    }
  }

  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  throw new Error('DATABASE_URL not configured in any discovered .env or process.env.');
}

function getPgClientClass() {
  const candidateRequires = [
    'pg',
    path.join(__dirname, '../node_modules/pg'),
    path.join(__dirname, '../frontend/node_modules/pg'),
    path.join(__dirname, '../../frontend/node_modules/pg'),
  ];

  for (const candidate of candidateRequires) {
    try {
      const mod = require(candidate);
      if (mod && mod.Client) return mod.Client;
    } catch {}
  }

  throw new Error('pg module could not be loaded from standard paths.');
}

async function run() {
  console.log('[inspect_catalog] Starting bounded catalog inspection...');
  const dbUrl = getDbUrl();
  const Client = getPgClientClass();

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
  });
  activeClient = client;

  let connected = false;
  try {
    console.log('[inspect_catalog] Connecting to PostgreSQL (5s timeout)...');
    await client.connect();
    connected = true;
    console.log('[inspect_catalog] Connected successfully.');

    // 1. Inspect product_variant columns
    console.log('[inspect_catalog] Inspecting product_variant columns...');
    const pvCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'product_variant'
      ORDER BY ordinal_position;
    `);
    console.log('product_variant columns:', pvCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

    // 2. Inspect product columns
    console.log('[inspect_catalog] Inspecting product columns...');
    const pCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'product'
      ORDER BY ordinal_position;
    `);
    console.log('product columns:', pCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

    // 3. Inspect customer columns
    console.log('[inspect_catalog] Inspecting customer columns...');
    const custCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'customer'
      ORDER BY ordinal_position;
    `);
    console.log('customer columns:', custCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

    // 3b. Inspect corporate_gifting_batch columns
    const cgbCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'corporate_gifting_batch'
      ORDER BY ordinal_position;
    `);
    console.log('corporate_gifting_batch columns:', cgbCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

    // 3c. Inspect corporate_gifting_recipient columns
    const cgrCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'corporate_gifting_recipient'
      ORDER BY ordinal_position;
    `);
    console.log('corporate_gifting_recipient columns:', cgrCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

    // 3d. Inspect corporate_employee columns
    const ceCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'corporate_employee'
      ORDER BY ordinal_position;
    `);
    console.log('corporate_employee columns:', ceCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

    // 3e. Inspect delivery columns
    const delivCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'delivery'
      ORDER BY ordinal_position;
    `);
    console.log('delivery columns:', delivCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

    // 3f. Inspect corporate_delivery_assignment columns
    const cdaCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'corporate_delivery_assignment'
      ORDER BY ordinal_position;
    `);
    console.log('corporate_delivery_assignment columns:', cdaCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

    // 3g. Inspect corporate_assignment_event columns
    const caeCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'corporate_assignment_event'
      ORDER BY ordinal_position;
    `);
    console.log('corporate_assignment_event columns:', caeCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

    // 3h. Inspect invoice constraints
    const invCons = await client.query(`
      SELECT conname, conrelid::regclass as rel, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'public.invoice'::regclass;
    `);
    console.log('invoice constraints:', invCons.rows.map(r => `${r.rel}.${r.conname}: ${r.def}`).join(' | '));

    // 4. Query active product variants joined with products and VERIFIED price paths
    // REAL SCHEMA FACT: Neither product nor product_variant has a standalone 'price' column.
    // Verified pricing is stored in:
    // a) JSONB product metadata (p.metadata->>'selling_price' or p.metadata->>'price' or weight_prices)
    // b) Optional relational price_set -> price join (pv -> product_variant_price_set -> price_set -> price)
    console.log('[inspect_catalog] Querying active product variants & verified price path (metadata + relational)...');

    const verifiedCatalogQuery = `
      SELECT 
        pv.id AS variant_id,
        pv.sku,
        pv.title AS variant_title,
        p.id AS product_id,
        p.title AS product_title,
        p.merchandise_type,
        pr.amount AS relational_price_amount,
        pr.currency_code AS relational_currency,
        COALESCE(
          (p.metadata->>'selling_price')::numeric,
          (p.metadata->>'price')::numeric,
          (pv.metadata->>'selling_price')::numeric,
          (pv.metadata->>'price')::numeric,
          (
            SELECT (elem->>'selling_price')::numeric 
            FROM jsonb_array_elements(p.metadata->'weight_prices') AS elem 
            LIMIT 1
          ),
          pr.amount,
          0
        ) AS effective_price,
        COALESCE(p.metadata->>'mrp', pv.metadata->>'mrp') AS mrp,
        p.metadata AS product_meta,
        pv.metadata AS variant_meta
      FROM public.product_variant pv
      JOIN public.product p ON p.id = pv.product_id
      LEFT JOIN public.product_variant_price_set pvps ON pvps.variant_id = pv.id
      LEFT JOIN public.price pr ON pr.price_set_id = pvps.price_set_id
      WHERE p.deleted_at IS NULL AND pv.deleted_at IS NULL
      ORDER BY pv.created_at ASC
      LIMIT 10;
    `;

    const skuRes = await client.query(verifiedCatalogQuery);
    console.log(`[inspect_catalog] Found ${skuRes.rows.length} product variants with verified schema:`);
    skuRes.rows.forEach(r => {
      const metaPrice = (r.product_meta && (r.product_meta.selling_price || r.product_meta.price)) ||
                        (r.variant_meta && (r.variant_meta.selling_price || r.variant_meta.price)) || null;
      console.log(`  - SKU: ${r.sku} | Product: "${r.product_title}" | Variant: "${r.variant_title}" | Effective Price: ₹${r.effective_price} | Meta Price: ${metaPrice} | Relational: ${r.relational_price_amount || 'N/A'}`);
    });

    console.log('[inspect_catalog] All schema and catalog inspection completed successfully.');
  } catch (err) {
    console.error('[inspect_catalog] Error during database inspection:', err.message);
    process.exitCode = 1;
  } finally {
    if (connected) {
      console.log('[inspect_catalog] Closing PostgreSQL connection...');
      try {
        await client.end();
        console.log('[inspect_catalog] Connection closed cleanly.');
      } catch (closeErr) {
        console.error('[inspect_catalog] Error closing connection:', closeErr.message);
      }
    }
    activeClient = null;
  }
}

run()
  .catch((err) => {
    console.error('[inspect_catalog] Fatal execution error:', err.message);
    process.exit(1);
  })
  .then(() => {
    clearTimeout(overallTimer);
    process.exit(process.exitCode || 0);
  });
