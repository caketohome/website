/**
 * Independent Read-Only PostgreSQL Forensic Verification Script
 *
 * READ-ONLY: ZERO MUTATIONS, ZERO WRITES, ZERO ROLLBACKS.
 * Queries PostgreSQL catalog and application tables to document the actual live state.
 */

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

async function runReadOnlyForensics() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('================================================================');
  console.log('CAKETOHOME ERP — LIVE DATABASE INDEPENDENT FORENSIC VERIFICATION');
  console.log('Execution Mode: STRICTLY READ-ONLY');
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================\n');

  // ── AREA 1: ACTUAL DATABASE SCHEMA & TABLES ────────────────────────────────
  console.log('--- 1. TABLE INVENTORY & PRESENCE ---');
  const targetTables = [
    'order_sequence',
    'invoice_sequence',
    'invoice_allocation_log',
    'invoice_generation_queue',
    'order_number_migration_log',
    'order',
    'invoice',
    'accounting_voucher',
    'accounting_journal_entry',
    'accounting_journal_line',
    'order_lifecycle_refund',
    'refund',
    'gst_registration',
    'company'
  ];

  const tableQuery = await client.query(`
    SELECT table_name, table_type
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = ANY($1::text[])
    ORDER BY table_name;
  `, [targetTables]);

  console.table(tableQuery.rows);

  // ── AREA 2: COLUMNS ON "order" TABLE ───────────────────────────────────────
  console.log('\n--- 2. "order" TABLE COLUMNS & DATA TYPES ---');
  const orderCols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'order'
      AND column_name IN ('id', 'display_id', 'order_number', 'status', 'created_at', 'metadata')
    ORDER BY ordinal_position;
  `);
  console.table(orderCols.rows);

  // ── AREA 3: UNIQUE INDEXES & CONSTRAINTS ───────────────────────────────────
  console.log('\n--- 3. UNIQUE INDEXES & CONSTRAINTS ---');
  const indexQuery = await client.query(`
    SELECT 
      i.relname as index_name,
      t.relname as table_name,
      ix.indisunique as is_unique,
      pg_get_indexdef(ix.indexrelid) as index_definition
    FROM pg_index ix
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND (
        i.relname ILIKE '%order_number%' OR
        i.relname ILIKE '%invoice_number%' OR
        i.relname ILIKE '%invoice_allocation%' OR
        i.relname ILIKE '%order_sequence%' OR
        i.relname ILIKE '%invoice_sequence%' OR
        i.relname ILIKE '%invoice_queue%'
      )
    ORDER BY t.relname, i.relname;
  `);
  console.table(indexQuery.rows.map(r => ({
    table: r.table_name,
    index: r.index_name,
    unique: r.is_unique,
    def: r.index_definition
  })));

  // ── AREA 4: STORED PROCEDURES & FUNCTIONS ──────────────────────────────────
  console.log('\n--- 4. STORED PROCEDURES / FUNCTIONS (SECURITY & OWNERSHIP) ---');
  const funcQuery = await client.query(`
    SELECT 
      p.proname as function_name,
      r.rolname as owner,
      l.lanname as language,
      p.prosecdef as is_security_definer,
      p.proconfig as config_search_path,
      pg_get_function_identity_arguments(p.oid) as arguments
    FROM pg_proc p
    JOIN pg_roles r ON r.oid = p.proowner
    JOIN pg_language l ON l.oid = p.prolang
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'allocate_order_number',
        'allocate_invoice_number',
        'commit_invoice_allocation',
        'void_invoice_allocation'
      )
    ORDER BY p.proname;
  `);
  console.table(funcQuery.rows);

  // ── AREA 5: ROW-LEVEL SECURITY & POLICIES ──────────────────────────────────
  console.log('\n--- 5. RLS STATUS & POLICIES ---');
  const rlsStatus = await client.query(`
    SELECT 
      c.relname as table_name,
      c.relrowsecurity as rls_enabled,
      c.relforcerowsecurity as rls_enforced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('order_sequence', 'invoice_sequence', 'invoice_allocation_log', 'invoice_generation_queue', 'order_number_migration_log')
    ORDER BY c.relname;
  `);
  console.table(rlsStatus.rows);

  const policyQuery = await client.query(`
    SELECT 
      tablename,
      policyname,
      roles,
      cmd,
      qual as using_expression,
      with_check as with_check_expression
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('order_sequence', 'invoice_sequence', 'invoice_allocation_log', 'invoice_generation_queue', 'order_number_migration_log')
    ORDER BY tablename, policyname;
  `);
  console.table(policyQuery.rows.map(r => ({
    table: r.tablename,
    policy: r.policyname,
    roles: r.roles,
    cmd: r.cmd,
    using: r.using_expression
  })));

  // ── AREA 6: SEQUENCE COUNTERS & WATERMARKS ─────────────────────────────────
  console.log('\n--- 6. SEQUENCE COUNTERS & WATERMARKS ---');
  const orderSeq = await client.query('SELECT * FROM public.order_sequence;');
  console.log('public.order_sequence rows:');
  console.table(orderSeq.rows);

  const invSeq = await client.query('SELECT * FROM public.invoice_sequence;');
  console.log('public.invoice_sequence rows:');
  console.table(invSeq.rows);

  const statSeq = await client.query(`
    SELECT schemaname, sequencename, sequenceowner, last_value, start_value, increment_by 
    FROM pg_sequences 
    WHERE sequencename = 'statutory_invoice_seq' OR schemaname = 'public';
  `);
  console.log('Sequence catalog state (pg_sequences):');
  console.table(statSeq.rows);

  // ── AREA 7: MIGRATION LOG & HISTORICAL RECONCILIATION ──────────────────────
  console.log('\n--- 7. MIGRATION LOG & HISTORICAL ORDER INTEGRITY ---');
  const logStats = await client.query(`
    SELECT 
      disambiguation_rule,
      COUNT(*)::int as record_count,
      MIN(migrated_at) as earliest_migration,
      MAX(migrated_at) as latest_migration
    FROM public.order_number_migration_log
    GROUP BY disambiguation_rule
    ORDER BY record_count DESC;
  `);
  console.log('Migration log breakdown by rule:');
  console.table(logStats.rows);

  const totalMigrated = await client.query('SELECT COUNT(*)::int as count FROM public.order_number_migration_log;');
  console.log('Total migration log entries:', totalMigrated.rows[0].count);

  const ordIntegrity = await client.query(`
    SELECT 
      COUNT(*)::int as total_orders,
      COUNT(order_number)::int as non_null_order_numbers,
      COUNT(DISTINCT order_number)::int as unique_order_numbers,
      COUNT(*) FILTER (WHERE order_number IS NULL)::int as missing_order_numbers
    FROM public."order";
  `);
  console.log('Order table integrity:');
  console.table(ordIntegrity.rows);

  // Check the 8 historical duplicates specifically
  const dupCheck = await client.query(`
    SELECT 
      id, display_id, order_number, 
      metadata->>'order_number' as current_meta_num,
      metadata->>'legacy_order_number' as legacy_meta_num,
      created_at
    FROM public."order"
    WHERE metadata->>'legacy_order_number' IN ('CTH-20260828-101', 'CTH-20260828-214')
       OR order_number LIKE 'CTH-20260828-101%'
       OR order_number LIKE 'CTH-20260828-214%'
    ORDER BY order_number, created_at;
  `);
  console.log('\nHistorical 8 Duplicate Orders Verified:');
  console.table(dupCheck.rows);

  // ── AREA 8: INVOICE TABLE AUDIT ────────────────────────────────────────────
  console.log('\n--- 8. INVOICE TABLE ROWS & STATUTORY NUMBERING ---');
  const invRows = await client.query(`
    SELECT id, order_id, invoice_number, subtotal, tax_total, grand_total, status,
           delivered_at, created_at, metadata->>'issue_date' as meta_issue_date
    FROM public.invoice
    ORDER BY created_at ASC;
  `);
  console.table(invRows.rows);

  // ── AREA 9: TABLE MUTATION PRIVILEGES FOR AUTHENTICATED / ANON ─────────────
  console.log('\n--- 9. TABLE PRIVILEGES (LEAST PRIVILEGE AUDIT) ---');
  const privCheck = await client.query(`
    SELECT 
      grantee, 
      table_name, 
      privilege_type
    FROM information_schema.role_table_grants 
    WHERE table_schema = 'public' 
      AND table_name IN ('order_sequence', 'invoice_sequence', 'invoice_allocation_log', 'invoice_generation_queue', 'order_number_migration_log')
      AND grantee IN ('authenticated', 'anon', 'public')
    ORDER BY table_name, grantee, privilege_type;
  `);
  console.log('Direct grants to authenticated/anon/public on numbering tables:');
  console.table(privCheck.rows);

  await client.end();
}

runReadOnlyForensics().catch(console.error);
