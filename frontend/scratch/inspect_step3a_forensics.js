const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

if (!process.env.DATABASE_URL) {
  const envPath = path.join(__dirname, '../../backend/.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      process.env.DATABASE_URL = line.substring('DATABASE_URL='.length).trim();
      break;
    }
  }
}

async function run() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const tables = [
    'purchase',
    'purchase_item',
    'purchase_payment',
    'supplier',
    'branch_inventory',
    'product',
    'product_variant',
    'branch',
    'accounting_account',
    'accounting_voucher',
    'accounting_journal_entry',
    'accounting_journal_line',
    'accounting_fiscal_period',
    'order',
    'payment_transaction'
  ];

  const report = {
    counts: {},
    table_details: {},
    coa_inspection: {},
    product_categories: [],
    sample_products: [],
  };

  for (const t of tables) {
    const qCount = t === 'order' ? 'SELECT COUNT(*)::int as cnt FROM public."order"' : `SELECT COUNT(*)::int as cnt FROM public.${t}`;
    const countRes = await c.query(qCount);
    report.counts[t] = countRes.rows[0].cnt;

    const cols = await c.query(
      "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
      [t]
    );

    const fks = await c.query(`
      SELECT
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule,
        rc.update_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1
    `, [t]);

    const indexes = await c.query(
      "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=$1",
      [t]
    );

    const constraints = await c.query(
      "SELECT conname, contype, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid = $1::regclass",
      [t === 'order' ? 'public."order"' : `public.${t}`]
    );

    report.table_details[t] = {
      columns: cols.rows,
      foreign_keys: fks.rows,
      indexes: indexes.rows,
      constraints: constraints.rows,
    };
  }

  // CoA specific checks for 1131, 1132, 1133, 5110, 5120, 5130
  const coaTargetCodes = ['1131', '1132', '1133', '5110', '5120', '5130'];
  const coaRes = await c.query(
    "SELECT id, code, name, type, subtype, is_group, level, is_active FROM public.accounting_account WHERE code = ANY($1) ORDER BY code",
    [coaTargetCodes]
  );
  report.coa_inspection = coaRes.rows;

  // Product categories / types
  const catRes = await c.query(`
    SELECT DISTINCT category, type FROM public.product WHERE deleted_at IS NULL
  `).catch(() => ({ rows: [] }));
  report.product_categories = catRes.rows;

  // Sample products with variant details
  const prodSample = await c.query(`
    SELECT p.id, p.title, p.handle, p.metadata, pv.id as variant_id, pv.title as variant_title, pv.sku, pv.barcode
    FROM public.product p
    LEFT JOIN public.product_variant pv ON pv.product_id = p.id
    WHERE p.deleted_at IS NULL
    LIMIT 10
  `);
  report.sample_products = prodSample.rows;

  // Check setting for accounting start date
  const settingRes = await c.query("SELECT * FROM public.setting WHERE key = 'accounting_start_date' AND deleted_at IS NULL");
  report.accounting_start_date = settingRes.rows;

  fs.writeFileSync(path.join(__dirname, 'step3a_forensic_report.json'), JSON.stringify(report, null, 2));
  console.log('Forensic report saved to scratch/step3a_forensic_report.json');
  console.log('Counts:', report.counts);
  console.log('\nCoA Target Accounts:');
  for (const a of report.coa_inspection) {
    console.log(`  ${a.code}: ${a.name} (${a.type} / ${a.subtype}, is_group=${a.is_group})`);
  }

  await c.end();
}

run().catch(console.error);
