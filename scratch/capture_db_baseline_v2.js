/**
 * PRG-01 Acceptance Test — Accurate Database Baseline Capture (v2)
 * Corrected column names based on actual schema
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

async function captureBaseline() {
  const client = await pool.connect();
  try {
    console.log('=== PRG-01 DATABASE BASELINE CAPTURE v2 ===');
    console.log(`Timestamp: ${new Date().toISOString()}`);

    // 1. Discover actual schema for key accounting tables
    console.log('\n--- Accounting Journal Line Schema ---');
    const jlCols = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='accounting_journal_line' 
      ORDER BY ordinal_position
    `);
    jlCols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

    // 2. Get GL balance using correct column names
    console.log('\n--- GL Balance (corrected) ---');
    const glResult = await client.query(`
      SELECT 
        COALESCE(SUM(debit_amount), 0) as total_debit,
        COALESCE(SUM(credit_amount), 0) as total_credit
      FROM public.accounting_journal_line
    `);
    const { total_debit, total_credit } = glResult.rows[0];
    console.log(`  Total Debits:  ${total_debit}`);
    console.log(`  Total Credits: ${total_credit}`);
    console.log(`  Balanced: ${parseFloat(total_debit) === parseFloat(total_credit)}`);

    // 3. Order table columns
    console.log('\n--- Order table key columns ---');
    const orderCols = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='order' 
      ORDER BY ordinal_position
    `);
    orderCols.rows.forEach(r => console.log(`  ${r.column_name}`));

    // 4. Check for test orders
    console.log('\n--- Order numbers sample (latest 10) ---');
    const orderSample = await client.query(`
      SELECT id, display_id, status, created_at 
      FROM public."order" 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    orderSample.rows.forEach(r => console.log(`  ${r.id?.substring(0,12)}... display_id=${r.display_id} status=${r.status} created=${r.created_at}`));

    // 5. Check vouchers
    console.log('\n--- Voucher details ---');
    const vouchers = await client.query(`
      SELECT id, voucher_number, voucher_type, status, source_type, created_at
      FROM public.accounting_voucher
      ORDER BY created_at DESC
    `);
    vouchers.rows.forEach(r => console.log(`  ${r.voucher_number} type=${r.voucher_type} status=${r.status} source=${r.source_type}`));

    // 6. Check invoices
    console.log('\n--- Invoice details ---');
    const invoices = await client.query(`
      SELECT id, invoice_number, order_id, total_amount, status, created_at
      FROM public.invoice
      ORDER BY created_at DESC
    `);
    invoices.rows.forEach(r => console.log(`  ${r.invoice_number} total=${r.total_amount} status=${r.status} created=${r.created_at}`));

    // 7. Journal entries
    console.log('\n--- Journal Entry details ---');
    const journals = await client.query(`
      SELECT id, voucher_id, description, status, created_at
      FROM public.accounting_journal_entry
      ORDER BY created_at DESC
    `);
    journals.rows.forEach(r => console.log(`  ${r.id?.substring(0,12)}... desc=${r.description} status=${r.status}`));

    // 8. Journal lines
    console.log('\n--- Journal Line details ---');
    const jlines = await client.query(`
      SELECT jl.*, aa.code as account_code, aa.name as account_name
      FROM public.accounting_journal_line jl
      LEFT JOIN public.accounting_account aa ON jl.account_id = aa.id
      ORDER BY jl.created_at DESC
    `);
    jlines.rows.forEach(r => console.log(`  ${r.account_code} ${r.account_name} dr=${r.debit_amount} cr=${r.credit_amount}`));

    // 9. Check all ERP-specific tables existence
    console.log('\n--- ERP Table Existence Check ---');
    const erpTables = [
      'cod_collection', 'cod_rider_shift', 'bank_statement', 'bank_statement_line',
      'bank_reconciliation_item', 'staff', 'product_availability',
      'gateway_payout_batch', 'gateway_settlement_order', 'bank_deposit_slip',
      'expense', 'expense_category', 'accounting_voucher', 'accounting_journal_entry',
      'accounting_journal_line', 'accounting_account', 'accounting_fiscal_period',
      'invoice', 'purchase', 'purchase_item', 'inventory_movement',
      'inventory_cost_lot', 'branch_inventory', 'supplier'
    ];
    for (const t of erpTables) {
      try {
        const r = await client.query(`SELECT COUNT(*) as c FROM public."${t}"`);
        console.log(`  ✓ ${t}: ${r.rows[0].c} rows`);
      } catch (err) {
        console.log(`  ✗ ${t}: MISSING (${err.message.split('\n')[0]})`);
      }
    }

    // 10. Payment transaction check
    console.log('\n--- Payment Transactions ---');
    const payments = await client.query(`
      SELECT provider_id, status, COUNT(*) as cnt
      FROM public.payment_transaction
      GROUP BY provider_id, status
    `);
    payments.rows.forEach(r => console.log(`  provider=${r.provider_id} status=${r.status} count=${r.cnt}`));

    console.log('\n=== BASELINE CAPTURE v2 COMPLETE ===');
  } finally {
    client.release();
    await pool.end();
  }
}

captureBaseline().catch(err => {
  console.error('BASELINE CAPTURE FAILED:', err);
  process.exit(1);
});
