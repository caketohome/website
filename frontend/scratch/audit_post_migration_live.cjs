const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

let envFile = path.resolve(__dirname, '../../.env');
if (!fs.existsSync(envFile)) envFile = path.resolve(__dirname, '../.env');
const env = fs.readFileSync(envFile, 'utf8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.trim().startsWith('DATABASE_URL=')) {
    dbUrl = line.trim().substring('DATABASE_URL='.length).trim();
    if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
      dbUrl = dbUrl.slice(1, -1);
    }
  }
}

async function auditLive() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('=== COMPREHENSIVE POST-MIGRATION LIVE DATABASE AUDIT ===\n');

  // 1. Table check
  const tblCheck = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('order_sequence', 'invoice_sequence', 'invoice_allocation_log', 'invoice_generation_queue', 'order_number_migration_log')
    ORDER BY table_name;
  `);
  console.log('1. Committed Numbering Infrastructure Tables:', tblCheck.rows.map(r => r.table_name));

  // 2. Column check on order table
  const ordCol = await client.query(`
    SELECT column_name, data_type, is_nullable FROM information_schema.columns 
    WHERE table_name = 'order' AND column_name = 'order_number'
  `);
  console.log('2. order.order_number column:', ordCol.rows[0]);

  // 3. Unique Index check
  const idxCheck = await client.query(`
    SELECT indexname, tablename FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname IN (
      'idx_order_order_number_unique',
      'idx_invoice_invoice_number_unique',
      'uq_invoice_allocation_log_order_active'
    )
    ORDER BY indexname;
  `);
  console.log('3. Active Unique Indexes:', idxCheck.rows);

  // 4. Invariant row counts
  const invCount = await client.query('SELECT COUNT(*) as count FROM public.invoice');
  const ordCount = await client.query('SELECT COUNT(*) as count FROM public."order"');
  const vchCount = await client.query('SELECT COUNT(*) as count FROM public.accounting_voucher');
  const logCount = await client.query('SELECT COUNT(*) as count FROM public.order_number_migration_log');

  console.log('4. Live Row Counts:');
  console.log(`   - public.invoice: ${invCount.rows[0].count} rows (expected 5)`);
  console.log(`   - public.order: ${ordCount.rows[0].count} rows (expected 234)`);
  console.log(`   - public.accounting_voucher: ${vchCount.rows[0].count} rows (expected 98)`);
  console.log(`   - public.order_number_migration_log: ${logCount.rows[0].count} rows (expected 234)`);

  // 5. Check order_number uniqueness across all 234 orders
  const uniqCheck = await client.query(`
    SELECT COUNT(*)::int as total, COUNT(DISTINCT order_number)::int as distinct_count 
    FROM public."order";
  `);
  console.log(`5. Order Number Uniqueness: total = ${uniqCheck.rows[0].total}, distinct = ${uniqCheck.rows[0].distinct_count}`);

  // 6. RLS Policies
  const polCheck = await client.query(`
    SELECT tablename, policyname, roles, cmd 
    FROM pg_policies 
    WHERE tablename IN ('order_sequence', 'invoice_sequence', 'invoice_allocation_log', 'invoice_generation_queue', 'order_number_migration_log')
    ORDER BY tablename, policyname;
  `);
  console.log(`\n6. Active RLS Policies (${polCheck.rows.length} total):`);
  console.table(polCheck.rows);

  // 7. Allocation functions
  const funcCheck = await client.query(`
    SELECT proname, prosecdef FROM pg_proc 
    WHERE proname IN ('allocate_order_number', 'allocate_invoice_number', 'commit_invoice_allocation', 'void_invoice_allocation')
    ORDER BY proname;
  `);
  console.log('7. Installed PL/pgSQL Functions:');
  console.table(funcCheck.rows);

  await client.end();
}

auditLive().catch(console.error);
