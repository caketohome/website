const { Client } = require('../frontend/node_modules/pg');
const client = new Client({ connectionString: '[REDACTED_DATABASE_CREDENTIAL]' });

async function run() {
  await client.connect();

  console.log("=== INDIRANAGAR SESSIONS CHRONOLOGICAL TRACE ===");
  const indiSessions = await client.query(`
    SELECT 
      id, teller_id, status, opening_float, expected_cash, closing_count, variance,
      opened_by, opened_at, closed_by, closed_at, settled_by, settled_at, settlement_voucher_id, notes
    FROM teller_session
    WHERE branch_id = 'br_indiranagar'
    ORDER BY created_at ASC
  `);

  for (const s of indiSessions.rows) {
    console.log(`\nSession ${s.id} (${s.status})`);
    console.log(`  Opened: ${s.opened_at} by ${s.opened_by} with float ₹${s.opening_float}`);
    console.log(`  Closed: ${s.closed_at} by ${s.closed_by} count ₹${s.closing_count} (Expected: ₹${s.expected_cash}, Variance: ₹${s.variance})`);
    console.log(`  Settled: ${s.settled_at} by ${s.settled_by}, Voucher: ${s.settlement_voucher_id}`);

    const movs = await client.query(`
      SELECT id, direction, movement_type, amount, source_type, source_id, narration, created_at
      FROM teller_movement
      WHERE teller_session_id = $1
      ORDER BY created_at ASC
    `, [s.id]);
    console.log(`  Movements (${movs.rows.length}):`);
    console.table(movs.rows);
  }

  console.log("\n=== KORAMANGALA SESSIONS CHRONOLOGICAL TRACE ===");
  const korSessions = await client.query(`
    SELECT 
      id, teller_id, status, opening_float, expected_cash, closing_count, variance,
      opened_by, opened_at, closed_by, closed_at, settled_by, settled_at, settlement_voucher_id, notes
    FROM teller_session
    WHERE branch_id = 'br_koramangala'
    ORDER BY created_at ASC
  `);

  for (const s of korSessions.rows) {
    console.log(`\nSession ${s.id} (${s.status})`);
    console.log(`  Opened: ${s.opened_at} by ${s.opened_by} with float ₹${s.opening_float}`);
    console.log(`  Closed: ${s.closed_at} by ${s.closed_by} count ₹${s.closing_count} (Expected: ₹${s.expected_cash}, Variance: ₹${s.variance})`);
    console.log(`  Settled: ${s.settled_at} by ${s.settled_by}, Voucher: ${s.settlement_voucher_id}`);

    const movs = await client.query(`
      SELECT id, direction, movement_type, amount, source_type, source_id, narration, created_at
      FROM teller_movement
      WHERE teller_session_id = $1
      ORDER BY created_at ASC
    `, [s.id]);
    console.log(`  Movements (${movs.rows.length}):`);
    console.table(movs.rows);
  }

  // Check if bank deposit or brs tables exist and have records
  const bankTables = ['bank_deposit', 'bank_statement_line', 'bank_reconciliation_item', 'branch_cash_transfer'];
  for (const t of bankTables) {
    try {
      const res = await client.query(`SELECT count(*) FROM ${t}`);
      console.log(`Table ${t}: ${res.rows[0].count} rows`);
    } catch (e) {
      console.log(`Table ${t}: does not exist`);
    }
  }

  await client.end();
}

run().catch(console.error);
