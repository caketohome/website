const fs = require('fs');
const { Pool } = require('pg');

const envContent = fs.readFileSync('.env', 'utf8');
const match = envContent.match(/DATABASE_URL=([^\r\n]+)/);
const pool = new Pool({
  connectionString: match[1].trim(),
  ssl: { rejectUnauthorized: false },
  max: 25
});

async function runConcurrencyAndIdempotencySuite() {
  console.log("=== RUNNING SAFE CONCURRENCY & IDEMPOTENCY TEST SUITE ===\n");

  const setupClient = await pool.connect();
  try {
    console.log("1. Creating isolated test schema 'qa_test_numbering'...");
    await setupClient.query(`
      CREATE SCHEMA IF NOT EXISTS qa_test_numbering;

      CREATE TABLE qa_test_numbering.order_sequence (
        prefix TEXT PRIMARY KEY,
        last_seq INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE qa_test_numbering.invoice_sequence (
        entity_id TEXT NOT NULL,
        fiscal_year INTEGER NOT NULL,
        prefix TEXT NOT NULL,
        last_seq INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (entity_id, fiscal_year, prefix)
      );

      CREATE TABLE qa_test_numbering.test_order (
        id TEXT PRIMARY KEY,
        order_number TEXT UNIQUE,
        idempotency_key TEXT UNIQUE,
        status TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("  Isolated schema and tables created.\n");
  } finally {
    setupClient.release();
  }

  try {
    // 2. Test Monotonic Concurrency for Order Number Allocation
    console.log("2. Testing 20 Concurrent Workers Allocating Order Numbers...");
    
    async function allocateOrderNumberTest(workerId) {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        // Lock per prefix
        await c.query("SELECT pg_advisory_xact_lock(hashtext('qa_test::order_seq::CTH')::bigint)");
        
        const dateStr = "20261021";
        const res = await c.query(`
          INSERT INTO qa_test_numbering.order_sequence (prefix, last_seq)
          VALUES ('CTH', 1)
          ON CONFLICT (prefix) DO UPDATE
            SET last_seq = qa_test_numbering.order_sequence.last_seq + 1,
                updated_at = NOW()
          RETURNING last_seq;
        `);
        const seq = res.rows[0].last_seq;
        const orderNum = `CTH-${dateStr}-${String(seq).padStart(6, '0')}`;
        await c.query("COMMIT");
        return { workerId, seq, orderNum };
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    }

    const workers = Array.from({ length: 20 }, (_, i) => allocateOrderNumberTest(i + 1));
    const results = await Promise.all(workers);

    const orderNumbers = results.map(r => r.orderNum);
    const uniqueOrderNumbers = new Set(orderNumbers);
    const sequences = results.map(r => r.seq).sort((a, b) => a - b);

    console.log(`  Workers executed: ${results.length}`);
    console.log(`  Unique order numbers generated: ${uniqueOrderNumbers.size} / 20`);
    console.log(`  Min seq: ${sequences[0]}, Max seq: ${sequences[sequences.length - 1]}`);
    const isSequential = sequences.every((v, idx) => v === idx + 1);
    console.log(`  Strictly contiguous 1 to 20 without gaps/dups: ${isSequential ? 'PASS' : 'FAIL'}`);
    if (uniqueOrderNumbers.size === 20 && isSequential) {
      console.log("  Order Concurrency Test: 100% PASSED.\n");
    } else {
      console.error("  Order Concurrency Test: FAILED.\n");
    }

    // 3. Test Monotonic Concurrency for Multi-Entity / Multi-GSTIN Invoice Sequence
    console.log("3. Testing Concurrent Invoice Sequence Allocation across 2 Issuing Entities...");
    
    async function allocateInvoiceNumberTest(workerId, entityId, prefix) {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const lockKey = `qa_test::${entityId}::${prefix}::2026`;
        await c.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [lockKey]);

        const res = await c.query(`
          INSERT INTO qa_test_numbering.invoice_sequence (entity_id, fiscal_year, prefix, last_seq)
          VALUES ($1, 2026, $2, 1)
          ON CONFLICT (entity_id, fiscal_year, prefix) DO UPDATE
            SET last_seq = qa_test_numbering.invoice_sequence.last_seq + 1,
                updated_at = NOW()
          RETURNING last_seq;
        `, [entityId, prefix]);

        const seq = res.rows[0].last_seq;
        const invNum = `${prefix}/26-27/${String(seq).padStart(6, '0')}`;
        await c.query("COMMIT");
        return { workerId, entityId, prefix, seq, invNum };
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    }

    // Launch 10 concurrent requests for CakeToHome ('CTH') and 10 for Partner Store A ('PRT-KOLLAM')
    const entityWorkers = [
      ...Array.from({ length: 10 }, (_, i) => allocateInvoiceNumberTest(i + 1, 'CAKETOHOME_PARENT', 'CTH')),
      ...Array.from({ length: 10 }, (_, i) => allocateInvoiceNumberTest(i + 11, 'PARTNER_KOLLAM_01', 'PRT-KLM'))
    ];
    const entityResults = await Promise.all(entityWorkers);

    const cthResults = entityResults.filter(r => r.entityId === 'CAKETOHOME_PARENT');
    const partnerResults = entityResults.filter(r => r.entityId === 'PARTNER_KOLLAM_01');

    const cthUnique = new Set(cthResults.map(r => r.invNum));
    const partnerUnique = new Set(partnerResults.map(r => r.invNum));

    console.log(`  Entity CTH Invoices: ${cthUnique.size}/10 unique (Min: ${Math.min(...cthResults.map(r => r.seq))}, Max: ${Math.max(...cthResults.map(r => r.seq))})`);
    console.log(`  Entity Partner Invoices: ${partnerUnique.size}/10 unique (Min: ${Math.min(...partnerResults.map(r => r.seq))}, Max: ${Math.max(...partnerResults.map(r => r.seq))})`);
    console.log(`  Sample CTH: ${Array.from(cthUnique).slice(0, 3).join(', ')}`);
    console.log(`  Sample Partner: ${Array.from(partnerUnique).slice(0, 3).join(', ')}`);
    
    if (cthUnique.size === 10 && partnerUnique.size === 10) {
      console.log("  Multi-Entity Invoice Concurrency: 100% PASSED.\n");
    } else {
      console.error("  Multi-Entity Invoice Concurrency: FAILED.\n");
    }

    // 4. Test Concurrent Idempotent Requests (5 workers with the SAME idempotency key)
    console.log("4. Testing 5 Concurrent Workers with Identical Idempotency Key...");

    const sharedIdemKey = "idem_test_race_concurrent_001";
    let orderCounter = 100;

    async function placeOrderIdempotent(workerId) {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");

        // 1. Authoritative lock on idempotency key
        const idemLock = `qa_test::idem_lock::${sharedIdemKey}`;
        await c.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [idemLock]);

        // 2. Check if already created
        const existing = await c.query("SELECT * FROM qa_test_numbering.test_order WHERE idempotency_key = $1", [sharedIdemKey]);
        if (existing.rows.length > 0) {
          await c.query("COMMIT");
          return { workerId, order: existing.rows[0], wasCreated: false };
        }

        // 3. If not created, allocate and insert
        orderCounter++;
        const newOrderNum = `CTH-20261021-${String(orderCounter).padStart(6, '0')}`;
        const newOrderId = `ord_test_${workerId}`;

        const inserted = await c.query(`
          INSERT INTO qa_test_numbering.test_order (id, order_number, idempotency_key, status)
          VALUES ($1, $2, $3, 'confirmed')
          RETURNING *;
        `, [newOrderId, newOrderNum, sharedIdemKey]);

        await c.query("COMMIT");
        return { workerId, order: inserted.rows[0], wasCreated: true };
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    }

    const idemWorkers = Array.from({ length: 5 }, (_, i) => placeOrderIdempotent(i + 1));
    const idemResults = await Promise.all(idemWorkers);

    const createdCount = idemResults.filter(r => r.wasCreated).length;
    const replayedCount = idemResults.filter(r => !r.wasCreated).length;
    const returnedOrderNumbers = new Set(idemResults.map(r => r.order.order_number));

    console.log(`  Concurrent identical submissions: ${idemResults.length}`);
    console.log(`  Orders created: ${createdCount} (Expected: 1)`);
    console.log(`  Idempotent replays: ${replayedCount} (Expected: 4)`);
    console.log(`  All workers received identical order number: ${returnedOrderNumbers.size === 1 ? 'PASS (' + Array.from(returnedOrderNumbers)[0] + ')' : 'FAIL'}`);

    if (createdCount === 1 && replayedCount === 4 && returnedOrderNumbers.size === 1) {
      console.log("  Idempotency Concurrency Test: 100% PASSED.\n");
    } else {
      console.error("  Idempotency Concurrency Test: FAILED.\n");
    }

  } finally {
    // Teardown test schema
    const teardownClient = await pool.connect();
    try {
      console.log("5. Cleaning up test schema 'qa_test_numbering'...");
      await teardownClient.query("DROP SCHEMA IF EXISTS qa_test_numbering CASCADE;");
      console.log("  Schema 'qa_test_numbering' dropped cleanly. Zero residual data.\n");
    } finally {
      teardownClient.release();
      await pool.end();
    }
  }
}

runConcurrencyAndIdempotencySuite().catch(console.error);
