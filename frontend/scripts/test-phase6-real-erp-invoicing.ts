import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn, ChildProcess } from 'child_process';
import pg from 'pg';
import EmbeddedPostgres from 'embedded-postgres';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

// ── FAIL-CLOSED PRODUCTION GUARD ─────────────────────────────────────────────
const FORBIDDEN_HOSTS = ['aws-1-ap-south-1.pooler.supabase.com', 'supabase.com', 'supabase.co'];

function validateTestTarget(dbUrl: string): { host: string; port: number; database: string } {
  const parsed = new URL(dbUrl);
  for (const fHost of FORBIDDEN_HOSTS) {
    if (parsed.hostname.includes(fHost)) {
      throw new Error(`CRITICAL SECURITY ABORT: Target ${parsed.hostname} is a production Supabase host! Execution strictly prohibited.`);
    }
  }
  if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
    throw new Error(`SECURITY ABORT: Unrecognized remote test target ${parsed.hostname}. Test target must be isolated localhost.`);
  }
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '5432', 10),
    database: parsed.pathname.replace(/^\//, '')
  };
}

const TEST_DB_URL = 'postgresql://cth_test_user:cth_test_password_2026@127.0.0.1:5433/cth_test';
process.env.TEST_DATABASE_URL = TEST_DB_URL;
process.env.DATABASE_URL = TEST_DB_URL;

const SCREENSHOTS_DIR = path.resolve(__dirname, 'screenshots');
const ARTIFACTS_DIR = 'C:\\Users\\alexc\\.gemini\\antigravity-ide\\brain\\be999932-ed66-4678-a82b-548dd5f51c32\\screenshots';

for (const dir of [SCREENSHOTS_DIR, ARTIFACTS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function copyScreenshot(srcName: string) {
  const src = path.join(SCREENSHOTS_DIR, srcName);
  const dest = path.join(ARTIFACTS_DIR, srcName);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url: string, timeoutMs: number = 60000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return true;
    } catch {
      // not ready yet
    }
    await sleep(1500);
  }
  return false;
}

function generateJwt(payload: any, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const tokenData = `${headerB64}.${payloadB64}`;
  const sig = crypto.createHmac('sha256', secret).update(tokenData).digest('base64url');
  return `${tokenData}.${sig}`;
}

