const { Client } = require('../frontend/node_modules/pg');
const client = new Client({ connectionString: '[REDACTED_DATABASE_CREDENTIAL]' });

async function run() {
  await client.connect();

  console.log("=== INDIRANAGAR SESSIONS 0 to 3 ===");
  const indiSessions = await client.query(`
    SELECT id, status, opening_float, expected_cash, closing_count, variance, opened_at, closed_at, settled_at, settlement_voucher_id
    FROM teller_session
    WHERE branch_id = 'br_indiranagar'
    ORDER BY created_at ASC
    LIMIT 4
  `);

  for (const s of indiSessions.rows) {
    console.log("\n------------------------------------------------------------");
    console.log(s);
    const movs = await client.query('SELECT direction, movement_type, amount, narration FROM teller_movement WHERE teller_session_id = $1', [s.id]);
    console.log('Movements:', movs.rows);
  }

  await client.end();
}

run().catch(console.error);
