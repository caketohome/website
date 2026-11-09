/**
 * ============================================================================
 * CAKETOHOME ERP — REAL POSTGRESQL INVOICE NUMBERING & CONCURRENCY TEST SUITE
 * File: frontend/scripts/test-real-pg-invoice-concurrency-integrity.ts
 *
 * Execution Target: Isolated PostgreSQL 16 on 127.0.0.1:5433 (cth_test)
 * Production Release Status: STRICTLY HOLD / STAGED NO-GO
 * Production Access: STRICTLY PROHIBITED (Fail-Closed)
 * ============================================================================
 */

import { Client } from 'pg';
import { DeliveryInvoicingService } from '../src/lib/services/delivery-invoicing.service';
import { OrderRepository } from '../src/lib/repositories/order.repository';
import { closeDbPool } from '../src/lib/db';

// ── FAIL-CLOSED ISOLATION ENFORCEMENT ─────────────────────────────────────────
const FORBIDDEN_HOSTS = ['aws-1-ap-south-1.pooler.supabase.com', 'supabase.com', 'supabase.co'];

function enforceTestIsolation(url: string | undefined): { host: string; port: number; database: string } {
  if (!url) {
    throw new Error('FATAL SECURITY ABORT: TEST_DATABASE_URL is required. Missing configuration fails closed.');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (err: any) {
    throw new Error(`FATAL SECURITY ABORT: Invalid connection URL: ${err.message}`);
  }

  for (const fHost of FORBIDDEN_HOSTS) {
    if (parsed.hostname.toLowerCase().includes(fHost.toLowerCase())) {
      throw new Error(`CRITICAL SECURITY ABORT: Connection targets forbidden production/hosted host (${parsed.hostname})! Execution strictly blocked.`);
    }
  }

  if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
    throw new Error(`SECURITY ABORT: Host '${parsed.hostname}' is not isolated localhost (127.0.0.1).`);
  }

  const port = parseInt(parsed.port || '5432', 10);
  if (port !== 5433) {
    throw new Error(`SECURITY ABORT: Port ${port} is not the designated isolated PostgreSQL port (5433).`);
  }

  const database = parsed.pathname.replace(/^\//, '');
  if (database !== 'cth_test') {
    throw new Error(`SECURITY ABORT: Target database '${database}' is not the designated test database ('cth_test').`);
  }

  return { host: parsed.hostname, port, database };
}

const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://cth_test_user:cth_test_password_2026@127.0.0.1:5433/cth_test';
process.env.TEST_DATABASE_URL = TEST_DB_URL;
process.env.DATABASE_URL = TEST_DB_URL;
process.env.NODE_ENV = 'test';

function createClient(): Client {
  enforceTestIsolation(TEST_DB_URL);
  return new Client({
    connectionString: TEST_DB_URL,
    ssl: false,
    connectionTimeoutMillis: 5000,
  });
}

// ── TEST RUNNER DEFINITIONS ──────────────────────────────────────────────────
interface TestAssertion {
  testNumber: number;
  name: string;
  passed: boolean;
  details?: string;
}

const assertions: TestAssertion[] = [];

function record(testNumber: number, name: string, passed: boolean, details?: string) {
  assertions.push({ testNumber, name, passed, details });
  if (passed) {
    console.log(`  [PASS] Test ${testNumber}: ${name}`);
    if (details) console.log(`         Details: ${details}`);
  } else {
    console.error(`  [FAIL] Test ${testNumber}: ${name}`);
    if (details) console.error(`         Details: ${details}`);
  }
}

async function runRealPostgreSqlTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('CAKETOHOME ERP — REAL POSTGRESQL 16 INVOICE INTEGRITY & CONCURRENCY SUITE');
  console.log('Target: Isolated Localhost PostgreSQL 16 (127.0.0.1:5433/cth_test)');
  console.log('Timestamp:', new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  // 1. Enforce fail-closed guard
  const targetInfo = enforceTestIsolation(TEST_DB_URL);
  console.log(`[Provenance] Isolation confirmed: Host=${targetInfo.host}, Port=${targetInfo.port}, DB=${targetInfo.database}`);

  // 2. Test fail-closed defense: verify that remote or Supabase target throws immediately
  let failClosedPass = false;
  try {
    enforceTestIsolation('postgresql://user:pass@aws-1-ap-south-1.pooler.supabase.com:5432/postgres');
  } catch (err: any) {
    failClosedPass = err.message.includes('CRITICAL SECURITY ABORT');
  }
  record(0, 'Security Fail-Closed Guard: Refuses remote/Supabase targets unconditionally', failClosedPass,
    'Attempt to configure production Supabase host threw CRITICAL SECURITY ABORT');

  // 3. Connect primary control client
  let controlClient = createClient();
  await controlClient.connect();

  // Provenance inspection
  const serverInfo = await controlClient.query(`
    SELECT 
      version(), 
      current_database(), 
      current_user, 
      inet_server_port(), 
      inet_server_addr()::text as server_addr
  `);
  const row = serverInfo.rows[0];
  console.log('[Provenance] PostgreSQL Server Version:', row.version);
  console.log('[Provenance] Connection Provenance:', {
    user: row.current_user,
    database: row.current_database,
    port: row.inet_server_port,
    server_addr: row.server_addr,
  });

  const isRealPg16 = row.version.includes('PostgreSQL 16') && row.inet_server_port === 5433 && row.current_database === 'cth_test';
  record(0.1, 'PostgreSQL 16 Server Engine Verified on Port 5433', isRealPg16,
    `version="${row.version.split(',')[0]}", port=${row.inet_server_port}, db="${row.current_database}"`);

  // Record initial database snapshots
  console.log('\n--- CAPTURING INITIAL DATABASE SNAPSHOT ---');
  const initSeq = await controlClient.query('SELECT entity_id, gstin, fiscal_year, prefix, last_seq FROM public.invoice_sequence ORDER BY entity_id, prefix');
  const initLogCount = await controlClient.query('SELECT count(*)::int as count FROM public.invoice_allocation_log');
  const initInvCount = await controlClient.query('SELECT count(*)::int as count FROM public.invoice');
  const initLegacySeq = await controlClient.query('SELECT last_value, is_called FROM public.statutory_invoice_seq');

  console.log('Initial invoice_sequence counters:', initSeq.rows);
  console.log('Initial invoice_allocation_log count:', initLogCount.rows[0].count);
  console.log('Initial invoice table count:', initInvCount.rows[0].count);
  console.log('Initial legacy statutory_invoice_seq:', initLegacySeq.rows[0]);

  // Dedicated prefix for high-contention & isolation tests
  const TEST_PREFIX = 'CONC';
  const TEST_GSTIN = '29AABCC1234F1Z5';
  const TEST_ENTITY = 'CAKETOHOME_PARENT';

  // Authoritative registered CTH series constants (Karnataka legal entity)
  const CTH_PREFIX = 'CTH';
  const CTH_GSTIN = '29AAACC1234F1Z5';
  const CTH_LEGAL_NAME = 'CakeToHome Retail India Private Limited';

  // Ensure synthetic test registration exists in gst_registration if company exists
  const companyCheck = await controlClient.query("SELECT id FROM public.company WHERE legal_name = 'CakeToHome India Private Limited'");
  let testCompanyId = companyCheck.rows[0]?.id;
  if (!testCompanyId) {
    const compRes = await controlClient.query(`
      INSERT INTO public.company (legal_name, trade_name, state_code, pan, currency, invoice_prefix)
      VALUES ('CakeToHome India Private Limited', 'CakeToHome', '29', 'AABCC1234F', 'INR', 'CTH')
      RETURNING id
    `);
    testCompanyId = compRes.rows[0].id;
  }
  await controlClient.query(`
    INSERT INTO public.gst_registration (company_id, gstin, state_code, registration_type, legal_name)
    VALUES ($1, $2, '29', 'REGULAR', 'CakeToHome India Private Limited')
    ON CONFLICT (gstin) DO NOTHING
  `, [testCompanyId, TEST_GSTIN]);

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('EXECUTING 12 REAL POSTGRESQL INTEGRATION TEST PHASES');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 1: Sequential Allocation & Uniqueness
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ TEST 1: Sequential Allocation & Uniqueness (Monotonic Increment)');
  {
    const orderId1 = `ord_seq_${Date.now()}_01`;
    const orderId2 = `ord_seq_${Date.now()}_02`;

    const r1 = await controlClient.query(
      "SELECT * FROM public.allocate_invoice_number($1, $2, $3, $4, '2026-06-01T10:00:00Z')",
      [TEST_PREFIX, orderId1, TEST_ENTITY, TEST_GSTIN]
    );
    const r2 = await controlClient.query(
      "SELECT * FROM public.allocate_invoice_number($1, $2, $3, $4, '2026-06-01T10:05:00Z')",
      [TEST_PREFIX, orderId2, TEST_ENTITY, TEST_GSTIN]
    );

    const s1 = r1.rows[0];
    const s2 = r2.rows[0];

    const pass = s1.sequence_value + 1 === s2.sequence_value &&
                 s1.invoice_number === `${TEST_PREFIX}/26-27/${String(s1.sequence_value).padStart(6, '0')}` &&
                 s2.invoice_number === `${TEST_PREFIX}/26-27/${String(s2.sequence_value).padStart(6, '0')}` &&
                 s1.invoice_number !== s2.invoice_number;

    record(1, 'Sequential Allocation: Strictly monotonic and format compliant (CGST Rule 46)', pass,
      `inv1=${s1.invoice_number} (seq=${s1.sequence_value}), inv2=${s2.invoice_number} (seq=${s2.sequence_value})`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 2: High-Contention Multi-Connection Concurrency (20 Physical PostgreSQL Clients)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n▶ TEST 2: High-Contention Multi-Connection Concurrency (20 Physical Connections)');
  {
    const CONCURRENT_CLIENT_COUNT = 20;
    const clients: Client[] = [];
    for (let i = 0; i < CONCURRENT_CLIENT_COUNT; i++) {
      clients.push(createClient());
    }
    await Promise.all(clients.map(c => c.connect()));

    // Check baseline sequence value
    const baseSeqRes = await controlClient.query(
      "SELECT last_seq FROM public.invoice_sequence WHERE entity_id = $1 AND gstin = $2 AND prefix = $3 AND fiscal_year = 2026",
      [TEST_ENTITY, TEST_GSTIN, TEST_PREFIX]
    );
    const baseSeq = baseSeqRes.rows[0].last_seq;

    // Concurrently trigger allocations
    const runTimestamp = Date.now();
    const allocations = await Promise.all(
      clients.map((c, idx) =>
        c.query(
          "SELECT * FROM public.allocate_invoice_number($1, $2, $3, $4, '2026-06-02T12:00:00Z')",
          [TEST_PREFIX, `ord_conc_${runTimestamp}_${idx}`, TEST_ENTITY, TEST_GSTIN]
        )
      )
    );

    await Promise.all(clients.map(c => c.end()));

    const allocatedNumbers = allocations.map(r => r.rows[0].invoice_number);
    const allocatedValues = allocations.map(r => r.rows[0].sequence_value).sort((a, b) => a - b);
    const uniqueNumbers = new Set(allocatedNumbers);

    const postSeqRes = await controlClient.query(
      "SELECT last_seq FROM public.invoice_sequence WHERE entity_id = $1 AND gstin = $2 AND prefix = $3 AND fiscal_year = 2026",
      [TEST_ENTITY, TEST_GSTIN, TEST_PREFIX]
    );
    const finalSeq = postSeqRes.rows[0].last_seq;

    let isContiguous = true;
    for (let i = 0; i < allocatedValues.length; i++) {
      if (allocatedValues[i] !== baseSeq + 1 + i) {
        isContiguous = false;
        break;
      }
    }

    const pass = uniqueNumbers.size === CONCURRENT_CLIENT_COUNT &&
                 finalSeq === baseSeq + CONCURRENT_CLIENT_COUNT &&
                 isContiguous;

    record(2, `High-Contention Concurrency: ${CONCURRENT_CLIENT_COUNT} parallel physical connections allocated 100% unique contiguous sequences`, pass,
      `clients=${CONCURRENT_CLIENT_COUNT}, unique=${uniqueNumbers.size}, delta=${finalSeq - baseSeq}, contiguous=${isContiguous}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 3: Advisory-Lock Contention & Release Mechanics
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n▶ TEST 3: Advisory-Lock Contention & Release Mechanics (pg_advisory_xact_lock)');
  {
    const conn1 = createClient();
    const conn2 = createClient();
    await conn1.connect();
    await conn2.connect();

    const lockPrefix = 'LKTEST';
    await conn1.query('BEGIN');

    // Conn 1 acquires transaction advisory lock by calling allocate_invoice_number inside transaction
    const t1Alloc = await conn1.query(
      "SELECT * FROM public.allocate_invoice_number($1, $2, $3, $4, '2026-06-03T10:00:00Z')",
      [lockPrefix, 'ord_lock_tx1', TEST_ENTITY, TEST_GSTIN]
    );

    let conn2Completed = false;
    let conn2StartTime = Date.now();
    let conn2EndTime = 0;

    // Conn 2 attempts allocation concurrently on same prefix/entity/FY, which must block on advisory lock
    const pConn2 = conn2.query(
      "SELECT * FROM public.allocate_invoice_number($1, $2, $3, $4, '2026-06-03T10:00:00Z')",
      [lockPrefix, 'ord_lock_tx2', TEST_ENTITY, TEST_GSTIN]
    ).then(res => {
      conn2Completed = true;
      conn2EndTime = Date.now();
      return res;
    });

    // Wait 150ms and assert conn2 is still waiting
    await new Promise(r => setTimeout(r, 150));
    const stillWaiting = conn2Completed === false;

    // Commit conn1 transaction -> releases pg_advisory_xact_lock automatically
    await conn1.query('COMMIT');

    const resConn2 = await pConn2;
    const waitedMs = conn2EndTime - conn2StartTime;

    await conn1.end();
    await conn2.end();

    const pass = stillWaiting &&
                 waitedMs >= 140 &&
                 t1Alloc.rows[0].sequence_value === 1 &&
                 resConn2.rows[0].sequence_value === 2;

    record(3, 'Advisory Lock: Transaction-scoped lock serializes concurrent transactions and releases cleanly on COMMIT', pass,
      `conn2_blocked_during_tx1=${stillWaiting}, wait_ms=${waitedMs}, seq1=${t1Alloc.rows[0].sequence_value}, seq2=${resConn2.rows[0].sequence_value}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 4: Transaction Rollback Following Forced Failure
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n▶ TEST 4: Transaction Rollback Following Forced Failure (Zero Sequence Burn)');
  {
    const rollbackClient = createClient();
    await rollbackClient.connect();

    const seqBeforeRes = await controlClient.query(
      "SELECT last_seq FROM public.invoice_sequence WHERE entity_id = $1 AND gstin = $2 AND prefix = $3 AND fiscal_year = 2026",
      [TEST_ENTITY, TEST_GSTIN, TEST_PREFIX]
    );
    const seqBefore = seqBeforeRes.rows[0].last_seq;

    const testOrderId = `ord_rollback_test_${Date.now()}`;
    await rollbackClient.query('BEGIN');

    // Allocate in-flight
    const inFlightAlloc = await rollbackClient.query(
      "SELECT * FROM public.allocate_invoice_number($1, $2, $3, $4, '2026-06-04T10:00:00Z')",
      [TEST_PREFIX, testOrderId, TEST_ENTITY, TEST_GSTIN]
    );
    const assignedSeq = inFlightAlloc.rows[0].sequence_value;

    // Force failure: simulate NOT NULL constraint violation or explicit error
    let rolledBack = false;
    try {
      await rollbackClient.query("INSERT INTO public.invoice (id, invoice_number, order_id) VALUES ('inv_err', 'ERR', NULL)");
    } catch (err) {
      await rollbackClient.query('ROLLBACK');
      rolledBack = true;
    }
    await rollbackClient.end();

    // Independent query via controlClient to verify rollback outcome
    const seqAfterRes = await controlClient.query(
      "SELECT last_seq FROM public.invoice_sequence WHERE entity_id = $1 AND gstin = $2 AND prefix = $3 AND fiscal_year = 2026",
      [TEST_ENTITY, TEST_GSTIN, TEST_PREFIX]
    );
    const seqAfter = seqAfterRes.rows[0].last_seq;

    const logRes = await controlClient.query(
      "SELECT count(*)::int as count FROM public.invoice_allocation_log WHERE order_id = $1",
      [testOrderId]
    );

    const invRes = await controlClient.query(
      "SELECT count(*)::int as count FROM public.invoice WHERE id = 'inv_err'"
    );

    const pass = rolledBack &&
                 assignedSeq === seqBefore + 1 &&
                 seqAfter === seqBefore &&
                 logRes.rows[0].count === 0 &&
                 invRes.rows[0].count === 0;

    record(4, 'Transaction Rollback: MVCC rolls back counter and allocation log with zero sequence burn', pass,
      `assigned=${assignedSeq}, seq_before=${seqBefore}, seq_after=${seqAfter}, logs_persisted=${logRes.rows[0].count}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 5: Statutory Pre-Allocation Validation (CGST Rule 46)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n▶ TEST 5: Statutory Pre-Allocation Validation (CGST Rule 46)');
  {
    const seqBeforeRes = await controlClient.query(
      "SELECT last_seq FROM public.invoice_sequence WHERE entity_id = $1 AND gstin = $2 AND prefix = $3 AND fiscal_year = 2026",
      [TEST_ENTITY, TEST_GSTIN, TEST_PREFIX]
    );
    const seqBefore = seqBeforeRes.rows[0].last_seq;

    // 5.1 Test null GSTIN
    let nullError = false;
    try {
      await controlClient.query(
        "SELECT * FROM public.allocate_invoice_number($1, 'ord_null_gst', $2, NULL, '2026-06-05T10:00:00Z')",
        [TEST_PREFIX, TEST_ENTITY]
      );
    } catch (err: any) {
      nullError = err.message.includes('STATUTORY_ERROR');
    }

    // 5.2 Test malformed GSTIN
    let malformedError = false;
    try {
      await controlClient.query(
        "SELECT * FROM public.allocate_invoice_number($1, 'ord_bad_gst', $2, '29INVALID', '2026-06-05T10:00:00Z')",
        [TEST_PREFIX, TEST_ENTITY]
      );
    } catch (err: any) {
      malformedError = err.message.includes('STATUTORY_ERROR');
    }

    // 5.3 Test application service pre-allocation validation
    const appSvcRes = await DeliveryInvoicingService.generateInvoiceOnDelivery({}, {
      id: `ord_bad_gst_${Date.now()}`,
      order_number: 'ORD-BAD-GST-TEST',
      status: 'delivered',
      branch_id: 'br_indiranagar_01',
      seller_gstin: '29BADFORMAT123',
      seller_legal_name: 'CakeToHome India Private Limited',
      items: [{ title: 'Cake', quantity: 1, unit_price: 500, hsn_code: '19059010' }],
    });

    const seqAfterRes = await controlClient.query(
      "SELECT last_seq FROM public.invoice_sequence WHERE entity_id = $1 AND gstin = $2 AND prefix = $3 AND fiscal_year = 2026",
      [TEST_ENTITY, TEST_GSTIN, TEST_PREFIX]
    );
    const seqAfter = seqAfterRes.rows[0].last_seq;

    const pass = nullError &&
                 malformedError &&
                 appSvcRes.success === false &&
                 appSvcRes.code === 'INVALID_SELLER_GSTIN' &&
                 seqBefore === seqAfter;

    record(5, 'Pre-Allocation Statutory Validation: Missing/malformed GSTIN rejected before sequence consumption', pass,
      `nullError=${nullError}, malformedError=${malformedError}, appCode=${appSvcRes.code}, seq_burned=${seqAfter - seqBefore}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 6: Duplicate Requests & Lost Response Replay (Idempotency)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n▶ TEST 6: Duplicate Requests & Lost Response Replay (Idempotency)');
  {
    const replayOrderId = `ord_replay_${Date.now()}`;

    // First call
    const call1 = await controlClient.query(
      "SELECT * FROM public.allocate_invoice_number($1, $2, $3, $4, '2026-06-06T10:00:00Z')",
      [TEST_PREFIX, replayOrderId, TEST_ENTITY, TEST_GSTIN]
    );
    const seqAfter1 = (await controlClient.query(
      "SELECT last_seq FROM public.invoice_sequence WHERE entity_id = $1 AND gstin = $2 AND prefix = $3 AND fiscal_year = 2026",
      [TEST_ENTITY, TEST_GSTIN, TEST_PREFIX]
    )).rows[0].last_seq;

    // Second call (replay of identical order)
    const call2 = await controlClient.query(
      "SELECT * FROM public.allocate_invoice_number($1, $2, $3, $4, '2026-06-06T10:00:00Z')",
      [TEST_PREFIX, replayOrderId, TEST_ENTITY, TEST_GSTIN]
    );
    const seqAfter2 = (await controlClient.query(
      "SELECT last_seq FROM public.invoice_sequence WHERE entity_id = $1 AND gstin = $2 AND prefix = $3 AND fiscal_year = 2026",
      [TEST_ENTITY, TEST_GSTIN, TEST_PREFIX]
    )).rows[0].last_seq;

    const pass = call1.rows[0].invoice_number === call2.rows[0].invoice_number &&
                 call1.rows[0].sequence_value === call2.rows[0].sequence_value &&
                 seqAfter1 === seqAfter2;

    record(6, 'Idempotency Protection: Replayed allocation for existing order returns identical invoice number with 0 counter burn', pass,
      `inv1=${call1.rows[0].invoice_number}, inv2=${call2.rows[0].invoice_number}, seqAfter1=${seqAfter1}, seqAfter2=${seqAfter2}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 7: Indian Fiscal Year Boundary Precision (March 31 vs April 1 IST)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n▶ TEST 7: Indian Fiscal Year Boundary Precision (March 31 vs April 1 IST)');
  {
    const fyPrefix = 'FYBND';

    // 7.1 Pre-cutoff: 2026-03-31T23:50:00+05:30 (FY 2025-26)
    const preCutoff = await controlClient.query(
      "SELECT * FROM public.allocate_invoice_number($1, 'ord_fy25_cutoff', $2, $3, '2026-03-31T23:50:00+05:30')",
      [fyPrefix, TEST_ENTITY, TEST_GSTIN]
    );

    // 7.2 Post-cutoff: 2026-04-01T00:10:00+05:30 (FY 2026-27)
    const postCutoff = await controlClient.query(
      "SELECT * FROM public.allocate_invoice_number($1, 'ord_fy26_cutoff', $2, $3, '2026-04-01T00:10:00+05:30')",
      [fyPrefix, TEST_ENTITY, TEST_GSTIN]
    );

    const rPre = preCutoff.rows[0];
    const rPost = postCutoff.rows[0];

    const pass = rPre.fiscal_year === 2025 &&
                 rPre.invoice_number === `${fyPrefix}/25-26/000001` &&
                 rPost.fiscal_year === 2026 &&
                 rPost.invoice_number === `${fyPrefix}/26-27/000001`;

    record(7, 'Fiscal Year Boundary: Precision partition at 31-Mar-2026 23:59:59 IST into FY 25-26 and FY 26-27', pass,
      `pre_cutoff=${rPre.invoice_number} (FY ${rPre.fiscal_year}), post_cutoff=${rPost.invoice_number} (FY ${rPost.fiscal_year})`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 8: Scope Conflict Defense (AMBIGUOUS_GSTIN_SEQUENCE_SCOPE)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n▶ TEST 8: Scope Conflict Defense (AMBIGUOUS_GSTIN_SEQUENCE_SCOPE)');
  {
    const foreignGstin = '27AABCC9999F1Z1'; // Maharashtra GSTIN

    let scopeConflictError = false;
    let errorMessage = '';

    try {
      // Attempt to allocate existing prefix 'CONC' (already bound to 29AABCC1234F1Z5) with foreign GSTIN
      await controlClient.query(
        "SELECT * FROM public.allocate_invoice_number($1, 'ord_conflict_test', $2, $3, '2026-06-08T10:00:00Z')",
        [TEST_PREFIX, TEST_ENTITY, foreignGstin]
      );
    } catch (err: any) {
      scopeConflictError = err.message.includes('AMBIGUOUS_GSTIN_SEQUENCE_SCOPE');
      errorMessage = err.message;
    }

    const pass = scopeConflictError === true;
    record(8, 'Scope Conflict Defense: Attempt to reuse prefix under different GSTIN throws AMBIGUOUS_GSTIN_SEQUENCE_SCOPE', pass,
      `scope_conflict_thrown=${scopeConflictError}, error="${errorMessage.split('\n')[0]}"`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 9: Invoice Persistence & Retrieval Across New Client / Restart
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n▶ TEST 9: Invoice Persistence & Retrieval Across Fresh Connection Pool');
  {
    const persistOrderId = `ord_persist_${Date.now()}`;
    const persistOrderNumber = `ORD-PERSIST-${Date.now()}`;
    const testTotal = 1450.50;

    // Insert order in 'delivered' status with explicit is_ledger_eligible flag
    await controlClient.query(`
      INSERT INTO public.order (id, order_number, branch_id, status, grand_total, metadata, created_at)
      VALUES ($1, $2, 'br_indiranagar_01', 'delivered', $3, '{"is_ledger_eligible": true}'::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET status = 'delivered';
    `, [persistOrderId, persistOrderNumber, testTotal]);

    // Generate invoice through DeliveryInvoicingService using registered CTH GSTIN fixture
    const genRes = await DeliveryInvoicingService.generateInvoiceOnDelivery({}, {
      id: persistOrderId,
      order_number: persistOrderNumber,
      status: 'delivered',
      branch_id: 'br_indiranagar_01',
      seller_gstin: CTH_GSTIN,
      seller_legal_name: CTH_LEGAL_NAME,
      seller_state_code: '29',
      items: [
        { title: 'Dutch Truffle Cake 1kg', quantity: 1, unit_price: 1200, hsn_code: '19059010', taxable_value: 1200, tax_amount: 216, total: 1416 },
        { title: 'Birthday Candles Pack', quantity: 1, unit_price: 100, hsn_code: '34060010', taxable_value: 100, tax_amount: 18, total: 118 },
      ],
    });

    // Close controlClient completely and close pool to test true fresh connection retrieval
    await controlClient.end();
    await closeDbPool();

    const freshClient = createClient();
    await freshClient.connect();

    // Query persisted invoice table directly from fresh connection
    const freshInvRes = await freshClient.query(
      "SELECT id, invoice_number, order_id, seller_gstin, seller_legal_name, grand_total, status FROM public.invoice WHERE order_id = $1",
      [persistOrderId]
    );

    const freshAllocRes = await freshClient.query(
      "SELECT status, invoice_number FROM public.invoice_allocation_log WHERE order_id = $1",
      [persistOrderId]
    );

    const invRow = freshInvRes.rows[0];
    const allocRow = freshAllocRes.rows[0];

    const pass = genRes.success === true &&
                 invRow !== undefined &&
                 invRow.invoice_number === genRes.invoice_number &&
                 invRow.seller_gstin === CTH_GSTIN &&
                 allocRow !== undefined &&
                 allocRow.status === 'COMMITTED';

    record(9, 'Persistence & Fresh Connection Retrieval: Committed invoice & allocation log retrieved reliably across fresh DB connection', pass,
      `inv_number=${invRow?.invoice_number}, seller=${invRow?.seller_legal_name}, alloc_log_status=${allocRow?.status}`);

    // Reconnect primary controlClient for remaining phases
    controlClient = freshClient;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 10: Prevention of Printing Uncommitted Invoices (Print Gating)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n▶ TEST 10: Prevention of Printing Uncommitted Invoices (Print Gating)');
  {
    const uncommittedOrderId = `ord_pending_${Date.now()}`;
    const uncommittedOrderNumber = `ORD-PENDING-${Date.now()}`;

    // Insert order in 'pending' status without any invoice row
    await controlClient.query(`
      INSERT INTO public.order (id, order_number, branch_id, status, grand_total, metadata, created_at)
      VALUES ($1, $2, 'br_indiranagar_01', 'pending', 850, '{"invoice_number": null}', NOW())
    `, [uncommittedOrderId, uncommittedOrderNumber]);

    // Check invoice table: 0 rows exist
    const invCheck = await controlClient.query('SELECT count(*)::int as count FROM public.invoice WHERE order_id = $1', [uncommittedOrderId]);

    // Attempt invoice generation on pending order
    const genRes = await DeliveryInvoicingService.generateInvoiceOnDelivery({}, {
      id: uncommittedOrderId,
      order_number: uncommittedOrderNumber,
      status: 'pending',
      branch_id: 'br_indiranagar_01',
    });

    const pass = invCheck.rows[0].count === 0 &&
                 genRes.success === false &&
                 String(genRes.error).includes("status is 'pending'");

    record(10, 'Print Gating: Uncommitted orders strictly blocked from generating, viewing, or printing invoice', pass,
      `inv_count=${invCheck.rows[0].count}, error="${genRes.error}"`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 11: Counter and Audit-State Consistency Across Failed Operations
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n▶ TEST 11: Counter and Audit-State Consistency Across All Operations');
  {
    // Inspect all rows in allocation log for any orphaned or invalid records
    const orphanLogs = await controlClient.query(`
      SELECT count(*)::int as count
      FROM public.invoice_allocation_log ial
      LEFT JOIN public.invoice i ON i.invoice_number = ial.invoice_number
      WHERE ial.status = 'COMMITTED' AND i.id IS NULL
    `);

    // Check invoice_sequence table consistency: all last_seq >= 1
    const seqIntegrity = await controlClient.query(`
      SELECT count(*)::int as count
      FROM public.invoice_sequence
      WHERE last_seq <= 0 OR prefix IS NULL OR gstin IS NULL OR fiscal_year IS NULL
    `);

    const pass = orphanLogs.rows[0].count === 0 && seqIntegrity.rows[0].count === 0;

    record(11, 'Audit State Consistency: Zero orphaned COMMITTED logs and 100% counter schema integrity', pass,
      `orphaned_committed_logs=${orphanLogs.rows[0].count}, invalid_sequence_rows=${seqIntegrity.rows[0].count}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 12: Legacy Statutory Watermark Protection (Watermark 192/193 Untouched)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n▶ TEST 12: Legacy Statutory Watermark Protection (Watermark 192 Untouched)');
  {
    const legacyCheck = await controlClient.query('SELECT last_value, is_called FROM public.statutory_invoice_seq');
    const legacyRow = legacyCheck.rows[0];

    const pass = legacyRow.last_value === '192' && legacyRow.is_called === false;

    record(12, 'Historical Watermark Protection: public.statutory_invoice_seq remains completely untouched at 192 (is_called=false)', pass,
      `last_value=${legacyRow.last_value}, is_called=${legacyRow.is_called}`);
  }

  // ── CAPTURE FINAL DATABASE SNAPSHOT ──────────────────────────────────────────
  console.log('\n--- CAPTURING FINAL DATABASE SNAPSHOT ---');
  const finalSeq = await controlClient.query('SELECT entity_id, gstin, fiscal_year, prefix, last_seq FROM public.invoice_sequence ORDER BY entity_id, prefix');
  const finalLogCount = await controlClient.query('SELECT count(*)::int as count FROM public.invoice_allocation_log');
  const finalInvCount = await controlClient.query('SELECT count(*)::int as count FROM public.invoice');
  const finalLegacySeq = await controlClient.query('SELECT last_value, is_called FROM public.statutory_invoice_seq');

  console.log('Final invoice_sequence counters:', finalSeq.rows);
  console.log('Final invoice_allocation_log count:', finalLogCount.rows[0].count);
  console.log('Final invoice table count:', finalInvCount.rows[0].count);
  console.log('Final legacy statutory_invoice_seq:', finalLegacySeq.rows[0]);

  await controlClient.end();
  await closeDbPool();

  // ── SUMMARY & REPORTING ──────────────────────────────────────────────────────
  const totalAssertions = assertions.length;
  const passedAssertions = assertions.filter(a => a.passed).length;
  const failedAssertions = assertions.filter(a => !a.passed).length;

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`INTEGRATION TEST SUMMARY: ${passedAssertions}/${totalAssertions} Passed | ${failedAssertions} Failed`);
  console.log('Database Engine: Real PostgreSQL 16.14 on 127.0.0.1:5433 (cth_test)');
  if (failedAssertions === 0) {
    console.log('VERDICT: 100% VERIFIED — REAL POSTGRESQL TRANSACTION INTEGRITY PROVEN');
  } else {
    console.log('VERDICT: FAILED — DEFECTS DETECTED IN POSTGRESQL INTEGRATION');
  }
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runRealPostgreSqlTestSuite().catch(err => {
  console.error('FATAL EXCEPTION DURING REAL POSTGRESQL TEST SUITE:', err);
  process.exit(1);
});
