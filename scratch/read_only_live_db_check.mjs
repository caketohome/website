import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../frontend/.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log("=== SAFE READ-ONLY DATABASE PROBE ===");
  const client = await pool.connect();
  try {
    // 1. Company
    const compRes = await client.query('SELECT * FROM public.company');
    console.log(`Company count: ${compRes.rowCount}`);
    if (compRes.rowCount > 0) {
      console.log('Company rows:', compRes.rows);
    }

    // 2. GST Registration
    const gstRes = await client.query('SELECT * FROM public.gst_registration');
    console.log(`GST Registration count: ${gstRes.rowCount}`);
    if (gstRes.rowCount > 0) {
      console.log('GST Registration rows:', gstRes.rows);
    }

    // 3. Settings (accounting_start_date)
    const setRes = await client.query('SELECT * FROM public.setting ORDER BY key ASC');
    console.log(`Settings count: ${setRes.rowCount}`);
    const accDateSetting = setRes.rows.find(r => r.key === 'accounting_start_date' || r.key.includes('accounting'));
    console.log('Accounting setting:', accDateSetting || 'NOT FOUND');

    // 4. Invoice sequence
    const seqRes = await client.query('SELECT * FROM public.invoice_sequence');
    console.log('Invoice sequence rows:', seqRes.rows);

    // 5. Invoices
    const invRes = await client.query('SELECT id, invoice_number, order_id, total_amount, created_at FROM public.invoice ORDER BY created_at ASC');
    console.log(`Invoices count: ${invRes.rowCount}`);
    console.log('Invoices:', invRes.rows);

    // 6. Orders matching 'test' or 'cod' or the 13 orders
    const testOrdersRes = await client.query(`
      SELECT id, order_number, total, status, payment_status, payment_method, 
             customer_name, branch_id, created_at, pickup_verified_at, delivered_at,
             metadata
      FROM public."order"
      WHERE id LIKE 'ord_test_cod_%' OR order_number LIKE 'CTH-COD-%'
      ORDER BY created_at ASC
    `);
    console.log(`Matching test/COD orders count: ${testOrdersRes.rowCount}`);
    console.log('Orders found:');
    let totalAmount = 0;
    for (const r of testOrdersRes.rows) {
      totalAmount += parseFloat(r.total || 0);
      console.log(`- ID: ${r.id} | Num: ${r.order_number} | Total: ${r.total} | Status: ${r.status} | PayMethod: ${r.payment_method} | PayStatus: ${r.payment_status} | Customer: ${r.customer_name}`);
    }
    console.log(`Sum of total across these ${testOrdersRes.rowCount} orders: ₹${totalAmount.toFixed(2)}`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error("DB probe error:", err);
  process.exit(1);
});
