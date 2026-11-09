/**
 * PRG-01 Acceptance Test — Schema Discovery + Baseline (v3)
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  const envPath = path.join(__dirname, '../frontend/.env');
  if (fs.existsSync(envPath)) {
    for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = l.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/);
      if (m) { connectionString = m[1].trim(); break; }
    }
  }
}
if (!connectionString) throw new Error('DATABASE_URL not set');

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('supabase') ? { rejectUnauthorized: false } : false
});

async function getTableColumns(client, tableName) {
  const r = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_schema='public' AND table_name=$1 
    ORDER BY ordinal_position
  `, [tableName]);
  return r.rows.map(r => r.column_name);
}

async function captureBaseline() {
  const client = await pool.connect();
  try {
    console.log('=== PRG-01 DATABASE BASELINE v3 ===');
    console.log(`Timestamp: ${new Date().toISOString()}`);

    // GL Balance
    console.log('\n--- GL Balance ---');
    const gl = await client.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0) as total_debit,
        COALESCE(SUM(credit_amount), 0) as total_credit
      FROM public.accounting_journal_line
    `);
    console.log(`  Debits:  ${gl.rows[0].total_debit}`);
    console.log(`  Credits: ${gl.rows[0].total_credit}`);
    console.log(`  Balanced: ${parseFloat(gl.rows[0].total_debit) === parseFloat(gl.rows[0].total_credit)}`);

    // Voucher schema
    console.log('\n--- Accounting Voucher Schema ---');
    const vCols = await getTableColumns(client, 'accounting_voucher');
    console.log(`  Columns: ${vCols.join(', ')}`);

    // Voucher data
    console.log('\n--- Voucher Data ---');
    const vouchers = await client.query(`SELECT * FROM public.accounting_voucher ORDER BY created_at DESC`);
    vouchers.rows.forEach(r => {
      const info = Object.entries(r).filter(([k,v]) => v !== null).map(([k,v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' | ');
      console.log(`  ${info}`);
    });

    // Invoice schema
    console.log('\n--- Invoice Schema ---');
    const iCols = await getTableColumns(client, 'invoice');
    console.log(`  Columns: ${iCols.join(', ')}`);

    // Invoice data
    console.log('\n--- Invoice Data ---');
    const invs = await client.query(`SELECT * FROM public.invoice ORDER BY created_at DESC`);
    invs.rows.forEach(r => {
      const keep = ['id','invoice_number','order_id','total_amount','tax_amount','subtotal','status','payment_method','created_at'];
      const info = keep.filter(k => r[k] !== null && r[k] !== undefined).map(k => `${k}=${r[k]}`).join(' | ');
      console.log(`  ${info}`);
    });

    // Journal entries
    console.log('\n--- Journal Entry Schema ---');
    const jeCols = await getTableColumns(client, 'accounting_journal_entry');
    console.log(`  Columns: ${jeCols.join(', ')}`);

    console.log('\n--- Journal Entry Data ---');
    const jes = await client.query(`SELECT * FROM public.accounting_journal_entry ORDER BY created_at DESC`);
    jes.rows.forEach(r => {
      const keep = ['id','voucher_id','entry_number','entry_date','description','status','fiscal_period_id','posted_by','approved_by','created_at'];
      const info = keep.filter(k => r[k] !== null && r[k] !== undefined).map(k => `${k}=${r[k]}`).join(' | ');
      console.log(`  ${info}`);
    });

    // Journal lines
    console.log('\n--- Journal Lines Data ---');
    const jls = await client.query(`
      SELECT jl.*, aa.code as account_code, aa.name as account_name
      FROM public.accounting_journal_line jl
      LEFT JOIN public.accounting_account aa ON jl.account_id = aa.id
      ORDER BY jl.journal_entry_id, jl.line_no
    `);
    jls.rows.forEach(r => {
      console.log(`  entry=${r.journal_entry_id?.substring(0,12)}... line=${r.line_no} acct=${r.account_code} ${r.account_name} dr=${r.debit_amount} cr=${r.credit_amount}`);
    });

    // ERP Tables existence
    console.log('\n--- ERP Table Counts ---');
    const erpTables = [
      'accounting_voucher', 'accounting_journal_entry', 'accounting_journal_line',
      'accounting_account', 'accounting_fiscal_period',
      'invoice', 'purchase', 'purchase_item',
      'inventory_movement', 'inventory_cost_lot', 'branch_inventory',
      'supplier', 'expense', 'expense_category',
      'bank_deposit_slip', 'gateway_payout_batch',
      'payment_transaction',
    ];
    const baseline = {};
    for (const t of erpTables) {
      try {
        const r = await client.query(`SELECT COUNT(*) as c FROM public."${t}"`);
        baseline[t] = parseInt(r.rows[0].c, 10);
        console.log(`  ${t}: ${r.rows[0].c}`);
      } catch (err) {
        baseline[t] = 'MISSING';
        console.log(`  ${t}: MISSING`);
      }
    }

    // Orders summary
    console.log('\n--- Orders Summary ---');
    const orderSummary = await client.query(`
      SELECT status, COUNT(*) as cnt FROM public."order" 
      GROUP BY status ORDER BY cnt DESC
    `);
    orderSummary.rows.forEach(r => console.log(`  ${r.status}: ${r.cnt}`));

    // Payment methods
    console.log('\n--- Invoice Payment Methods ---');
    try {
      const methods = await client.query(`
        SELECT payment_method, COUNT(*) as cnt FROM public.invoice 
        GROUP BY payment_method
      `);
      methods.rows.forEach(r => console.log(`  ${r.payment_method}: ${r.cnt}`));
    } catch (e) { console.log(`  Error: ${e.message}`); }

    // Fiscal periods
    console.log('\n--- Fiscal Periods ---');
    const fps = await client.query(`SELECT * FROM public.accounting_fiscal_period`);
    fps.rows.forEach(r => {
      console.log(`  id=${r.id?.substring(0,12)}... label=${r.label || r.name} start=${r.start_date} end=${r.end_date} status=${r.status}`);
    });

    // Accounts summary by type
    console.log('\n--- CoA Summary ---');
    const coa = await client.query(`
      SELECT account_type, COUNT(*) as cnt 
      FROM public.accounting_account 
      GROUP BY account_type ORDER BY account_type
    `);
    coa.rows.forEach(r => console.log(`  ${r.account_type}: ${r.cnt}`));

    // Save complete baseline
    const fs = require('fs');
    baseline['orders_total'] = (await client.query(`SELECT COUNT(*) as c FROM public."order"`)).rows[0].c;
    baseline['orders_pending'] = (await client.query(`SELECT COUNT(*) as c FROM public."order" WHERE status='pending'`)).rows[0].c;
    baseline['orders_completed'] = (await client.query(`SELECT COUNT(*) as c FROM public."order" WHERE status='completed'`)).rows[0].c;
    baseline['customers'] = (await client.query(`SELECT COUNT(*) as c FROM public.customer`)).rows[0].c;
    baseline['products'] = (await client.query(`SELECT COUNT(*) as c FROM public.product WHERE deleted_at IS NULL`)).rows[0].c;
    baseline['variants'] = (await client.query(`SELECT COUNT(*) as c FROM public.product_variant WHERE deleted_at IS NULL`)).rows[0].c;
    baseline['branches'] = (await client.query(`SELECT COUNT(*) as c FROM public.branch`)).rows[0].c;
    baseline['gl_debit'] = gl.rows[0].total_debit;
    baseline['gl_credit'] = gl.rows[0].total_credit;
    baseline['gl_balanced'] = parseFloat(gl.rows[0].total_debit) === parseFloat(gl.rows[0].total_credit);
    
    const path = 'E:\\vig\\cakes2home-main\\cakes2home-main\\CHECKPOINTS\\acceptance-test-evidence\\db_baseline_v3.json';
    fs.writeFileSync(path, JSON.stringify(baseline, null, 2));
    console.log(`\nBaseline saved to: ${path}`);

    console.log('\n=== BASELINE v3 COMPLETE ===');
  } finally {
    client.release();
    await pool.end();
  }
}

captureBaseline().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
