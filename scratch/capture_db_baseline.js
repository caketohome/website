/**
 * PRG-01 Acceptance Test — Database Baseline Capture
 * Captures current database state before manual testing begins
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
    console.log('=== PRG-01 DATABASE BASELINE CAPTURE ===');
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('');

    // Core counts
    const queries = [
      { label: 'Orders', sql: 'SELECT COUNT(*) as count FROM public."order"' },
      { label: 'Invoices', sql: 'SELECT COUNT(*) as count FROM public.invoice' },
      { label: 'Accounting Vouchers', sql: 'SELECT COUNT(*) as count FROM public.accounting_voucher' },
      { label: 'Journal Entries', sql: 'SELECT COUNT(*) as count FROM public.accounting_journal_entry' },
      { label: 'Journal Lines', sql: 'SELECT COUNT(*) as count FROM public.accounting_journal_line' },
      { label: 'Inventory Movements', sql: 'SELECT COUNT(*) as count FROM public.inventory_movement' },
      { label: 'Inventory Cost Lots', sql: 'SELECT COUNT(*) as count FROM public.inventory_cost_lot' },
      { label: 'Branch Inventory', sql: 'SELECT COUNT(*) as count FROM public.branch_inventory' },
      { label: 'Customers', sql: 'SELECT COUNT(*) as count FROM public.customer' },
      { label: 'Products', sql: 'SELECT COUNT(*) as count FROM public.product WHERE deleted_at IS NULL' },
      { label: 'Product Variants', sql: 'SELECT COUNT(*) as count FROM public.product_variant WHERE deleted_at IS NULL' },
      { label: 'Suppliers', sql: 'SELECT COUNT(*) as count FROM public.supplier' },
      { label: 'Purchases', sql: 'SELECT COUNT(*) as count FROM public.purchase' },
      { label: 'Purchase Items', sql: 'SELECT COUNT(*) as count FROM public.purchase_item' },
      { label: 'Fiscal Periods', sql: 'SELECT COUNT(*) as count FROM public.accounting_fiscal_period' },
      { label: 'Accounting Accounts', sql: 'SELECT COUNT(*) as count FROM public.accounting_account' },
      { label: 'Payment Transactions', sql: 'SELECT COUNT(*) as count FROM public.payment_transaction' },
      { label: 'COD Collections', sql: 'SELECT COUNT(*) as count FROM public.cod_collection' },
      { label: 'Bank Deposit Slips', sql: 'SELECT COUNT(*) as count FROM public.bank_deposit_slip' },
      { label: 'Gateway Payout Batches', sql: 'SELECT COUNT(*) as count FROM public.gateway_payout_batch' },
      { label: 'Bank Statements', sql: 'SELECT COUNT(*) as count FROM public.bank_statement' },
      { label: 'Bank Reconciliation Items', sql: 'SELECT COUNT(*) as count FROM public.bank_reconciliation_item' },
      { label: 'Expenses', sql: 'SELECT COUNT(*) as count FROM public.expense' },
      { label: 'Branches', sql: 'SELECT COUNT(*) as count FROM public.branch' },
      { label: 'Staff', sql: 'SELECT COUNT(*) as count FROM public.staff' },
      { label: 'Product Availability', sql: 'SELECT COUNT(*) as count FROM public.product_availability' },
      { label: 'Statutory Invoice Seq', sql: "SELECT last_value FROM public.statutory_invoice_seq" },
    ];

    const baseline = {};
    
    for (const q of queries) {
      try {
        const result = await client.query(q.sql);
        const val = result.rows[0]?.count ?? result.rows[0]?.last_value ?? 0;
        baseline[q.label] = parseInt(val, 10);
        console.log(`  ${q.label}: ${val}`);
      } catch (err) {
        baseline[q.label] = `ERROR: ${err.message}`;
        console.log(`  ${q.label}: ERROR - ${err.message}`);
      }
    }

    // Verify GL balance
    console.log('\n--- GL Balance Check ---');
    try {
      const glResult = await client.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END), 0) as total_debit,
          COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END), 0) as total_credit
        FROM public.accounting_journal_line
      `);
      const { total_debit, total_credit } = glResult.rows[0];
      console.log(`  Total Debits:  ${total_debit}`);
      console.log(`  Total Credits: ${total_credit}`);
      console.log(`  Balanced: ${parseFloat(total_debit) === parseFloat(total_credit)}`);
      baseline['GL_Total_Debit'] = parseFloat(total_debit);
      baseline['GL_Total_Credit'] = parseFloat(total_credit);
      baseline['GL_Balanced'] = parseFloat(total_debit) === parseFloat(total_credit);
    } catch (err) {
      console.log(`  GL Balance: ERROR - ${err.message}`);
    }

    // Order status distribution
    console.log('\n--- Order Status Distribution ---');
    try {
      const statusResult = await client.query(`
        SELECT status, COUNT(*) as count 
        FROM public."order" 
        GROUP BY status 
        ORDER BY count DESC
      `);
      baseline['Order_Status_Distribution'] = {};
      for (const row of statusResult.rows) {
        console.log(`  ${row.status}: ${row.count}`);
        baseline['Order_Status_Distribution'][row.status] = parseInt(row.count, 10);
      }
    } catch (err) {
      console.log(`  Status Distribution: ERROR - ${err.message}`);
    }

    // Check for existing test data contamination
    console.log('\n--- Test Contamination Check ---');
    try {
      const testOrders = await client.query(`
        SELECT COUNT(*) as count FROM public."order" 
        WHERE order_number LIKE '%TEST%' OR order_number LIKE '%test%'
      `);
      console.log(`  Test orders: ${testOrders.rows[0].count}`);
      baseline['Test_Orders'] = parseInt(testOrders.rows[0].count, 10);
    } catch (err) {
      console.log(`  Test orders: ERROR - ${err.message}`);
    }

    // Save baseline to JSON
    const fs = require('fs');
    const baselinePath = 'E:\\vig\\cakes2home-main\\cakes2home-main\\CHECKPOINTS\\acceptance-test-evidence\\db_baseline.json';
    fs.mkdirSync('E:\\vig\\cakes2home-main\\cakes2home-main\\CHECKPOINTS\\acceptance-test-evidence', { recursive: true });
    fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
    console.log(`\nBaseline saved to: ${baselinePath}`);

    console.log('\n=== BASELINE CAPTURE COMPLETE ===');
  } finally {
    client.release();
    await pool.end();
  }
}

captureBaseline().catch(err => {
  console.error('BASELINE CAPTURE FAILED:', err);
  process.exit(1);
});
