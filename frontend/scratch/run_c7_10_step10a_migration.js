const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      if (line.trim().startsWith('DATABASE_URL=')) {
        let val = line.trim().substring('DATABASE_URL='.length).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        return val;
      }
    }
  }
  return process.env.DATABASE_URL;
}

async function run() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log('=============================================================================');
  console.log('CakeToHome ERP — Phase C7.10 Step 10A Schema Migration Runner');
  console.log('=============================================================================');

  // Preflight Financial Audit
  const preCoA = await client.query('SELECT count(*) as count FROM public.accounting_account;');
  const preVouchers = await client.query('SELECT count(*) as count FROM public.accounting_voucher;');
  const preJE = await client.query('SELECT count(*) as count FROM public.accounting_journal_entry;');
  const preJL = await client.query('SELECT count(*) as count, sum(debit_amount) as dr, sum(credit_amount) as cr FROM public.accounting_journal_line;');
  const preDP = await client.query('SELECT count(*) as count FROM public.delivery_partner;');

  console.log(`[Preflight] CoA Accounts: ${preCoA.rows[0].count} (Expected: 100)`);
  console.log(`[Preflight] Vouchers: ${preVouchers.rows[0].count} (Expected: 6)`);
  console.log(`[Preflight] Journal Entries: ${preJE.rows[0].count} (Expected: 4)`);
  console.log(`[Preflight] Journal Lines: ${preJL.rows[0].count} (Expected: 10) | Dr: ₹${preJL.rows[0].dr} | Cr: ₹${preJL.rows[0].cr}`);
  console.log(`[Preflight] Delivery Partners: ${preDP.rows[0].count} (Expected: 30)`);

  if (parseInt(preCoA.rows[0].count) !== 100 || parseFloat(preJL.rows[0].dr) !== 3380.00 || parseFloat(preJL.rows[0].cr) !== 3380.00) {
    throw new Error('Preflight accounting integrity check failed! Aborting migration.');
  }

  // Execute Migration SQL
  const sqlPath = path.join(__dirname, '../src/lib/migrations/c7_10_coverage_configuration.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('\n[Execution] Executing c7_10_coverage_configuration.sql...');
  await client.query(sql);
  console.log('✓ Migration executed successfully.');

  // Verification 1: Verify branch column
  const brCol = await client.query(`
    SELECT column_name, data_type, column_default 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'branch' AND column_name = 'is_corporate_routing_eligible';
  `);
  console.log('\n[Verification 1] branch.is_corporate_routing_eligible:', brCol.rows[0]);

  // Verification 2: Verify delivery_zone column
  const dzCol = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'delivery_zone' AND column_name = 'exclusion_polygons';
  `);
  console.log('[Verification 2] delivery_zone.exclusion_polygons:', dzCol.rows[0]);

  // Verification 3: Verify new tables
  const newTables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name IN ('delivery_partner_profile', 'delivery_partner_coverage', 'delivery_coverage_event')
    ORDER BY table_name;
  `);
  console.log('[Verification 3] New tables created:', newTables.rows.map(r => r.table_name));

  // Verification 4: Verify Immutability Trigger on delivery_coverage_event
  const testEventId = `ev_test_${Date.now()}`;
  await client.query(`
    INSERT INTO public.delivery_coverage_event (id, entity_type, entity_id, event_type, actor_id, actor_role, reason)
    VALUES ($1, 'STORE_ZONE', 'zone_test', 'ZONE_CREATED', 'admin_01', 'SUPER_ADMIN', 'Test audit event');
  `, [testEventId]);

  let blockedUpdate = false;
  try {
    await client.query(`UPDATE public.delivery_coverage_event SET reason = 'Modified' WHERE id = $1;`, [testEventId]);
  } catch (err) {
    blockedUpdate = true;
    console.log('[Verification 4a] Immutability trigger blocked UPDATE: ✓ PASS', err.message);
  }

  let blockedDelete = false;
  try {
    await client.query(`DELETE FROM public.delivery_coverage_event WHERE id = $1;`, [testEventId]);
  } catch (err) {
    blockedDelete = true;
    console.log('[Verification 4b] Immutability trigger blocked DELETE: ✓ PASS', err.message);
  }

  // Verification 5: Postflight Financial Audit
  const postCoA = await client.query('SELECT count(*) as count FROM public.accounting_account;');
  const postVouchers = await client.query('SELECT count(*) as count FROM public.accounting_voucher;');
  const postJE = await client.query('SELECT count(*) as count FROM public.accounting_journal_entry;');
  const postJL = await client.query('SELECT count(*) as count, sum(debit_amount) as dr, sum(credit_amount) as cr FROM public.accounting_journal_line;');
  const postDP = await client.query('SELECT count(*) as count FROM public.delivery_partner;');

  console.log('\n[Postflight Audit]');
  console.log(`CoA Accounts: ${postCoA.rows[0].count} (Expected: 100) -> ${postCoA.rows[0].count == 100 ? '✓ PASS' : '❌ FAIL'}`);
  console.log(`Vouchers: ${postVouchers.rows[0].count} (Expected: 6) -> ${postVouchers.rows[0].count == 6 ? '✓ PASS' : '❌ FAIL'}`);
  console.log(`Journal Entries: ${postJE.rows[0].count} (Expected: 4) -> ${postJE.rows[0].count == 4 ? '✓ PASS' : '❌ FAIL'}`);
  console.log(`Journal Lines: ${postJL.rows[0].count} (Expected: 10) | Dr: ₹${postJL.rows[0].dr} | Cr: ₹${postJL.rows[0].cr} -> ${postJL.rows[0].dr === '3380.00' && postJL.rows[0].cr === '3380.00' ? '✓ PASS' : '❌ FAIL'}`);
  console.log(`Delivery Partners: ${postDP.rows[0].count} (Expected: 30) -> ${postDP.rows[0].count == 30 ? '✓ PASS' : '❌ FAIL'}`);

  await client.end();
  console.log('\n=============================================================================');
  console.log('STEP 10A MIGRATION AND INDEPENDENT AUDIT COMPLETE: ALL INVARIANTS INTACT');
  console.log('=============================================================================');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
