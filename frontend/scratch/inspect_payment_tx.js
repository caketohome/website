/**
 * Inspect payment_transaction rows in live DB
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('../node_modules/pg');

function getConnectionString() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      let val = line.substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  throw new Error("No database connection string found");
}

async function inspectPayments() {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();
  try {
    const res = await client.query(`
      SELECT id, order_id, amount, currency, status, settlement_status, provider, provider_ref, idempotency_key
      FROM public.payment_transaction
      LIMIT 10;
    `);
    console.table(res.rows);

    const statuses = await client.query(`
      SELECT status, count(*)
      FROM public.payment_transaction
      GROUP BY status;
    `);
    console.log('\nStatus counts:');
    console.table(statuses.rows);

    const settlementStatuses = await client.query(`
      SELECT settlement_status, count(*)
      FROM public.payment_transaction
      GROUP BY settlement_status;
    `);
    console.log('\nSettlement status counts:');
    console.table(settlementStatuses.rows);

    // Check order total vs payment amount
    const joinCheck = await client.query(`
      SELECT o.id as order_id, o.metadata->>'total_amount' as meta_total, pt.amount as pt_amount
      FROM public."order" o
      JOIN public.payment_transaction pt ON pt.order_id = o.id
      LIMIT 5;
    `);
    console.log('\nOrder total vs payment amount:');
    console.table(joinCheck.rows);

  } finally {
    await client.end();
  }
}

inspectPayments().catch(console.error);
