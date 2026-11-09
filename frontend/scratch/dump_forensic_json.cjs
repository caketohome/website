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

async function run() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const results = {};

  // 1. Target tables
  const targetTables = [
    'order_sequence', 'invoice_sequence', 'invoice_allocation_log', 
    'invoice_generation_queue', 'order_number_migration_log',
    'order', 'invoice', 'accounting_voucher', 'accounting_journal_entry',
    'accounting_journal_line', 'order_lifecycle_refund', 'refund', 'gst_registration', 'company'
  ];
  const tq = await client.query(`
    SELECT table_name, table_type 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = ANY($1::text[]) 
    ORDER BY table_name;
  `, [targetTables]);
  results.tables = tq.rows;

  // 2. Order columns
  const cq = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'order' 
      AND column_name IN ('id', 'display_id', 'order_number', 'status', 'created_at', 'metadata') 
    ORDER BY ordinal_position;
  `);
  results.order_columns = cq.rows;

  // 3. Indexes
  const idxQ = await client.query(`
    SELECT i.relname as index_name, t.relname as table_name, ix.indisunique as is_unique, pg_get_indexdef(ix.indexrelid) as index_definition
    FROM pg_index ix
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND (i.relname ILIKE '%order_number%' OR i.relname ILIKE '%invoice_number%' OR i.relname ILIKE '%invoice_allocation%' OR i.relname ILIKE '%order_sequence%' OR i.relname ILIKE '%invoice_sequence%' OR i.relname ILIKE '%invoice_queue%')
    ORDER BY t.relname, i.relname;
  `);
  results.indexes = idxQ.rows;

  // 4. Stored functions
  const funcQ = await client.query(`
    SELECT p.proname as function_name, r.rolname as owner, l.lanname as language, p.prosecdef as is_security_definer, p.proconfig as config_search_path, pg_get_function_identity_arguments(p.oid) as arguments
    FROM pg_proc p
    JOIN pg_roles r ON r.oid = p.proowner
    JOIN pg_language l ON l.oid = p.prolang
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('allocate_order_number', 'allocate_invoice_number', 'commit_invoice_allocation', 'void_invoice_allocation')
    ORDER BY p.proname;
  `);
  results.functions = funcQ.rows;

  // 5. RLS
  const rlsQ = await client.query(`
    SELECT c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_enforced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('order_sequence', 'invoice_sequence', 'invoice_allocation_log', 'invoice_generation_queue', 'order_number_migration_log')
    ORDER BY c.relname;
  `);
  results.rls_status = rlsQ.rows;

  const polQ = await client.query(`
    SELECT tablename, policyname, roles, cmd, qual as using_expression, with_check as with_check_expression
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('order_sequence', 'invoice_sequence', 'invoice_allocation_log', 'invoice_generation_queue', 'order_number_migration_log')
    ORDER BY tablename, policyname;
  `);
  results.policies = polQ.rows;

  // 6. Sequences & watermarks
  results.order_sequence = (await client.query('SELECT * FROM public.order_sequence;')).rows;
  results.invoice_sequence = (await client.query('SELECT * FROM public.invoice_sequence;')).rows;
  results.pg_sequences = (await client.query(`SELECT schemaname, sequencename, sequenceowner, last_value, start_value, increment_by FROM pg_sequences WHERE sequencename = 'statutory_invoice_seq' OR schemaname = 'public';`)).rows;

  // 7. Migration log breakdown
  results.migration_log_summary = (await client.query(`
    SELECT disambiguation_rule, COUNT(*)::int as count, MIN(migrated_at) as earliest, MAX(migrated_at) as latest
    FROM public.order_number_migration_log
    GROUP BY disambiguation_rule;
  `)).rows;

  // 8. Invoices
  results.invoices = (await client.query(`SELECT id, order_id, invoice_number, subtotal, tax_total, grand_total, status, delivered_at, created_at, metadata->>'issue_date' as meta_issue_date FROM public.invoice ORDER BY created_at ASC;`)).rows;

  // 9. Role table grants
  results.grants = (await client.query(`
    SELECT grantee, table_name, privilege_type
    FROM information_schema.role_table_grants 
    WHERE table_schema = 'public' 
      AND table_name IN ('order_sequence', 'invoice_sequence', 'invoice_allocation_log', 'invoice_generation_queue', 'order_number_migration_log')
      AND grantee IN ('authenticated', 'anon', 'public')
    ORDER BY table_name, grantee, privilege_type;
  `)).rows;

  // 10. Audit of callers / invoice allocation log contents
  results.invoice_allocation_log_count = (await client.query('SELECT COUNT(*)::int as count FROM public.invoice_allocation_log;')).rows[0].count;
  results.invoice_generation_queue_count = (await client.query('SELECT COUNT(*)::int as count FROM public.invoice_generation_queue;')).rows[0].count;

  // 11. Database transaction timestamp of migration log
  const txTimeQ = await client.query(`
    SELECT migrated_at, count(*) 
    FROM public.order_number_migration_log 
    GROUP BY migrated_at 
    ORDER BY migrated_at;
  `);
  results.migration_timestamps = txTimeQ.rows;

  const outputPath = path.resolve(__dirname, 'forensic_results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log('Forensic results written to', outputPath);
  await client.end();
}

run().catch(console.error);
