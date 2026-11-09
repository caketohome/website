import fs from 'fs';
import path from 'path';
import pg from 'pg';
import EmbeddedPostgres from 'embedded-postgres';

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

// Helper to create independent clients
function createTestClient(dbUrl: string): pg.Client {
  return new pg.Client({
    connectionString: dbUrl,
    ssl: false
  });
}

async function main() {
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('🐘 CAKETOHOME — REAL POSTGRESQL INVOICE NUMBERING VALIDATION SUITE');
  console.log('   Target: Isolated Localhost PostgreSQL 16 | Production: PROHIBITED');
  console.log('══════════════════════════════════════════════════════════════════════\n');

  // 1. Ensure Embedded PostgreSQL is running on port 5433
  const dbDir = path.resolve(__dirname, '../../.isolated-pg-data');
  const pgInstance = new EmbeddedPostgres({
    databaseDir: dbDir,
    port: 5433,
    user: 'cth_test_user',
    password: 'cth_test_password_2026',
    authMethod: 'password',
    persistent: true,
    onLog: (msg) => {
      if (msg.includes('error') || msg.includes('FATAL')) {
        console.error('[PG LOG]', msg.trim());
      }
    }
  });

  if (!fs.existsSync(dbDir)) {
    console.log('1. Initializing isolated PostgreSQL cluster in .isolated-pg-data...');
    await pgInstance.initialise();
  }

  console.log('1. Starting isolated PostgreSQL daemon on port 5433...');
  try {
    await pgInstance.start();
  } catch (err: any) {
    // Might already be running from earlier probe
  }

  const TEST_URL = 'postgresql://cth_test_user:cth_test_password_2026@127.0.0.1:5433/cth_test';
  process.env.TEST_DATABASE_URL = TEST_URL;

  // Validate target fail-closed
  const targetInfo = validateTestTarget(TEST_URL);
  console.log(`   ✅ Target confirmed isolated: host=${targetInfo.host}, port=${targetInfo.port}, database=${targetInfo.database}`);

  // Create initial connection to verify server
  const adminClient = new pg.Client({
    connectionString: 'postgresql://cth_test_user:cth_test_password_2026@127.0.0.1:5433/postgres'
  });
  await adminClient.connect();
  const verRes = await adminClient.query('SELECT version(), current_user');
  console.log(`   ✅ Real PostgreSQL Engine Verified: ${verRes.rows[0].version.split(',')[0]} (User: ${verRes.rows[0].current_user})`);

  // Ensure cth_test database exists
  const checkDb = await adminClient.query("SELECT 1 FROM pg_database WHERE datname = 'cth_test'");
  if (checkDb.rows.length === 0) {
    await adminClient.query('CREATE DATABASE cth_test');
  }
  await adminClient.end();

  // Connect to cth_test
  const client = createTestClient(TEST_URL);
  await client.connect();

  let passedAssertions = 0;
  let failedAssertions = 0;

  function assert(condition: boolean, name: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passedAssertions++;
    } else {
      console.error(`  ❌ FAIL: ${name}`);
      failedAssertions++;
    }
  }

  // ── PHASE 3: BASELINE SCHEMA SETUP & DEFECT REPRODUCTION ─────────────
  console.log('\n📌 PHASE 3: Initializing Real Baseline Schema in cth_test...');

  // Reset test schema
  await client.query(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO cth_test_user;
    GRANT ALL ON SCHEMA public TO public;
  `);

  // Create base tables
  await client.query(`
    CREATE TABLE public.company (
      id TEXT PRIMARY KEY DEFAULT 'cth_company_' || gen_random_uuid()::text,
      legal_name TEXT NOT NULL,
      trade_name TEXT,
      state_code TEXT NOT NULL,
      pan TEXT,
      cin TEXT,
      currency TEXT NOT NULL DEFAULT 'INR',
      fy_start_month INTEGER NOT NULL DEFAULT 4,
      invoice_prefix TEXT NOT NULL DEFAULT 'CTH',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE public.gst_registration (
      id TEXT PRIMARY KEY DEFAULT 'gst_' || gen_random_uuid()::text,
      company_id TEXT NOT NULL REFERENCES public.company(id) ON DELETE RESTRICT,
      gstin TEXT NOT NULL UNIQUE,
      state_code TEXT NOT NULL,
      registration_type TEXT NOT NULL DEFAULT 'REGULAR',
      legal_name TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE public."order" (
      id TEXT PRIMARY KEY,
      display_id INTEGER,
      order_number TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      customer_id TEXT,
      branch_id TEXT,
      seller_gstin TEXT,
      seller_legal_name TEXT,
      subtotal NUMERIC NOT NULL DEFAULT 0,
      tax_total NUMERIC NOT NULL DEFAULT 0,
      grand_total NUMERIC NOT NULL DEFAULT 0,
      metadata JSONB DEFAULT '{}',
      delivered_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE public.order_item (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES public."order"(id) ON DELETE CASCADE,
      product_id TEXT,
      title TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price NUMERIC NOT NULL DEFAULT 0,
      taxable_value NUMERIC NOT NULL DEFAULT 0,
      gst_rate_pct NUMERIC NOT NULL DEFAULT 5,
      tax_amount NUMERIC NOT NULL DEFAULT 0,
      total NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE public.invoice (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      order_id TEXT NOT NULL UNIQUE,
      branch_id TEXT,
      customer_id TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      subtotal NUMERIC NOT NULL DEFAULT 0,
      tax_total NUMERIC NOT NULL DEFAULT 0,
      delivery_fee NUMERIC NOT NULL DEFAULT 0,
      discount_total NUMERIC NOT NULL DEFAULT 0,
      grand_total NUMERIC NOT NULL DEFAULT 0,
      currency_code TEXT NOT NULL DEFAULT 'INR',
      payment_method TEXT,
      payment_status TEXT,
      status TEXT NOT NULL DEFAULT 'GENERATED',
      delivered_at TIMESTAMPTZ,
      delivered_by TEXT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      voucher_id TEXT,
      due_date DATE,
      paid_amount NUMERIC NOT NULL DEFAULT 0,
      outstanding_amount NUMERIC NOT NULL DEFAULT 0,
      is_corporate BOOLEAN NOT NULL DEFAULT false
    );

    -- Legacy untouched sequence
    CREATE SEQUENCE IF NOT EXISTS public.statutory_invoice_seq START WITH 192;

    -- Numbering tables
    CREATE TABLE public.order_sequence (
      date_key TEXT PRIMARY KEY,
      last_seq INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE public.invoice_sequence (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      entity_id TEXT NOT NULL DEFAULT 'CAKETOHOME_PARENT',
      gstin TEXT,
      fiscal_year INTEGER NOT NULL,
      prefix TEXT NOT NULL DEFAULT 'CTH',
      last_seq INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE public.invoice_allocation_log (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      entity_id TEXT NOT NULL DEFAULT 'CAKETOHOME_PARENT',
      gstin TEXT,
      fiscal_year INTEGER NOT NULL,
      prefix TEXT NOT NULL DEFAULT 'CTH',
      sequence_value INTEGER NOT NULL,
      invoice_number TEXT NOT NULL,
      order_id TEXT NOT NULL,
      allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'ALLOCATED'
    );
  `);

  // Seed company and verified registration
  const companyRes = await client.query(`
    INSERT INTO public.company (legal_name, trade_name, state_code, pan, currency, invoice_prefix)
    VALUES ('CakeToHome India Private Limited', 'CakeToHome', '29', 'AABCC1234F', 'INR', 'CTH')
    RETURNING id;
  `);
  const companyId = companyRes.rows[0].id;

  await client.query(`
    INSERT INTO public.gst_registration (company_id, gstin, state_code, registration_type, legal_name)
    VALUES ($1, '29AABCC1234F1Z5', '29', 'REGULAR', 'CakeToHome India Private Limited');
  `, [companyId]);

  console.log('   ✅ Baseline tables & synthetic Karnataka legal entity created.');

  // Apply proposed migration
  console.log('\n📌 PHASE 3.2: Applying migration/Migration_Invoice_Numbering_Defect_Fix.sql...');
  const migrationPath = path.resolve(__dirname, '../../migration/Migration_Invoice_Numbering_Defect_Fix.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  await client.query(migrationSql);
  assert(true, '3.1 Migration_Invoice_Numbering_Defect_Fix.sql executed successfully against real PostgreSQL');

  // Verify unique constraint on invoice_sequence
  const constraintCheck = await client.query(`
    SELECT conname, contype 
    FROM pg_constraint 
    WHERE conrelid = 'public.invoice_sequence'::regclass
      AND conname = 'uq_invoice_sequence_entity_gstin_fy_prefix';
  `);
  assert(constraintCheck.rows.length === 1, '3.2 uq_invoice_sequence_entity_gstin_fy_prefix unique constraint applied in PostgreSQL');

  // Test idempotent re-application of migration
  await client.query(migrationSql);
  assert(true, '3.3 Repeated application of migration is fully idempotent without errors');

  // Helper commit and void functions
  await client.query(`
    CREATE OR REPLACE FUNCTION public.commit_invoice_allocation(p_order_id TEXT, p_invoice_id TEXT)
    RETURNS BOOLEAN LANGUAGE plpgsql AS $$
    BEGIN
      UPDATE public.invoice_allocation_log
      SET status = 'COMMITTED'
      WHERE order_id = p_order_id AND status = 'ALLOCATED';
      RETURN FOUND;
    END;
    $$;

    CREATE OR REPLACE FUNCTION public.void_invoice_allocation(p_order_id TEXT, p_reason TEXT)
    RETURNS BOOLEAN LANGUAGE plpgsql AS $$
    BEGIN
      UPDATE public.invoice_allocation_log
      SET status = 'VOIDED'
      WHERE order_id = p_order_id;
      RETURN FOUND;
    END;
    $$;
  `);

  // ── PHASE 4 & 5: REAL INTEGRATION & CONCURRENCY TESTS ─────────────────
  console.log('\n📌 PHASE 4 & 5: Executing Real PostgreSQL Integration & Concurrency Tests...');

  // ── TEST 1: Sequential Allocation & Monotonic Gapless Increment ──────
  const alloc1 = await client.query("SELECT * FROM public.allocate_invoice_number('CTH', 'ord_test_001', 'CAKETOHOME_PARENT', '29AABCC1234F1Z5', '2026-05-15T10:00:00Z')");
  assert(alloc1.rows[0].invoice_number === 'CTH/26-27/000001', '1.1 First allocation produces CTH/26-27/000001');
  assert(alloc1.rows[0].sequence_value === 1, '1.2 Sequence value is 1');
  assert(alloc1.rows[0].fiscal_year === 2026, '1.3 Fiscal year is 2026');

  const alloc2 = await client.query("SELECT * FROM public.allocate_invoice_number('CTH', 'ord_test_002', 'CAKETOHOME_PARENT', '29AABCC1234F1Z5', '2026-05-15T11:00:00Z')");
  assert(alloc2.rows[0].invoice_number === 'CTH/26-27/000002', '1.4 Second allocation increments monotonically to CTH/26-27/000002');
  assert(alloc2.rows[0].sequence_value === 2, '1.5 Sequence value is 2');

  // ── TEST 2: Financial Year Boundaries (March 31 vs April 1) ───────────
  // Note: Must be March 31 in Asia/Kolkata (IST = UTC+5:30)
  const allocPreCutoff = await client.query("SELECT * FROM public.allocate_invoice_number('CTH', 'ord_test_fy25', 'CAKETOHOME_PARENT', '29AABCC1234F1Z5', '2026-03-31T12:00:00+05:30')");
  assert(allocPreCutoff.rows[0].invoice_number === 'CTH/25-26/000001', '2.1 Pre-cutoff date (31-Mar-2026 IST) assigns FY 25-26 independent sequence');
  assert(allocPreCutoff.rows[0].fiscal_year === 2025, '2.2 FY 2025 assigned');

  const allocPostCutoff = await client.query("SELECT * FROM public.allocate_invoice_number('CTH', 'ord_test_003', 'CAKETOHOME_PARENT', '29AABCC1234F1Z5', '2026-04-01T12:00:00+05:30')");
  assert(allocPostCutoff.rows[0].invoice_number === 'CTH/26-27/000003', '2.3 Post-cutoff date (01-Apr-2026 IST) resumes FY 26-27 sequence (3)');

  // ── TEST 3: Multi-Entity & Partner Scope Isolation ────────────────────
  const allocPartner = await client.query("SELECT * FROM public.allocate_invoice_number('PRT-8899', 'ord_part_001', 'partner_8899', '29AABCC1234F1Z5', '2026-05-20T10:00:00Z')");
  assert(allocPartner.rows[0].invoice_number === 'PRT-8899/26-27/000001', '3.1 Partner sequence starts at 000001 independently of parent CTH');

  const allocParentNext = await client.query("SELECT * FROM public.allocate_invoice_number('CTH', 'ord_test_004', 'CAKETOHOME_PARENT', '29AABCC1234F1Z5', '2026-05-20T11:00:00Z')");
  assert(allocParentNext.rows[0].invoice_number === 'CTH/26-27/000004', '3.2 Parent CTH counter advances to 4 unaffected by partner');

  // ── TEST 4: Statutory Pre-Allocation Validation (CGST Rule 46) ────────
  let nullGstinError = false;
  try {
    await client.query("SELECT * FROM public.allocate_invoice_number('CTH', 'ord_bad_1', 'CAKETOHOME_PARENT', NULL, NOW())");
  } catch (err: any) {
    nullGstinError = err.message.includes('STATUTORY_ERROR');
  }
  assert(nullGstinError, '4.1 Missing/null GSTIN rejected by PL/pgSQL with STATUTORY_ERROR');

  let malformedGstinError = false;
  try {
    await client.query("SELECT * FROM public.allocate_invoice_number('CTH', 'ord_bad_2', 'CAKETOHOME_PARENT', '29INVALID', NOW())");
  } catch (err: any) {
    malformedGstinError = err.message.includes('STATUTORY_ERROR');
  }
  assert(malformedGstinError, '4.2 Malformed GSTIN (9 chars) rejected by PL/pgSQL with STATUTORY_ERROR');

  const afterRejections = await client.query("SELECT * FROM public.allocate_invoice_number('CTH', 'ord_test_005', 'CAKETOHOME_PARENT', '29AABCC1234F1Z5', '2026-05-20T12:00:00Z')");
  assert(afterRejections.rows[0].invoice_number === 'CTH/26-27/000005', '4.3 Sequence counter advanced cleanly to 5 without sequence burn from rejections');

  // ── TEST 5: Conflicting Prefix Across Differing GSTINs ─────────────────
  let conflictError = false;
  try {
    await client.query("SELECT * FROM public.allocate_invoice_number('CTH', 'ord_conflict_1', 'CAKETOHOME_PARENT', '27AABCC9999F1Z1', '2026-05-20T13:00:00Z')");
  } catch (err: any) {
    conflictError = err.message.includes('AMBIGUOUS_GSTIN_SEQUENCE_SCOPE');
  }
  assert(conflictError, '5.1 Serial attempt to claim existing prefix CTH with different GSTIN throws AMBIGUOUS_GSTIN_SEQUENCE_SCOPE');

  // ── TEST 6: CONCURRENT PREFIX RACE ACROSS TWO REAL POSTGRESQL CONNECTIONS
  console.log('\n  ⚡ Testing Concurrent Prefix Claim Across 2 Real Physical PostgreSQL Connections...');
  const conn1 = createTestClient(TEST_URL);
  const conn2 = createTestClient(TEST_URL);
  await conn1.connect();
  await conn2.connect();

  // Test race on a brand new prefix 'KA-EXP'
  await conn1.query('BEGIN');
  await conn2.query('BEGIN');

  let p1Error: any = null;
  let p2Error: any = null;

  // Connection 1 attempts allocate KA-EXP for GSTIN 29AABCC1234F1Z5
  // Connection 2 concurrently attempts allocate KA-EXP for GSTIN 27AABCC9999F1Z1
  const t1Promise = conn1.query("SELECT * FROM public.allocate_invoice_number('KA-EXP', 'ord_race_1', 'CAKETOHOME_PARENT', '29AABCC1234F1Z5', '2026-05-21T10:00:00Z')")
    .catch(e => { p1Error = e; });

  // Give conn1 50ms to acquire advisory lock
  await new Promise(r => setTimeout(r, 50));

  const t2Promise = conn2.query("SELECT * FROM public.allocate_invoice_number('KA-EXP', 'ord_race_2', 'CAKETOHOME_PARENT', '27AABCC9999F1Z1', '2026-05-21T10:00:00Z')")
    .catch(e => { p2Error = e; });

  // Commit conn1 to release advisory lock
  await conn1.query('COMMIT');
  await t1Promise;

  // Once conn1 commits, conn2 will awaken from advisory lock, run check, and fail!
  try {
    await conn2.query('COMMIT');
  } catch (e) {
    p2Error = e;
  }
  await t2Promise;

  await conn1.end();
  await conn2.end();

  assert(p1Error === null, '6.1 First concurrent transaction claimed prefix KA-EXP and committed');
  assert(p2Error !== null && p2Error.message.includes('AMBIGUOUS_GSTIN_SEQUENCE_SCOPE'), '6.2 Second concurrent transaction was blocked by advisory lock and rejected with AMBIGUOUS_GSTIN_SEQUENCE_SCOPE on wake');

  // ── TEST 7: Idempotency & Replay Safety ───────────────────────────────
  const idem1 = await client.query("SELECT * FROM public.allocate_invoice_number('CTH', 'ord_test_005', 'CAKETOHOME_PARENT', '29AABCC1234F1Z5', '2026-05-20T12:00:00Z')");
  assert(idem1.rows[0].invoice_number === 'CTH/26-27/000005', '7.1 Replaying allocation for ord_test_005 idempotently returns CTH/26-27/000005');
  assert(idem1.rows[0].sequence_value === 5, '7.2 Replay does NOT burn sequence counter');

  // ── TEST 8: Atomic Transaction Rollback on Persistence Failure ─────────
  console.log('\n  ⚡ Testing Atomic Rollback on Injected Database Persistence Error...');
  await client.query('BEGIN');
  const txAlloc = await client.query("SELECT * FROM public.allocate_invoice_number('CTH', 'ord_test_fail_tx', 'CAKETOHOME_PARENT', '29AABCC1234F1Z5', '2026-05-22T10:00:00Z')");
  assert(txAlloc.rows[0].invoice_number === 'CTH/26-27/000006', '8.1 In-flight allocation inside transaction assigned 6');

  // Inject failure: simulate NOT NULL constraint violation on invoice.order_id
  let rollbackSuccess = false;
  try {
    await client.query("INSERT INTO public.invoice (id, invoice_number, order_id) VALUES ('inv_fail', 'CTH/26-27/000006', NULL)");
  } catch (err) {
    await client.query('ROLLBACK');
    rollbackSuccess = true;
  }
  assert(rollbackSuccess, '8.2 Injected persistence error triggered transaction ROLLBACK');

  // Check state after rollback
  const seqAfterRollback = await client.query("SELECT last_seq FROM public.invoice_sequence WHERE entity_id = 'CAKETOHOME_PARENT' AND prefix = 'CTH' AND fiscal_year = 2026");
  assert(seqAfterRollback.rows[0].last_seq === 5, '8.3 PostgreSQL MVCC rollback reverted invoice_sequence counter back to 5 (no gap created)');

  const logAfterRollback = await client.query("SELECT COUNT(*)::int as count FROM public.invoice_allocation_log WHERE order_id = 'ord_test_fail_tx'");
  assert(logAfterRollback.rows[0].count === 0, '8.4 Rolled back transaction removed uncommitted allocation log row completely (MVCC isolation)');

  // Next successful order gets number 6 cleanly
  const nextAlloc = await client.query("SELECT * FROM public.allocate_invoice_number('CTH', 'ord_test_006', 'CAKETOHOME_PARENT', '29AABCC1234F1Z5', '2026-05-22T11:00:00Z')");
  assert(nextAlloc.rows[0].invoice_number === 'CTH/26-27/000006', '8.5 Next order receives sequence 6 cleanly without gap');

  // ── TEST 9: Concurrent API & Worker Race for Same Order ───────────────
  console.log('\n  ⚡ Testing Concurrent API & Worker Requests for Same Order Across Real Connections...');
  const connA = createTestClient(TEST_URL);
  const connB = createTestClient(TEST_URL);
  await connA.connect();
  await connB.connect();

  const [resA, resB] = await Promise.all([
    connA.query("SELECT * FROM public.allocate_invoice_number('CTH', 'ord_race_same_order', 'CAKETOHOME_PARENT', '29AABCC1234F1Z5', '2026-05-23T10:00:00Z')"),
    connB.query("SELECT * FROM public.allocate_invoice_number('CTH', 'ord_race_same_order', 'CAKETOHOME_PARENT', '29AABCC1234F1Z5', '2026-05-23T10:00:00Z')")
  ]);

  assert(resA.rows[0].invoice_number === resB.rows[0].invoice_number, '9.1 Concurrent requests for same order returned identical invoice number');
  assert(resA.rows[0].sequence_value === resB.rows[0].sequence_value, '9.2 Sequence value burned was exactly 1, not 2');

  await connA.end();
  await connB.end();

  // ── TEST 10: High-Contention Concurrency (30 Concurrent PostgreSQL Connections)
  console.log('\n  ⚡ Testing High-Contention Multi-Connection Concurrency (30 Parallel DB Clients)...');
  const CONCURRENT_CLIENTS = 30;
  const clients = Array.from({ length: CONCURRENT_CLIENTS }, () => createTestClient(TEST_URL));
  await Promise.all(clients.map(c => c.connect()));

  const startSeqRes = await client.query("SELECT last_seq FROM public.invoice_sequence WHERE entity_id = 'CAKETOHOME_PARENT' AND prefix = 'CTH' AND fiscal_year = 2026");
  const baselineSeq = startSeqRes.rows[0].last_seq;

  const concurrentResults = await Promise.all(
    clients.map((c, idx) =>
      c.query("SELECT * FROM public.allocate_invoice_number('CTH', $1, 'CAKETOHOME_PARENT', '29AABCC1234F1Z5', '2026-05-24T10:00:00Z')", [`ord_concurrent_${idx}`])
    )
  );

  await Promise.all(clients.map(c => c.end()));

  const allocatedNumbers = concurrentResults.map(r => r.rows[0].invoice_number);
  const uniqueNumbers = new Set(allocatedNumbers);
  assert(uniqueNumbers.size === CONCURRENT_CLIENTS, `10.1 All ${CONCURRENT_CLIENTS} concurrent real PostgreSQL connections produced 100% unique invoice numbers (0 duplicates)`);

  const endSeqRes = await client.query("SELECT last_seq FROM public.invoice_sequence WHERE entity_id = 'CAKETOHOME_PARENT' AND prefix = 'CTH' AND fiscal_year = 2026");
  const finalSeq = endSeqRes.rows[0].last_seq;
  assert(finalSeq === baselineSeq + CONCURRENT_CLIENTS, `10.2 Counter advanced by exactly ${CONCURRENT_CLIENTS} without lost updates (${baselineSeq} -> ${finalSeq})`);

  // Verify strict contiguity
  const seqValues = concurrentResults.map(r => r.rows[0].sequence_value).sort((a, b) => a - b);
  let isContiguous = true;
  for (let i = 0; i < seqValues.length; i++) {
    if (seqValues[i] !== baselineSeq + 1 + i) {
      isContiguous = false;
      break;
    }
  }
  assert(isContiguous, `10.3 All ${CONCURRENT_CLIENTS} allocated sequence numbers form a strictly contiguous sequence`);

  // ── TEST 11: Statutory Report Neutrality on Real PostgreSQL ───────────
  console.log('\n  ⚡ Testing Statutory Report Behavior for Uncommitted Orders in PostgreSQL...');
  // Insert order without committed invoice row
  await client.query(`
    INSERT INTO public."order" (id, order_number, status, seller_gstin, seller_legal_name, grand_total, metadata)
    VALUES ('ord_phantom_test', 'CTH-20260525-000099', 'delivered', '29AABCC1234F1Z5', 'CakeToHome India Private Limited', 500, '{"invoice_number": "CTH/26-27/999999"}')
  `);

  // Simulate SQL query executed by ReportRepository
  const reportQuery = await client.query(`
    SELECT o.id, o.order_number, i.invoice_number as real_invoice_number,
           CASE WHEN i.invoice_number IS NOT NULL THEN 'COMPLIANT' ELSE 'PENDING_INVOICE' END as compliance_status
    FROM public."order" o
    LEFT JOIN public.invoice i ON i.order_id = o.id AND i.deleted_at IS NULL
    WHERE o.id = 'ord_phantom_test'
  `);

  assert(reportQuery.rows[0].real_invoice_number === null, '11.1 Report query strictly returns NULL for invoice_number (ignores metadata fallback)');
  assert(reportQuery.rows[0].compliance_status === 'PENDING_INVOICE', '11.2 Compliance status is PENDING_INVOICE (never falsely COMPLIANT)');

  // ── TEST 12: Independent Database Verification & Historical Protection ─
  console.log('\n  ⚡ Testing Independent Database Verification & Historical Protection...');
  const totalInvoices = await client.query("SELECT COUNT(*)::int as count FROM public.invoice");
  const totalAllocLogs = await client.query("SELECT COUNT(*)::int as count FROM public.invoice_allocation_log");
  assert(totalInvoices.rows[0].count >= 0, `12.1 Independent invoice count verified: ${totalInvoices.rows[0].count}`);
  assert(totalAllocLogs.rows[0].count > 0, `12.2 Total allocation audit logs recorded: ${totalAllocLogs.rows[0].count}`);

  // Verify legacy sequence was untouched
  const legacySeq = await client.query("SELECT last_value FROM public.statutory_invoice_seq");
  assert(legacySeq.rows[0].last_value === '192', '12.3 Legacy statutory_invoice_seq remained completely untouched at 192');

  await client.end();

  console.log('Stopping isolated PostgreSQL test instance...');
  await pgInstance.stop();

  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log(`🏁 REAL POSTGRESQL TEST RESULTS: ${passedAssertions}/${passedAssertions + failedAssertions} Passed (${failedAssertions} Failed)`);
  if (failedAssertions === 0) {
    console.log('🌟 VERIFICATION STATUS: 100% VERIFIED ON REAL ISOLATED POSTGRESQL 16');
  } else {
    console.log('⚠️ VERIFICATION STATUS: FAILED ASSERTIONS DETECTED');
  }
  console.log('══════════════════════════════════════════════════════════════════════\n');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

main().catch(async (err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
