const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

function getConnectionString() {
  const envPath = path.join(__dirname, '../.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      let val = line.trim().substring('DATABASE_URL='.length).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
}

const pool = new Pool({ connectionString: getConnectionString() });
async function check() {
  const ba = await pool.query(`SELECT id, bank_name, gl_account_id, status FROM public.bank_account`);
  console.log('Bank Accounts:', ba.rows);
  await pool.end();
}
check().catch(console.error);
  const vIds = c73Vouchers.rows.map(r => r.id);
  console.log('Vouchers to delete:', vIds);

  if (vIds.length > 0) {
    await pool.query(`
      DELETE FROM public.accounting_journal_line 
      WHERE journal_entry_id IN (SELECT id FROM public.accounting_journal_entry WHERE voucher_id = ANY($1))
    `, [vIds]);
    await pool.query(`DELETE FROM public.accounting_journal_entry WHERE voucher_id = ANY($1)`, [vIds]);
    await pool.query(`DELETE FROM public.accounting_voucher WHERE id = ANY($1)`, [vIds]);
  }

  await pool.query(`DELETE FROM public.purchase_payment_allocation WHERE purchase_id LIKE 'pur_c73_%'`);
  await pool.query(`DELETE FROM public.purchase_payment WHERE purchase_id LIKE 'pur_c73_%' OR id LIKE 'purp_%'`);
  await pool.query(`DELETE FROM public.purchase WHERE id LIKE 'pur_c73_%'`);
  await pool.query(`DELETE FROM public.teller_movement WHERE source_type = 'PURCHASE_PAYMENT' OR narration LIKE '%flour%'`);
  await pool.query(`DELETE FROM public.teller_session WHERE id LIKE 'ts_c73_%'`);
  await pool.query(`DELETE FROM public.teller WHERE id LIKE 'tel_c73_%'`);
  await pool.query(`DELETE FROM public.supplier WHERE id LIKE 'sup_c73_%'`);
  await pool.query(`DELETE FROM public.company WHERE id LIKE 'comp_c73_%'`);

  const tb = await pool.query(`
    SELECT ROUND(COALESCE(SUM(debit_amount), 0), 2) as dr, ROUND(COALESCE(SUM(credit_amount), 0), 2) as cr FROM public.accounting_journal_line
  `);
  console.log('Restored TB:', tb.rows[0]);
  await pool.end();
}
check().catch(console.error);
