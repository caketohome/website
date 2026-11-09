const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../frontend/node_modules/pg'));

function getConn() {
  const env = fs.readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      return val;
    }
  }
}

async function investigateCash() {
  const client = new Client({ connectionString: getConn(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=============================================================================');
  console.log('Task 3: Forensic Investigation of Cash & Petty Cash Credit Balances');
  console.log('=============================================================================\n');

  // 1. Inspect the expense records referenced by the two expense vouchers
  console.log('[1] Inspecting Source Expenses in public.expense:');
  const expRes = await client.query(`
    SELECT *
    FROM public.expense
    WHERE id IN ('exp_00MUV2R84RI83TJK', 'exp_00MUV2UTHQBZRMJV', 'exp_00MUV2URWAO62XAU')
  `);
  console.table(expRes.rows);

  // 2. Inspect Teller Shifts & Cash Drawers
  console.log('\n[2] Inspecting Teller Shifts & Cash Custody (teller_shift / cash_drawer):');
  const shiftTables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema='public' AND (table_name LIKE '%shift%' OR table_name LIKE '%teller%' OR table_name LIKE '%vault%' OR table_name LIKE '%drawer%')
  `);
  console.log('Custody/Shift tables found:', shiftTables.rows.map(r => r.table_name));

  for (const t of shiftTables.rows) {
    try {
      const cnt = await client.query(`SELECT count(*)::int as count FROM public.${t.table_name}`);
      console.log(`  - Table ${t.table_name}: ${cnt.rows[0].count} rows`);
      if (cnt.rows[0].count > 0 && cnt.rows[0].count < 10) {
        const sample = await client.query(`SELECT * FROM public.${t.table_name} LIMIT 5`);
        console.table(sample.rows);
      }
    } catch (e) {
      console.log(`  - Table ${t.table_name}: query failed (${e.message})`);
    }
  }

  // 3. Inspect Customer Orders / Payments / Cash Receipts
  console.log('\n[3] Inspecting Cash Inflows / Orders / Payments:');
  const payRes = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema='public' AND (table_name LIKE '%payment%' OR table_name LIKE '%receipt%' OR table_name LIKE '%collection%')
  `);
  console.log('Payment/Receipt tables:', payRes.rows.map(r => r.table_name));

  // Check if any payment records exist in payment or order_payment
  for (const t of ['payment', 'order_payment', 'customer_payment', 'customer_receipt']) {
    if (payRes.rows.some(r => r.table_name === t)) {
      const c = await client.query(`SELECT count(*)::int as count FROM public.${t}`);
      console.log(`  - ${t}: ${c.rows[0].count} rows`);
      if (c.rows[0].count > 0) {
        const s = await client.query(`SELECT * FROM public.${t} LIMIT 3`);
        console.table(s.rows);
      }
    }
  }

  // 4. Trace the two SoD test vouchers
  console.log('\n[4] Tracing the Two SoD Acceptance Test Vouchers:');
  const sodVch = await client.query(`
    SELECT * FROM public.accounting_voucher 
    WHERE id IN ('vch_00MUR19MJGEZP9JC', 'vch_00MUR1BRX9F9X7J8')
  `);
  console.table(sodVch.rows);

  await client.end();
}

investigateCash().catch(err => {
  console.error('Task 3 investigation failed:', err);
  process.exit(1);
});