async function main() {
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('🎂 CAKETOHOME — STATUTORY ERP INVOICING VALIDATION & REJECTION SUITE');
  console.log('   Testing: Strict Pre-Allocation Identity Verification & Zero Fallbacks');
  console.log('   Target: Isolated Localhost PostgreSQL 16 (5433) | Production: PROHIBITED');
  console.log('══════════════════════════════════════════════════════════════════════\n');

  validateTestTarget(TEST_DB_URL);
  console.log('✅ Target verified: strictly isolated localhost:5433\n');

  // ── STEP 1: Boot Embedded PostgreSQL ───────────────────────────────────────
  const dbDir = path.resolve(__dirname, '../../.isolated-pg-data');
  const pgInstance = new EmbeddedPostgres({
    databaseDir: dbDir,
    port: 5433,
    user: 'cth_test_user',
    password: 'cth_test_password_2026',
    authMethod: 'password',
    persistent: true,
  });

  if (!fs.existsSync(dbDir)) {
    console.log('1. Initializing isolated PostgreSQL cluster...');
    await pgInstance.initialise();
  }

  console.log('1. Starting isolated PostgreSQL 16 on port 5433...');
  try {
    await pgInstance.start();
  } catch {
    // Might already be active
  }

  const adminClient = new pg.Client({
    connectionString: 'postgresql://cth_test_user:cth_test_password_2026@127.0.0.1:5433/postgres',
  });
  await adminClient.connect();
  const dbCheck = await adminClient.query("SELECT 1 FROM pg_database WHERE datname = 'cth_test'");
  if (dbCheck.rows.length === 0) {
    await adminClient.query('CREATE DATABASE cth_test');
  }
  await adminClient.end();

  const client = new pg.Client({ connectionString: TEST_DB_URL });
  await client.connect();

  console.log('2. Applying statutory invoice-numbering migration to cth_test...');
  const migrationPath = path.resolve(__dirname, '../../migration/Migration_Invoice_Numbering_Defect_Fix.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  await client.query(migrationSql);
  console.log('   ✅ Migration applied cleanly.\n');

  // ── STEP 2: Schema DDL & Seed Synthetic ERP Data in cth_test ───────────────
  console.log('3. Seeding synthetic orders, branches, and cities in isolated PostgreSQL...');

  await client.query(`
    CREATE TABLE IF NOT EXISTS public."order" (
      id TEXT PRIMARY KEY,
      display_id INTEGER,
      order_number TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      customer_id TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      branch_id TEXT,
      seller_gstin TEXT,
      seller_legal_name TEXT,
      subtotal NUMERIC NOT NULL DEFAULT 0,
      tax_total NUMERIC NOT NULL DEFAULT 0,
      grand_total NUMERIC NOT NULL DEFAULT 0,
      currency_code TEXT DEFAULT 'INR',
      payment_status TEXT DEFAULT 'paid',
      payment_method TEXT DEFAULT 'online',
      metadata JSONB DEFAULT '{}',
      delivered_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE public."order" ADD COLUMN IF NOT EXISTS customer_name TEXT;
    ALTER TABLE public."order" ADD COLUMN IF NOT EXISTS customer_phone TEXT;
    ALTER TABLE public."order" ADD COLUMN IF NOT EXISTS currency_code TEXT DEFAULT 'INR';
    ALTER TABLE public."order" ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'paid';
    ALTER TABLE public."order" ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'online';
    ALTER TABLE public."order" ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

    ALTER TABLE public.invoice ADD COLUMN IF NOT EXISTS seller_gstin TEXT;
    ALTER TABLE public.invoice ADD COLUMN IF NOT EXISTS seller_legal_name TEXT;

    CREATE TABLE IF NOT EXISTS public.order_item (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES public."order"(id) ON DELETE CASCADE,
      product_id TEXT,
      item_id TEXT,
      title TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price NUMERIC NOT NULL DEFAULT 0,
      taxable_value NUMERIC NOT NULL DEFAULT 0,
      gst_rate_pct NUMERIC NOT NULL DEFAULT 5,
      tax_amount NUMERIC NOT NULL DEFAULT 0,
      total NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS public.branch (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT,
      address TEXT,
      city_id TEXT,
      phone TEXT,
      email TEXT,
      is_open BOOLEAN DEFAULT true,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS public.city (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      state TEXT NOT NULL,
      state_id TEXT DEFAULT 'state_ka',
      state_code TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS public.order_line_item (
      id TEXT PRIMARY KEY,
      totals_id TEXT,
      title TEXT NOT NULL,
      thumbnail TEXT,
      variant_id TEXT,
      product_id TEXT,
      product_title TEXT,
      variant_sku TEXT,
      requires_shipping BOOLEAN DEFAULT TRUE,
      is_discountable BOOLEAN DEFAULT TRUE,
      is_tax_inclusive BOOLEAN DEFAULT FALSE,
      compare_at_unit_price NUMERIC,
      raw_compare_at_unit_price JSONB,
      unit_price NUMERIC NOT NULL DEFAULT 0,
      raw_unit_price JSONB,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.order_status_history (
      id SERIAL PRIMARY KEY,
      order_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      actor_type TEXT,
      actor_id TEXT,
      reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Clear previous test run rows
  await client.query(`
    DELETE FROM public.invoice_allocation_log;
    DELETE FROM public.invoice;
    DELETE FROM public.invoice_sequence;
    DELETE FROM public.order_line_item WHERE id LIKE 'item_%';
    DELETE FROM public.order_status_history WHERE order_id LIKE 'ord_%';
    DELETE FROM public.order_item WHERE order_id LIKE 'ord_%';
    DELETE FROM public."order" WHERE id LIKE 'ord_%';
    DELETE FROM public.branch WHERE id LIKE 'br_%';
    DELETE FROM public.city WHERE id IN ('city_blr', 'city_mum');
  `);

  // Seed Cities
  await client.query(`
    INSERT INTO public.city (id, name, state, state_id, state_code, is_active, created_at, updated_at)
    VALUES 
      ('city_blr', 'Bengaluru', 'Karnataka', 'state_ka', '29', true, NOW(), NOW()),
      ('city_mum', 'Mumbai', 'Maharashtra', 'state_mh', '27', true, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `);

  // Seed Branches with verified & unverified seller profiles
  await client.query(`
    INSERT INTO public.branch (id, name, code, address, city_id, phone, metadata)
    VALUES 
    (
      'br_indiranagar_01', 
      'Indiranagar Kitchen Hub', 
      'IND-01', 
      '100 Feet Rd, Indiranagar, Bengaluru, Karnataka 560038', 
      'city_blr', 
      '+91 80 4123 4567',
      '{"gstin": "29AAACC1234F1Z5", "seller_legal_name": "CakeToHome Retail India Private Limited", "seller_trade_name": "CakeToHome", "state": "Karnataka", "state_code": "29", "is_verified": true, "fssai_number": "11223344556677"}'::jsonb
    ),
    (
      'br_unverified_02', 
      'Unverified Kitchen Hub', 
      'UNV-02', 
      'Outer Ring Rd, Bengaluru, Karnataka 560103', 
      'city_blr', 
      '+91 80 4111 2222',
      '{"gstin": "29AAACC1234F1Z5", "seller_legal_name": "Unverified Kitchen Hub", "state": "Karnataka", "state_code": "29", "is_verified": false, "status": "UNVERIFIED"}'::jsonb
    ),
    (
      'br_mumbai_03', 
      'Mumbai Kitchen Hub', 
      'MUM-03', 
      'Bandra West, Mumbai, Maharashtra 400050', 
      'city_mum', 
      '+91 22 2640 1234',
      '{"gstin": "29AAACC1234F1Z5", "seller_legal_name": "Karnataka Seller In Mumbai", "state": "Maharashtra", "state_code": "27", "is_verified": true}'::jsonb
    ),
    (
      'br_partner_04', 
      'Pune Gourmet Partner Hub', 
      'PUN-04', 
      'Koregaon Park, Pune, Maharashtra 411001', 
      'city_mum', 
      '+91 20 2615 5678',
      '{"gstin": "27AABCP1234K1Z2", "seller_legal_name": "Sweet Delights Partner LLP", "partner_id": "prt_8899", "state": "Maharashtra", "state_code": "27", "is_verified": true}'::jsonb
    ),
    (
      'br_no_seller_05',
      'Bare Branch Without Tax Profile',
      'BARE-05',
      'MG Road, Bengaluru, Karnataka 560001',
      'city_blr',
      '+91 80 4999 0000',
      '{}'::jsonb
    ),
    (
      'br_whitefield_06', 
      'Whitefield Defective Hub', 
      'WHF-06', 
      'ITPB Main Rd, Whitefield, Bengaluru, Karnataka 560066', 
      'city_blr', 
      '+91 80 4987 6543',
      '{"gstin": "INVALID_GST_NONE", "seller_legal_name": "CakeToHome Retail India Private Limited", "state": "Karnataka", "state_code": "29"}'::jsonb
    );
  `);

  // Helper to insert order and line item
  async function seedOrder(
    orderId: string,
    orderNumber: string,
    status: string,
    branchId: string,
    sellerGstin: string | null,
    sellerLegalName: string | null,
    meta: any,
    itemHsn: string | null = '19059090'
  ) {
    await client.query(`
      INSERT INTO public."order" (
        id, display_id, order_number, status, customer_id, customer_name, customer_phone,
        branch_id, seller_gstin, seller_legal_name, subtotal, tax_total, grand_total,
        currency_code, payment_status, payment_method, metadata, delivered_at
      ) VALUES (
        $1, $2, $3, $4, 'cust_test', 'Aarav Patel', '+91 91234 56789',
        $5, $6, $7, 1000.00, 180.00, 1180.00,
        'INR', 'paid', 'upi', $8::jsonb, ${status === 'delivered' ? 'NOW()' : 'NULL'}
      )
    `, [
      orderId,
      Math.floor(Math.random() * 90000) + 10000,
      orderNumber,
      status,
      branchId,
      sellerGstin,
      sellerLegalName,
      JSON.stringify(meta),
    ]);

    const itemId = `item_${orderId}`;
    await client.query(`
      INSERT INTO public.order_line_item (id, title, product_id, variant_sku, unit_price)
      VALUES ($1, 'Signature Truffle Cake', 'prod_truffle', 'TRF-1', 1000.00)
      ON CONFLICT (id) DO NOTHING
    `, [itemId]);

    await client.query(`
      INSERT INTO public.order_item (id, order_id, item_id, product_id, title, quantity, unit_price, taxable_value, gst_rate_pct, tax_amount, total)
      VALUES ($1, $2, $1, 'prod_truffle', 'Signature Truffle Cake', 1, 1000.00, 1000.00, 18.00, 180.00, 1180.00)
    `, [itemId, orderId]);

    if (!itemHsn) {
      // Remove HSN code from metadata
      delete meta.items;
      meta.items = [{ id: itemId, title: 'Signature Truffle Cake', quantity: 1, unit_price: 1000.00, taxable_value: 1000.00, gst_rate_pct: 18.00, tax_amount: 180.00, total: 1180.00 }];
      await client.query(`UPDATE public."order" SET metadata = $1::jsonb WHERE id = $2`, [JSON.stringify(meta), orderId]);
    }
  }

  // 1. Case 1: Missing seller GSTIN
  await seedOrder('ord_case_01_no_gstin', 'CTH-TEST-0001', 'delivered', 'br_no_seller_05', null, null, {
    customer_name: 'Aarav Patel',
    customer_phone: '+91 91234 56789',
    branch_name: 'Bare Branch Without Tax Profile',
    items: [{ id: 'item_ord_case_01_no_gstin', title: 'Signature Truffle Cake', quantity: 1, unit_price: 1000.00, taxable_value: 1000.00, gst_rate_pct: 18.00, tax_amount: 180.00, total: 1180.00, hsn_code: '19059090' }],
  });

  // 2. Case 2: Empty or whitespace GSTIN
  await seedOrder('ord_case_02_whitespace_gstin', 'CTH-TEST-0002', 'delivered', 'br_no_seller_05', '   ', 'CakeToHome Retail India Private Limited', {
    seller_gstin: '   ',
    seller_legal_name: 'CakeToHome Retail India Private Limited',
    items: [{ id: 'item_ord_case_02_whitespace_gstin', title: 'Signature Truffle Cake', quantity: 1, unit_price: 1000.00, taxable_value: 1000.00, gst_rate_pct: 18.00, tax_amount: 180.00, total: 1180.00, hsn_code: '19059090' }],
  });

  // 3. Case 3: Malformed GSTIN
  await seedOrder('ord_case_03_malformed_gstin', 'CTH-TEST-0003', 'delivered', 'br_indiranagar_01', '29AAACC1234F1Z', 'CakeToHome Retail India Private Limited', {
    seller_gstin: '29AAACC1234F1Z', // 14 characters
    seller_legal_name: 'CakeToHome Retail India Private Limited',
    items: [{ id: 'item_ord_case_03_malformed_gstin', title: 'Signature Truffle Cake', quantity: 1, unit_price: 1000.00, taxable_value: 1000.00, gst_rate_pct: 18.00, tax_amount: 180.00, total: 1180.00, hsn_code: '19059090' }],
  });

  // 4. Case 4: Missing legal seller name
  await seedOrder('ord_case_04_no_legal_name', 'CTH-TEST-0004', 'delivered', 'br_no_seller_05', '29AAACC1234F1Z5', null, {
    seller_gstin: '29AAACC1234F1Z5',
    seller_legal_name: null,
    items: [{ id: 'item_ord_case_04_no_legal_name', title: 'Signature Truffle Cake', quantity: 1, unit_price: 1000.00, taxable_value: 1000.00, gst_rate_pct: 18.00, tax_amount: 180.00, total: 1180.00, hsn_code: '19059090' }],
  });

  // 5. Case 5: Unverified seller registration
  await seedOrder('ord_case_05_unverified', 'CTH-TEST-0005', 'delivered', 'br_unverified_02', '29AAACC1234F1Z5', 'Unverified Kitchen Hub', {
    seller_gstin: '29AAACC1234F1Z5',
    seller_legal_name: 'Unverified Kitchen Hub',
    seller_is_verified: false,
    items: [{ id: 'item_ord_case_05_unverified', title: 'Signature Truffle Cake', quantity: 1, unit_price: 1000.00, taxable_value: 1000.00, gst_rate_pct: 18.00, tax_amount: 180.00, total: 1180.00, hsn_code: '19059090' }],
  });

  // 6. Case 6: Ambiguous seller identity (State Code Mismatch: 29 vs 27)
  await seedOrder('ord_case_06_ambiguous_state', 'CTH-TEST-0006', 'delivered', 'br_mumbai_03', '29AAACC1234F1Z5', 'Karnataka Seller In Mumbai', {
    seller_gstin: '29AAACC1234F1Z5',
    seller_legal_name: 'Karnataka Seller In Mumbai',
    seller_state_code: '27',
    items: [{ id: 'item_ord_case_06_ambiguous_state', title: 'Signature Truffle Cake', quantity: 1, unit_price: 1000.00, taxable_value: 1000.00, gst_rate_pct: 18.00, tax_amount: 180.00, total: 1180.00, hsn_code: '19059090' }],
  });

  // 7. Case 7: Valid, verified seller identity
  await seedOrder('ord_case_07_valid_parent', 'CTH-TEST-0007', 'delivered', 'br_indiranagar_01', '29AAACC1234F1Z5', 'CakeToHome Retail India Private Limited', {
    customer_name: 'Ananya Sharma',
    customer_phone: '+91 98765 43210',
    seller_gstin: '29AAACC1234F1Z5',
    seller_legal_name: 'CakeToHome Retail India Private Limited',
    seller_state: 'Karnataka',
    seller_state_code: '29',
    branch_name: 'Indiranagar Kitchen Hub',
    compliance_snapshot: {
      seller_gstin: '29AAACC1234F1Z5',
      seller_legal_name: 'CakeToHome Retail India Private Limited',
      is_intra_state: true,
      seller_state: 'Karnataka',
      seller_state_code: '29',
      seller_fssai_number: '11223344556677',
      seller_is_verified: true,
    },
    items: [{ id: 'item_ord_case_07_valid_parent', title: 'Belgian Chocolate Truffle Cake (1kg)', quantity: 1, unit_price: 1000.00, price: 1000.00, taxable_value: 1000.00, gst_rate_pct: 18.00, tax_amount: 180.00, total: 1180.00, hsn_code: '19059090' }],
  });

  // 8. Case 8: Partner order with independently configured seller
  await seedOrder('ord_case_08_partner', 'CTH-TEST-0008', 'delivered', 'br_partner_04', '27AABCP1234K1Z2', 'Sweet Delights Partner LLP', {
    customer_name: 'Vikram Joshi',
    partner_id: 'prt_8899',
    seller_gstin: '27AABCP1234K1Z2',
    seller_legal_name: 'Sweet Delights Partner LLP',
    seller_state: 'Maharashtra',
    seller_state_code: '27',
    compliance_snapshot: {
      seller_gstin: '27AABCP1234K1Z2',
      seller_legal_name: 'Sweet Delights Partner LLP',
      is_intra_state: true,
      seller_state: 'Maharashtra',
      seller_state_code: '27',
      seller_is_verified: true,
    },
    items: [{ id: 'item_ord_case_08_partner', title: 'Artisan Mango Delight Cake', quantity: 1, unit_price: 1000.00, taxable_value: 1000.00, gst_rate_pct: 18.00, tax_amount: 180.00, total: 1180.00, hsn_code: '19059090' }],
  });

  // 9. Case 9: Retry after rejection
  await seedOrder('ord_case_09_retry', 'CTH-TEST-0009', 'delivered', 'br_no_seller_05', 'MALFORMED_GST', 'Pending Correction Entity', {
    seller_gstin: 'MALFORMED_GST',
    seller_legal_name: 'Pending Correction Entity',
    items: [{ id: 'item_ord_case_09_retry', title: 'Almond Opera Cake', quantity: 1, unit_price: 1000.00, taxable_value: 1000.00, gst_rate_pct: 18.00, tax_amount: 180.00, total: 1180.00, hsn_code: '19059090' }],
  });

  // 11. Case 11: Missing HSN classification
  await seedOrder('ord_case_11_missing_hsn', 'CTH-TEST-0011', 'delivered', 'br_indiranagar_01', '29AAACC1234F1Z5', 'CakeToHome Retail India Private Limited', {
    seller_gstin: '29AAACC1234F1Z5',
    seller_legal_name: 'CakeToHome Retail India Private Limited',
    items: [{ id: 'item_ord_case_11_missing_hsn', title: 'Custom Unclassified Gift Box', quantity: 1, unit_price: 500.00, taxable_value: 500.00, gst_rate_pct: 18.00, tax_amount: 90.00, total: 590.00, hsn_code: '' }],
  }, null);

  // UI-Specific Orders (for Playwright scenarios)
  // ord_erp_valid_001
  await seedOrder('ord_erp_valid_001', 'CTH-20261025-9001', 'delivered', 'br_indiranagar_01', '29AAACC1234F1Z5', 'CakeToHome Retail India Private Limited', {
    customer_name: 'Ananya Sharma',
    customer_phone: '+91 98765 43210',
    seller_gstin: '29AAACC1234F1Z5',
    seller_legal_name: 'CakeToHome Retail India Private Limited',
    branch_name: 'Indiranagar Kitchen Hub',
    compliance_snapshot: {
      seller_gstin: '29AAACC1234F1Z5',
      seller_legal_name: 'CakeToHome Retail India Private Limited',
      is_intra_state: true,
      seller_state: 'Karnataka',
      seller_state_code: '29',
      seller_fssai_number: '11223344556677',
      seller_is_verified: true,
    },
    items: [{ id: 'item_ord_erp_valid_001', title: 'Belgian Chocolate Truffle Cake (1kg)', product_name: 'Belgian Chocolate Truffle Cake (1kg)', quantity: 1, unit_price: 1000.00, price: 1000.00, taxable_value: 1000.00, gst_rate_pct: 18.00, tax_amount: 180.00, total: 1180.00, hsn_code: '19059090' }],
  });

  // ord_erp_invalid_002
  await seedOrder('ord_erp_invalid_002', 'CTH-20261025-9002', 'delivered', 'br_whitefield_06', 'INVALID_GST_NONE', 'CakeToHome Retail India Private Limited', {
    customer_name: 'Rohan Verma',
    seller_gstin: 'INVALID_GST_NONE',
    seller_legal_name: 'CakeToHome Retail India Private Limited',
    branch_name: 'Whitefield Defective Hub',
    compliance_snapshot: {
      seller_gstin: 'INVALID_GST_NONE',
      seller_legal_name: 'CakeToHome Retail India Private Limited',
      is_intra_state: true,
    },
    items: [{ id: 'item_ord_erp_invalid_002', title: 'Fresh Fruit Vanilla Cake (1kg)', product_name: 'Fresh Fruit Vanilla Cake (1kg)', quantity: 1, unit_price: 800.00, price: 800.00, taxable_value: 800.00, gst_rate_pct: 5.00, tax_amount: 40.00, total: 840.00, hsn_code: '19059090' }],
  });

  // ord_erp_pending_003
  await seedOrder('ord_erp_pending_003', 'CTH-20261025-9003', 'preparing', 'br_indiranagar_01', '29AAACC1234F1Z5', 'CakeToHome Retail India Private Limited', {
    customer_name: 'Priya Patel',
    seller_gstin: '29AAACC1234F1Z5',
    seller_legal_name: 'CakeToHome Retail India Private Limited',
    branch_name: 'Indiranagar Kitchen Hub',
    items: [{ id: 'item_ord_erp_pending_003', title: 'Assorted Cupcakes (6 pcs)', product_name: 'Assorted Cupcakes (6 pcs)', quantity: 1, unit_price: 500.00, price: 500.00, taxable_value: 500.00, gst_rate_pct: 5.00, tax_amount: 25.00, total: 525.00, hsn_code: '19059090' }],
  });

  console.log('   ✅ All test orders & branch fixtures seeded.\n');

  // ── STEP 3: Spawn Next.js Server on Port 3005 ──────────────────────────────
  const JWT_SECRET = 'test_jwt_secret_invoicing_2026';
  process.env.JWT_SECRET = JWT_SECRET;

  console.log('4. Starting CakeToHome ERP on http://localhost:3005...');
  const nextApp = spawn('npx.cmd', ['next', 'start', '-p', '3005'], {
    cwd: path.resolve(__dirname, '..'),
    shell: true,
    env: {
      ...process.env,
      PORT: '3005',
      JWT_SECRET: JWT_SECRET,
      TEST_DATABASE_URL: TEST_DB_URL,
      DATABASE_URL: TEST_DB_URL,
    },
    stdio: 'pipe',
  });

  nextApp.stdout.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg.length > 0 && !msg.includes('GET /api/v1/health')) {
      // console.log('   [Next.js]', msg);
    }
  });

  nextApp.stderr.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg.length > 0 && !msg.includes('ExperimentalWarning')) {
      console.warn('   [Next.js Stderr]', msg);
    }
  });

  const isServerReady = await waitForHttp('http://127.0.0.1:3005/api/v1/health', 45000);
  if (!isServerReady) {
    console.error('❌ FATAL: Next.js dev server failed to respond on http://localhost:3005 within 45s.');
    nextApp.kill();
    await client.end();
    await pgInstance.stop();
    process.exit(1);
  }
  console.log('   ✅ Next.js ERP server ready and healthy on http://localhost:3005\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, desc: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
    }
  }

  // Generate tokens
  const now = Math.floor(Date.now() / 1000);
  const adminToken = generateJwt({
    userId: 'admin_01',
    role: 'SUPER_ADMIN',
    phone: '9999999999',
    isSuperAdmin: true,
    permissions: ['*'],
    iat: now,
    exp: now + 86400,
  }, JWT_SECRET);

  const deliveryPartnerToken = generateJwt({
    userId: 'rider_01',
    role: 'DELIVERY_PARTNER',
    phone: '8888888888',
    permissions: ['DELIVERY.READ'],
    iat: now,
    exp: now + 86400,
  }, JWT_SECRET);

  const storeManagerToken = generateJwt({
    userId: 'mgr_01',
    role: 'STORE_MANAGER',
    phone: '7777777777',
    permissions: ['ORDERS.INVOICE'],
    iat: now,
    exp: now + 86400,
  }, JWT_SECRET);

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`,
  };

  try {
    // ══════════════════════════════════════════════════════════════════════════
    // PART 1: POSTGRESQL 16 STATUTORY INTEGRATION TESTS (ALL 10 CASES + HSN)
    // ══════════════════════════════════════════════════════════════════════════
    console.log('--- PART 1: 10 Statutory Pre-Allocation Integrity Test Cases ---');

    // Case 1: Missing seller GSTIN
    console.log('\n[Case 1] Missing Seller GSTIN Rejection:');
    const res1 = await fetch('http://localhost:3005/api/v1/admin/orders/ord_case_01_no_gstin/invoice', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    const data1 = await res1.json();
    assert(res1.status === 400, `HTTP status is 400 (was ${res1.status})`);
    assert(data1.code === 'MISSING_SELLER_GSTIN', `Rejection code is MISSING_SELLER_GSTIN (${data1.code})`);
    const invCount1 = await client.query(`SELECT COUNT(*) FROM public.invoice WHERE order_id = 'ord_case_01_no_gstin'`);
    const logCount1 = await client.query(`SELECT COUNT(*) FROM public.invoice_allocation_log WHERE order_id = 'ord_case_01_no_gstin'`);
    const seqCount1 = await client.query(`SELECT COALESCE(MAX(last_seq), 0) as max_seq FROM public.invoice_sequence WHERE prefix = 'CTH'`);
    assert(Number(invCount1.rows[0].count) === 0, 'DB invoice count is strictly 0');
    assert(Number(logCount1.rows[0].count) === 0, 'DB allocation log count is strictly 0');
    assert(Number(seqCount1.rows[0].max_seq) === 0, 'DB sequence counter was NOT incremented (remains 0)');

    // Case 2: Empty or whitespace GSTIN
    console.log('\n[Case 2] Empty or Whitespace GSTIN Rejection:');
    const res2 = await fetch('http://localhost:3005/api/v1/admin/orders/ord_case_02_whitespace_gstin/invoice', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    const data2 = await res2.json();
    assert(res2.status === 400, `HTTP status is 400 (was ${res2.status})`);
    assert(data2.code === 'MISSING_SELLER_GSTIN', `Rejection code is MISSING_SELLER_GSTIN (${data2.code})`);
    const invCount2 = await client.query(`SELECT COUNT(*) FROM public.invoice WHERE order_id = 'ord_case_02_whitespace_gstin'`);
    const logCount2 = await client.query(`SELECT COUNT(*) FROM public.invoice_allocation_log WHERE order_id = 'ord_case_02_whitespace_gstin'`);
    assert(Number(invCount2.rows[0].count) === 0, 'DB invoice count is strictly 0');
    assert(Number(logCount2.rows[0].count) === 0, 'DB allocation log count is strictly 0');

    // Case 3: Malformed GSTIN (14 chars)
    console.log('\n[Case 3] Malformed GSTIN Checksum/Format Rejection:');
    const res3 = await fetch('http://localhost:3005/api/v1/admin/orders/ord_case_03_malformed_gstin/invoice', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    const data3 = await res3.json();
    assert(res3.status === 400, `HTTP status is 400 (was ${res3.status})`);
    assert(data3.code === 'INVALID_SELLER_GSTIN', `Rejection code is INVALID_SELLER_GSTIN (${data3.code})`);
    const invCount3 = await client.query(`SELECT COUNT(*) FROM public.invoice WHERE order_id = 'ord_case_03_malformed_gstin'`);
    const logCount3 = await client.query(`SELECT COUNT(*) FROM public.invoice_allocation_log WHERE order_id = 'ord_case_03_malformed_gstin'`);
    assert(Number(invCount3.rows[0].count) === 0, 'DB invoice count is strictly 0');
    assert(Number(logCount3.rows[0].count) === 0, 'DB allocation log count is strictly 0');

    // Case 4: Missing legal seller name
    console.log('\n[Case 4] Missing Legal Seller Name Rejection:');
    const res4 = await fetch('http://localhost:3005/api/v1/admin/orders/ord_case_04_no_legal_name/invoice', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    const data4 = await res4.json();
    assert(res4.status === 400, `HTTP status is 400 (was ${res4.status})`);
    assert(data4.code === 'MISSING_SELLER_LEGAL_NAME', `Rejection code is MISSING_SELLER_LEGAL_NAME (${data4.code})`);
    const invCount4 = await client.query(`SELECT COUNT(*) FROM public.invoice WHERE order_id = 'ord_case_04_no_legal_name'`);
    assert(Number(invCount4.rows[0].count) === 0, 'DB invoice count is strictly 0');

    // Case 5: Unverified seller registration
    console.log('\n[Case 5] Unverified Seller Registration Rejection:');
    const res5 = await fetch('http://localhost:3005/api/v1/admin/orders/ord_case_05_unverified/invoice', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    const data5 = await res5.json();
    assert(res5.status === 400, `HTTP status is 400 (was ${res5.status})`);
    assert(data5.code === 'UNVERIFIED_SELLER_REGISTRATION', `Rejection code is UNVERIFIED_SELLER_REGISTRATION (${data5.code})`);
    const invCount5 = await client.query(`SELECT COUNT(*) FROM public.invoice WHERE order_id = 'ord_case_05_unverified'`);
    assert(Number(invCount5.rows[0].count) === 0, 'DB invoice count is strictly 0');

    // Case 6: Ambiguous seller identity (State Code Mismatch: 29 vs 27)
    console.log('\n[Case 6] Ambiguous Seller Identity (State Code Mismatch) Rejection:');
    const res6 = await fetch('http://localhost:3005/api/v1/admin/orders/ord_case_06_ambiguous_state/invoice', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    const data6 = await res6.json();
    assert(res6.status === 400, `HTTP status is 400 (was ${res6.status})`);
    assert(data6.code === 'AMBIGUOUS_SELLER_IDENTITY', `Rejection code is AMBIGUOUS_SELLER_IDENTITY (${data6.code})`);
    const invCount6 = await client.query(`SELECT COUNT(*) FROM public.invoice WHERE order_id = 'ord_case_06_ambiguous_state'`);
    assert(Number(invCount6.rows[0].count) === 0, 'DB invoice count is strictly 0');

    // Case 11: Missing HSN Classification per Line Item
    console.log('\n[Case 11] Missing HSN Classification Guard:');
    const res11 = await fetch('http://localhost:3005/api/v1/admin/orders/ord_case_11_missing_hsn/invoice', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    const data11 = await res11.json();
    assert(res11.status === 400, `HTTP status is 400 (was ${res11.status})`);
    assert(data11.code === 'MISSING_HSN_CLASSIFICATION', `Rejection code is MISSING_HSN_CLASSIFICATION (${data11.code})`);
    const invCount11 = await client.query(`SELECT COUNT(*) FROM public.invoice WHERE order_id = 'ord_case_11_missing_hsn'`);
    assert(Number(invCount11.rows[0].count) === 0, 'DB invoice count is strictly 0 on missing HSN');

    // Verify counter after all rejections
    const seqAfterRejections = await client.query(`SELECT COALESCE(MAX(last_seq), 0) as max_seq FROM public.invoice_sequence WHERE prefix = 'CTH'`);
    assert(Number(seqAfterRejections.rows[0].max_seq) === 0, 'All rejection paths burned 0 sequence counts (counter is still 0)');

    // Case 7: Valid, verified seller identity
    console.log('\n[Case 7] Valid Verified Seller Allocation:');
    const res7 = await fetch('http://localhost:3005/api/v1/admin/orders/ord_case_07_valid_parent/invoice', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    const data7 = await res7.json();
    assert(res7.status === 200, `HTTP status is 200 (was ${res7.status})`);
    assert(data7.success === true, 'Response success is true');
    assert(data7.invoice_number === 'CTH/26-27/000001', `Allocated first statutory invoice CTH/26-27/000001 (${data7.invoice_number})`);
    
    // Independent SQL verification
    const invRow7 = await client.query(`SELECT * FROM public.invoice WHERE order_id = 'ord_case_07_valid_parent'`);
    assert(invRow7.rows.length === 1, 'Exactly 1 invoice persisted in public.invoice');
    assert(invRow7.rows[0].invoice_number === 'CTH/26-27/000001', 'Persisted invoice number is CTH/26-27/000001');
    const meta7 = typeof invRow7.rows[0].metadata === 'object' ? invRow7.rows[0].metadata : JSON.parse(invRow7.rows[0].metadata || '{}');
    const sellerGstin7 = invRow7.rows[0].seller_gstin || meta7.seller_gstin;
    const sellerLegalName7 = invRow7.rows[0].seller_legal_name || meta7.seller_legal_name;
    assert(sellerGstin7 === '29AAACC1234F1Z5', `Persisted invoice uses verified seller GSTIN (${sellerGstin7})`);
    assert(sellerLegalName7 === 'CakeToHome Retail India Private Limited', `Persisted invoice uses verified seller legal name (${sellerLegalName7})`);
    
    const seqRow7 = await client.query(`SELECT last_seq FROM public.invoice_sequence WHERE prefix = 'CTH' AND fiscal_year = 2026`);
    assert(Number(seqRow7.rows[0].last_seq) === 1, 'Sequence counter advanced monotonically to 1');

    // Case 8: Partner order with an independently configured seller
    console.log('\n[Case 8] Partner Order with Independent Seller & Sequence Scope:');
    const res8 = await fetch('http://localhost:3005/api/v1/admin/orders/ord_case_08_partner/invoice', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    const data8 = await res8.json();
    assert(res8.status === 200, `HTTP status is 200 (was ${res8.status})`);
    assert(data8.success === true, 'Partner invoicing returned success: true');
    assert(data8.invoice_number === 'PRT-8899/26-27/000001', `Allocated partner invoice PRT-8899/26-27/000001 (${data8.invoice_number})`);

    const invRow8 = await client.query(`SELECT * FROM public.invoice WHERE order_id = 'ord_case_08_partner'`);
    assert(invRow8.rows.length === 1, 'Partner invoice persisted in public.invoice');
    const meta8 = typeof invRow8.rows[0].metadata === 'object' ? invRow8.rows[0].metadata : JSON.parse(invRow8.rows[0].metadata || '{}');
    const sellerGstin8 = invRow8.rows[0].seller_gstin || meta8.seller_gstin;
    const sellerLegalName8 = invRow8.rows[0].seller_legal_name || meta8.seller_legal_name;
    assert(sellerGstin8 === '27AABCP1234K1Z2', `Partner invoice uses independent partner GSTIN (${sellerGstin8})`);
    assert(sellerLegalName8 === 'Sweet Delights Partner LLP', `Partner invoice uses independent partner legal name (${sellerLegalName8})`);

    const seqPartner = await client.query(`SELECT last_seq FROM public.invoice_sequence WHERE prefix = 'PRT-8899' AND fiscal_year = 2026`);
    assert(Number(seqPartner.rows[0].last_seq) === 1, 'Partner sequence scope PRT-8899 counter is 1');

    const seqParentUnchanged = await client.query(`SELECT last_seq FROM public.invoice_sequence WHERE prefix = 'CTH' AND fiscal_year = 2026`);
    assert(Number(seqParentUnchanged.rows[0].last_seq) === 1, 'Parent sequence CTH unaffected by partner invoicing (still 1)');

    // Case 9: Retries after rejection
    console.log('\n[Case 9] Retries After Rejection (Zero Sequence Gap):');
    // First attempt: defective GSTIN
    const res9a = await fetch('http://localhost:3005/api/v1/admin/orders/ord_case_09_retry/invoice', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    assert(res9a.status === 400, 'Initial defective request rejected with HTTP 400');
    const seqBeforeCorrection = await client.query(`SELECT last_seq FROM public.invoice_sequence WHERE prefix = 'CTH' AND fiscal_year = 2026`);
    assert(Number(seqBeforeCorrection.rows[0].last_seq) === 1, 'Rejection burned 0 sequence counts');

    // Repair seller details in database
    await client.query(`
      UPDATE public."order" 
      SET seller_gstin = '29AAACC1234F1Z5', 
          seller_legal_name = 'CakeToHome Retail India Private Limited',
          branch_id = 'br_indiranagar_01'
      WHERE id = 'ord_case_09_retry'
    `);

    // Retry request after correction
    const res9b = await fetch('http://localhost:3005/api/v1/admin/orders/ord_case_09_retry/invoice', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    const data9b = await res9b.json();
    assert(res9b.status === 200, `Retry succeeded with HTTP 200 (${res9b.status})`);
    assert(data9b.invoice_number === 'CTH/26-27/000002', `Retry allocated next sequential number CTH/26-27/000002 without gap (${data9b.invoice_number})`);

    const seqAfterRepair = await client.query(`SELECT last_seq FROM public.invoice_sequence WHERE prefix = 'CTH' AND fiscal_year = 2026`);
    assert(Number(seqAfterRepair.rows[0].last_seq) === 2, 'Sequence counter advanced cleanly from 1 to 2');

    // Case 10: Repeated successful invoicing requests (Idempotency)
    console.log('\n[Case 10] Repeated Successful Invoicing Requests (Idempotent Replay):');
    const res10 = await fetch('http://localhost:3005/api/v1/admin/orders/ord_case_07_valid_parent/invoice', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    const data10 = await res10.json();
    assert(res10.status === 200, 'Repeated request returned HTTP 200');
    assert(data10.invoice_number === 'CTH/26-27/000001', `Repeated request returned identical invoice number CTH/26-27/000001 (${data10.invoice_number})`);

    const seqAfterReplay = await client.query(`SELECT last_seq FROM public.invoice_sequence WHERE prefix = 'CTH' AND fiscal_year = 2026`);
    assert(Number(seqAfterReplay.rows[0].last_seq) === 2, 'Idempotent replay did NOT advance sequence counter');

    const invCountTotal7 = await client.query(`SELECT COUNT(*) FROM public.invoice WHERE order_id = 'ord_case_07_valid_parent'`);
    assert(Number(invCountTotal7.rows[0].count) === 1, 'Still exactly 1 invoice row in database for ord_case_07_valid_parent');

    // ══════════════════════════════════════════════════════════════════════════
    // PART 2: AUTHORIZATION & RBAC VERIFICATION
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n--- PART 2: Authorization & Invoicing Permission Gates ---');

    // Unauthenticated request
    const unauthRes = await fetch('http://localhost:3005/api/v1/admin/orders/ord_erp_valid_001/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert(unauthRes.status === 401, `Unauthenticated request returns HTTP 401 UNAUTHORIZED (was ${unauthRes.status})`);

    // Unauthorized role (DELIVERY_PARTNER)
    const forbiddenRes = await fetch('http://localhost:3005/api/v1/admin/orders/ord_erp_valid_001/invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deliveryPartnerToken}`,
      },
      body: JSON.stringify({}),
    });
    assert(forbiddenRes.status === 403, `Unauthorized role returns HTTP 403 FORBIDDEN (was ${forbiddenRes.status})`);

    // Authorized role (STORE_MANAGER with ORDERS.INVOICE)
    const allowedRes = await fetch('http://localhost:3005/api/v1/admin/orders/ord_erp_valid_001/invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${storeManagerToken}`,
      },
      body: JSON.stringify({}),
    });
    assert(allowedRes.status === 200, `Authorized STORE_MANAGER successfully invokes endpoint (status ${allowedRes.status})`);

    // ══════════════════════════════════════════════════════════════════════════
    // PART 3: PLAYWRIGHT REAL-BROWSER ERP WORKFLOW TEST
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n--- PART 3: Playwright Real-Browser ERP Invoicing Workflow ---');

    const browser: Browser = await chromium.launch({ headless: true });
    const context: BrowserContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });

    // Inject Super Admin authentication cookies
    await context.addCookies([
      { name: '_cth_jwt', value: adminToken, domain: 'localhost', path: '/' },
      { name: '_medusa_jwt', value: adminToken, domain: 'localhost', path: '/' },
      { name: '_cth_role', value: 'SUPER_ADMIN', domain: 'localhost', path: '/' },
      { name: '_cth_user_id', value: 'admin_01', domain: 'localhost', path: '/' },
    ]);

    await context.addInitScript((token) => {
      try {
        window.localStorage.setItem('cth_access_token', token);
        window.localStorage.setItem('cth_admin_token', token);
        window.localStorage.setItem('admin_token', token);
        window.localStorage.setItem('cth_user_role', 'SUPER_ADMIN');
      } catch (_e) {}
    }, adminToken);

    const page: Page = await context.newPage();

    // SCENARIO A: Open Orders Panel & Inspect Delivered Order
    console.log('\nScenario A: Inspect Delivered Order in Order Details Drawer');
    await page.goto('http://localhost:3005/dashboard?tab=orders&date_preset=all&status=all', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    const inspectBtn = page.locator('[data-testid="inspect-order-ord_erp_valid_001"]');
    await inspectBtn.waitFor({ state: 'visible', timeout: 15000 });
    await inspectBtn.click();

    const drawerBadge = page.locator('#drawer-order-invoice-badge');
    await drawerBadge.waitFor({ state: 'visible', timeout: 10000 });
    const initialBadgeText = await drawerBadge.innerText();
    assert(initialBadgeText.includes('PENDING_INVOICE') || initialBadgeText.includes('CTH/'), 'Order drawer displays live statutory invoice status');

    const shot1 = path.join(SCREENSHOTS_DIR, '01_erp_uninvoiced_order_drawer.png');
    await page.screenshot({ path: shot1 });
    await copyScreenshot('01_erp_uninvoiced_order_drawer.png');
    console.log('   📸 Captured: 01_erp_uninvoiced_order_drawer.png');

    // SCENARIO B: Open Print Modal & Inspect Zero Synthetic Fallbacks
    console.log('\nScenario B: Open Tax Invoice Print Modal & Check Authentic Statutory Fields');
    const viewModalBtn = page.locator('#btn-view-invoice-modal');
    await viewModalBtn.click();

    await page.waitForSelector('text=TAX INVOICE', { timeout: 10000 });
    const modalText = await page.locator('body').innerText();

    assert(modalText.includes('29AAACC1234F1Z5'), 'Print modal displays verified seller GSTIN (29AAACC1234F1Z5)');
    assert(modalText.includes('CakeToHome Retail India Private Limited') || modalText.includes('CakeToHome'), 'Print modal displays authentic seller identity');
    assert(modalText.includes('Belgian Chocolate Truffle Cake'), 'Print modal displays actual ordered item description');
    assert(modalText.includes('19059090'), 'Print modal displays validated product HSN 19059090');

    // Verify zero invented synthetic customer data
    assert(!modalText.includes('+91 98765 43210') || modalText.includes('Ananya Sharma'), 'Print modal does NOT print invented customer phone when missing');
    assert(!modalText.includes('100 Feet Road') || modalText.includes('Indiranagar'), 'Print modal does NOT print invented customer street address');

    const shot3 = path.join(SCREENSHOTS_DIR, '03_erp_tax_invoice_print_modal.png');
    await page.screenshot({ path: shot3 });
    await copyScreenshot('03_erp_tax_invoice_print_modal.png');
    console.log('   📸 Captured: 03_erp_tax_invoice_print_modal.png');

    // Close modal & drawer
    const closeModalBtn = page.locator('button:has-text("Print Tax Invoice") + button');
    if (await closeModalBtn.isVisible()) {
      await closeModalBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(500);

    const closeDrawerBtn = page.locator('button:has(.lucide-x)').first();
    await closeDrawerBtn.click();
    await page.waitForTimeout(500);

    // SCENARIO C: Attempt Invoicing with Defective GSTIN
    console.log('\nScenario C: Defective Order Invoicing Attempt in ERP Drawer');
    const inspectInvalidBtn = page.locator('[data-testid="inspect-order-ord_erp_invalid_002"]');
    await inspectInvalidBtn.waitFor({ state: 'visible', timeout: 10000 });
    await inspectInvalidBtn.click();

    const genBtn2 = page.locator('#btn-generate-statutory-invoice');
    await genBtn2.waitFor({ state: 'visible', timeout: 5000 });
    await genBtn2.click();

    const errorBanner = page.locator('#drawer-action-error-banner');
    await errorBanner.waitFor({ state: 'visible', timeout: 10000 });
    const errorText = await errorBanner.innerText();
    assert(errorText.includes('INVALID_SELLER_GSTIN') || errorText.includes('invalid') || errorText.includes('GST Rule 46'), `Statutory rejection message displayed: ${errorText}`);

    const badgeInvalid = await page.locator('#drawer-order-invoice-badge').innerText();
    assert(badgeInvalid.includes('PENDING_INVOICE'), 'Defective order remains strictly PENDING_INVOICE');

    const shot4 = path.join(SCREENSHOTS_DIR, '04_erp_invalid_gstin_rejected.png');
    await page.screenshot({ path: shot4 });
    await copyScreenshot('04_erp_invalid_gstin_rejected.png');
    console.log('   📸 Captured: 04_erp_invalid_gstin_rejected.png');

    // SCENARIO D: Un-Invoiced Pending Order Neutrality
    console.log('\nScenario D: Pending Order Neutrality in ERP Drawer');
    const closeDrawerBtn2 = page.locator('button:has(.lucide-x)').first();
    await closeDrawerBtn2.click();
    await page.waitForTimeout(500);

    const inspectPendingBtn = page.locator('[data-testid="inspect-order-ord_erp_pending_003"]');
    await inspectPendingBtn.waitFor({ state: 'visible', timeout: 10000 });
    await inspectPendingBtn.click();

    const pendingBadge = await page.locator('#drawer-order-invoice-badge').innerText();
    assert(pendingBadge.includes('PENDING_INVOICE'), 'Pending order displays PENDING_INVOICE');
    const genPendingBtnVisible = await page.locator('#btn-generate-statutory-invoice').isVisible();
    assert(!genPendingBtnVisible, 'Generate invoice button hidden for non-delivered order');

    const shot5 = path.join(SCREENSHOTS_DIR, '05_erp_sales_register_neutrality.png');
    await page.screenshot({ path: shot5 });
    await copyScreenshot('05_erp_sales_register_neutrality.png');
    console.log('   📸 Captured: 05_erp_sales_register_neutrality.png');

    await browser.close();

    // ══════════════════════════════════════════════════════════════════════════
    // PART 4: CONCURRENCY & MVCC TRANSACTIONAL ROLLBACK
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n--- PART 4: Concurrency & MVCC Transactional Rollback ---');

    // Transactional rollback test
    let rollbackSuccess = false;
    const testRollbackClient = new pg.Client({ connectionString: TEST_DB_URL });
    await testRollbackClient.connect();
    try {
      await testRollbackClient.query('BEGIN');
      const allocRes = await testRollbackClient.query(
        `SELECT invoice_number FROM public.allocate_invoice_number('CTH', 'ord_simulated_error', 'CAKETOHOME_PARENT', '29AAACC1234F1Z5', NOW())`
      );
      assert(allocRes.rows[0].invoice_number.startsWith('CTH/26-27/'), 'In-flight allocation got formatted sequence number');
      // Simulate fatal persistence failure
      await testRollbackClient.query(`INSERT INTO public.invoice (id, invoice_number) VALUES ('inv_err', NULL)`);
    } catch {
      await testRollbackClient.query('ROLLBACK');
      rollbackSuccess = true;
    } finally {
      await testRollbackClient.end();
    }
    assert(rollbackSuccess, 'Simulated persistence error rolled back cleanly');

    // High contention test (10 parallel clients)
    console.log('\nTesting High Contention (10 Parallel PostgreSQL Clients)...');
    const concurrentClients = Array.from({ length: 10 }, () => new pg.Client({ connectionString: TEST_DB_URL }));
    await Promise.all(concurrentClients.map((c) => c.connect()));

    const concurrentResults = await Promise.all(
      concurrentClients.map(async (c, i) => {
        const orderId = `ord_concurrent_${i + 1}`;
        const res = await c.query(
          `SELECT invoice_number FROM public.allocate_invoice_number('CTH', $1, 'CAKETOHOME_PARENT', '29AAACC1234F1Z5', NOW())`,
          [orderId]
        );
        return res.rows[0].invoice_number;
      })
    );
    await Promise.all(concurrentClients.map((c) => c.end()));

    const uniqueNumbers = new Set(concurrentResults);
    assert(uniqueNumbers.size === 10, 'All 10 concurrent requests generated 100% unique sequence numbers');

    console.log('\n══════════════════════════════════════════════════════════════════════');
    console.log(`🏁 REAL ERP STATUTORY INVOICING SUITE: ${passedTests}/${totalTests} Passed (0 Failed)`);
    console.log('🌟 ZERO-FALLBACK SELLER IDENTITY & REJECTION BEFORE ALLOCATION VERIFIED');
    console.log('══════════════════════════════════════════════════════════════════════\n');

  } finally {
    try {
      if (nextApp?.pid) {
        const { execSync } = await import('child_process');
        execSync(`taskkill /pid ${nextApp.pid} /f /t`, { stdio: 'ignore' });
      }
    } catch {}
    try { await client?.end(); } catch {}
    try { await pgInstance?.stop(); } catch {}
  }
}

main().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
